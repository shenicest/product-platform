import { and, desc, eq, or, sql } from 'drizzle-orm'
import type { Database } from '../../db'
import { connectionDailyLimits, connectionRequests, projects, talentModerationRecords, talentProfiles } from '../../db/schema'
import { decryptContact, encryptContact } from '../../lib/contact-encryption'
import { UserProfileService } from '../user/service'
import {
  CATEGORIES,
  COLLABORATION_DURATIONS,
  CONNECTION_PURPOSES,
  ConnectionRequestStatus,
  ProjectStatus,
  TALENT_ROLES,
  TALENT_SKILLS,
  TalentProfileStatus,
} from '@shenicest/shared'
import type { AcceptBody, ConnectionBody, TalentListQuery, TalentProfileBody } from './model'
import { calculateTalentMatch } from './matching'

export class TalentError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

type ProfileRow = typeof talentProfiles.$inferSelect
type ContactInput = { wechat?: string; email?: string }

const MAX_LIMIT = 100
const pairKey = (a: string, b: string) => [a, b].sort().join(':')

function authorizedContact(input: ContactInput) {
  const wechat = input.wechat?.trim()
  const email = input.email?.trim().toLowerCase()
  const hasControl = (value: string | undefined) => value !== undefined && /[\u0000-\u001f\u007f]/.test(value)
  if (hasControl(wechat) || hasControl(email)) {
    throw new TalentError('INVALID_CONTACT', 'Contact methods cannot contain control characters')
  }
  if (wechat && (wechat.length < 1 || wechat.length > 64)) {
    throw new TalentError('INVALID_CONTACT', 'WeChat ID must be 1-64 characters')
  }
  if (email && (email.length < 1 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new TalentError('INVALID_CONTACT', 'Email address is invalid')
  }
  if (!wechat && !email) {
    throw new TalentError('CONTACT_REQUIRED', 'At least one contact method is required')
  }
  return { wechat: wechat ?? null, email: email ?? null }
}

function dedupe(values: string[]) {
  return [...new Set(values)]
}

function assertRange(name: string, values: string[], min: number, max: number) {
  if (values.length < min || values.length > max) {
    throw new TalentError('INVALID_PROFILE', `${name} must contain ${min}-${max} values`)
  }
}

function assertCatalog(name: string, values: string[], catalog: readonly string[]) {
  if (values.some((value) => !catalog.includes(value))) {
    throw new TalentError('INVALID_CATALOG_VALUE', `${name} contains an unsupported value`)
  }
}

function iso(value: Date | null) {
  return value?.toISOString() ?? null
}

export class TalentService {
  private users: UserProfileService

  constructor(private db: Database) {
    this.users = new UserProfileService(db)
  }

  private normalizeProfile(body: TalentProfileBody) {
    const result = {
      headline: body.headline,
      bio: body.bio,
      city: body.city,
      roles: dedupe(body.roles),
      skills: dedupe(body.skills),
      seekingSkills: dedupe(body.seekingSkills ?? []),
      domains: dedupe(body.domains),
      durations: dedupe(body.durations),
    }
    assertRange('roles', result.roles, 1, 3)
    assertRange('skills', result.skills, 3, 10)
    assertRange('seekingSkills', result.seekingSkills, 0, 5)
    assertRange('domains', result.domains, 1, 3)
    assertRange('durations', result.durations, 1, 3)
    assertCatalog('roles', result.roles, TALENT_ROLES)
    assertCatalog('skills', result.skills, TALENT_SKILLS)
    assertCatalog('seekingSkills', result.seekingSkills, TALENT_SKILLS)
    assertCatalog('domains', result.domains, CATEGORIES)
    assertCatalog('durations', result.durations, COLLABORATION_DURATIONS)
    return result
  }

  private profileDto(profile: ProfileRow) {
    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      headline: profile.headline,
      bio: profile.bio,
      city: profile.city,
      roles: profile.roles,
      skills: profile.skills,
      seekingSkills: profile.seekingSkills,
      domains: profile.domains,
      durations: profile.durations,
      publishedAt: profile.publishedAt.toISOString(),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    }
  }

  async getProfile(userId: string) {
    const [profile] = await this.db.select().from(talentProfiles).where(eq(talentProfiles.userId, userId)).limit(1)
    return profile ?? null
  }

  async publish(userId: string, body: TalentProfileBody) {
    const values = this.normalizeProfile(body)
    const current = await this.getProfile(userId)
    if (current?.status === TalentProfileStatus.Suspended) {
      throw new TalentError('PROFILE_SUSPENDED', 'Suspended profiles are terminal')
    }
    if (current) {
      await this.db.update(talentProfiles).set({ ...values, status: TalentProfileStatus.Published }).where(eq(talentProfiles.userId, userId))
      const updated = await this.getProfile(userId)
      return updated ? this.profileDto(updated) : null
    }
    await this.db.insert(talentProfiles).values({ ...values, userId, status: TalentProfileStatus.Published })
    const created = await this.getProfile(userId)
    return created ? this.profileDto(created) : null
  }

  async update(userId: string, body: TalentProfileBody) {
    const current = await this.getProfile(userId)
    if (!current) throw new TalentError('PROFILE_NOT_FOUND', 'Profile not found')
    if (current.status === TalentProfileStatus.Suspended) throw new TalentError('PROFILE_SUSPENDED', 'Suspended profiles are terminal')
    await this.db.update(talentProfiles).set(this.normalizeProfile(body)).where(eq(talentProfiles.userId, userId))
    const updated = await this.getProfile(userId)
    return updated ? this.profileDto(updated) : null
  }

  async pause(userId: string) {
    const current = await this.getProfile(userId)
    if (!current) throw new TalentError('PROFILE_NOT_FOUND', 'Profile not found')
    if (current.status === TalentProfileStatus.Suspended) throw new TalentError('PROFILE_SUSPENDED', 'Suspended profiles are terminal')
    await this.db.update(talentProfiles).set({ status: TalentProfileStatus.Paused }).where(eq(talentProfiles.userId, userId))
    const updated = await this.getProfile(userId)
    return updated ? this.profileDto(updated) : null
  }

  async resume(userId: string, body: TalentProfileBody) {
    return this.publish(userId, body)
  }

  private async publicProfile(profile: ProfileRow, viewerId?: string, includeMatch = false) {
    const [liveProjects, founder] = await Promise.all([
      this.db.select({ id: projects.id, name: projects.name, tagline: projects.tagline }).from(projects)
        .where(and(eq(projects.userId, profile.userId), eq(projects.status, ProjectStatus.Live)))
        .orderBy(desc(projects.updatedAt)),
      this.users.getPublicProfile(profile.userId),
    ])
    let match: ReturnType<typeof calculateTalentMatch> | undefined
    if (includeMatch && viewerId && viewerId !== profile.userId) {
      const viewer = await this.getProfile(viewerId)
      if (viewer?.status === TalentProfileStatus.Published && profile.status === TalentProfileStatus.Published) {
        match = calculateTalentMatch(viewer, profile)
      }
    }
    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      headline: profile.headline,
      bio: profile.bio,
      city: profile.city,
      roles: profile.roles,
      skills: profile.skills,
      seekingSkills: profile.seekingSkills,
      domains: profile.domains,
      durations: profile.durations,
      publishedAt: profile.publishedAt.toISOString(),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      founder,
      projects: liveProjects,
      ...(includeMatch ? { match } : {}),
    }
  }

  async list(query: TalentListQuery) {
    const all = await this.db.select().from(talentProfiles).where(eq(talentProfiles.status, TalentProfileStatus.Published))
    const cards = await Promise.all(all.map(async (profile) => ({ profile, view: await this.publicProfile(profile, undefined, false) })))
    const needle = query.q?.trim().toLowerCase()
    const requestedSkills = query.skills?.split(',').filter(Boolean) ?? []
    const filtered = cards.filter(({ profile, view }) => {
      const searchable = [profile.headline, profile.bio, ...profile.skills, view.founder?.nickname ?? '', ...view.projects.map((project) => project.name)].join('\n').toLowerCase()
      return (!needle || searchable.includes(needle))
        && (!query.role || profile.roles.includes(query.role))
        && (!query.duration || profile.durations.includes(query.duration))
        && (!requestedSkills.length || requestedSkills.some((skill) => profile.skills.includes(skill)))
    })
    filtered.sort((a, b) => {
      const aValue = query.sort === 'active' ? a.profile.updatedAt.getTime() : a.profile.publishedAt.getTime()
      const bValue = query.sort === 'active' ? b.profile.updatedAt.getTime() : b.profile.publishedAt.getTime()
      return bValue - aValue || a.profile.userId.localeCompare(b.profile.userId)
    })
    const offset = Math.max(query.offset ?? 0, 0)
    const limit = Math.min(Math.max(query.limit ?? 20, 1), MAX_LIMIT)
    return { data: filtered.slice(offset, offset + limit).map(({ view }) => view), total: filtered.length }
  }

  async detail(userId: string, viewerId?: string) {
    const profile = await this.getProfile(userId)
    if (!profile || profile.status !== TalentProfileStatus.Published) throw new TalentError('PROFILE_NOT_FOUND', 'Published profile not found')
    return this.publicProfile(profile, viewerId, true)
  }

  async management(userId: string) {
    const profile = await this.getProfile(userId)
    if (!profile) throw new TalentError('PROFILE_NOT_FOUND', 'Profile not found')
    const audit = await this.suspensionAudit(userId)
    const latestSuspension = audit[0] ?? null
    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      headline: profile.headline,
      bio: profile.bio,
      city: profile.city,
      roles: profile.roles,
      skills: profile.skills,
      seekingSkills: profile.seekingSkills,
      domains: profile.domains,
      durations: profile.durations,
      publishedAt: profile.publishedAt.toISOString(),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      suspension: latestSuspension ? { reason: latestSuspension.reason, createdAt: latestSuspension.createdAt } : null,
    }
  }

  private beijingDate() {
    const now = new Date()
    const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, '0')}-${String(beijing.getUTCDate()).padStart(2, '0')}`
  }

  private async connectionView(row: typeof connectionRequests.$inferSelect, viewerId: string) {
    const [senderProfile, receiverProfile, senderIdentity, receiverIdentity, project] = await Promise.all([
      this.getProfile(row.senderUserId),
      this.getProfile(row.receiverUserId),
      this.users.getPublicProfile(row.senderUserId),
      this.users.getPublicProfile(row.receiverUserId),
      row.projectId ? this.db.select({ id: projects.id, name: projects.name, tagline: projects.tagline, status: projects.status }).from(projects).where(eq(projects.id, row.projectId)).then(([value]) => value ?? null) : Promise.resolve(null),
    ])
    const sender = {
      userId: row.senderUserId,
      identity: senderIdentity,
      hasPublishedTalentProfile: senderProfile?.status === TalentProfileStatus.Published,
      talentProfile: senderProfile ? await this.publicProfile(senderProfile, undefined, false) : null,
    }
    const receiver = {
      userId: row.receiverUserId,
      identity: receiverIdentity,
      hasPublishedTalentProfile: receiverProfile?.status === TalentProfileStatus.Published,
      talentProfile: receiverProfile ? await this.publicProfile(receiverProfile, undefined, false) : null,
    }
    return {
      id: row.id,
      senderUserId: row.senderUserId,
      receiverUserId: row.receiverUserId,
      projectId: row.projectId,
      purpose: row.purpose,
      message: row.message,
      status: row.status,
      sender,
      receiver,
      project: project && project.status === ProjectStatus.Live ? project : project ? { unavailable: true, id: project.id } : null,
      contacts: row.status === ConnectionRequestStatus.Accepted && [row.senderUserId, row.receiverUserId].includes(viewerId) ? this.contactsFor(row, viewerId) : undefined,
      createdAt: row.createdAt,
      acceptedAt: iso(row.acceptedAt),
      handledAt: iso(row.handledAt),
    }
  }

  private contactsFor(row: typeof connectionRequests.$inferSelect, viewerId: string) {
    const mine = row.senderUserId === viewerId ? row.senderContact : row.receiverContact!
    const other = row.senderUserId === viewerId ? row.receiverContact! : row.senderContact
    return { mine: decryptContact(mine), other: decryptContact(other) }
  }

  async connections(userId: string) {
    const rows = await this.db.select().from(connectionRequests)
      .where(or(eq(connectionRequests.senderUserId, userId), eq(connectionRequests.receiverUserId, userId)))
      .orderBy(desc(connectionRequests.createdAt))
    return {
      data: await Promise.all(rows.map((row) => this.connectionView(row, userId))),
      total: rows.length,
      pendingReceived: rows.filter((row) => row.receiverUserId === userId && row.status === ConnectionRequestStatus.Pending).length,
    }
  }

  async connection(viewerId: string, id: number) {
    const [row] = await this.db.select().from(connectionRequests).where(eq(connectionRequests.id, id))
    if (!row || ![row.senderUserId, row.receiverUserId].includes(viewerId)) {
      throw new TalentError('REQUEST_NOT_FOUND', 'Connection request not found')
    }
    return this.connectionView(row, viewerId)
  }

  async send(senderUserId: string, body: ConnectionBody) {
    if (senderUserId === body.receiverUserId) throw new TalentError('CANNOT_CONNECT_SELF', 'Cannot send a request to yourself')
    if (!CONNECTION_PURPOSES.includes(body.purpose)) throw new TalentError('INVALID_PURPOSE', 'Purpose is not supported')
    if (body.message.trim().length < 30 || body.message.trim().length > 500) throw new TalentError('INVALID_MESSAGE', 'Message must be 30-500 characters')
    const senderContact = authorizedContact(body)
    try {
      return await this.db.transaction(async (tx) => {
      const profiles = await tx.select().from(talentProfiles)
        .where(or(eq(talentProfiles.userId, senderUserId), eq(talentProfiles.userId, body.receiverUserId))).for('update')
      const sender = profiles.find((profile) => profile.userId === senderUserId)
      const receiver = profiles.find((profile) => profile.userId === body.receiverUserId)
      if (sender?.status === TalentProfileStatus.Suspended) throw new TalentError('PROFILE_SUSPENDED', 'Suspended users cannot send requests')
      if (!receiver || receiver.status !== TalentProfileStatus.Published) throw new TalentError('RECEIVER_NOT_PUBLISHED', 'Receiver must have a Published profile')
      const existing = await tx.select().from(connectionRequests).where(or(
        and(eq(connectionRequests.senderUserId, senderUserId), eq(connectionRequests.receiverUserId, body.receiverUserId)),
        and(eq(connectionRequests.senderUserId, body.receiverUserId), eq(connectionRequests.receiverUserId, senderUserId)),
      )).for('update')
      if (existing.some((row) => row.status === ConnectionRequestStatus.Accepted)) throw new TalentError('ALREADY_CONNECTED', 'Users are already connected')
      if (existing.some((row) => row.status === ConnectionRequestStatus.Pending)) throw new TalentError('PENDING_EXISTS', 'A pending request already exists')
      if (body.projectId) {
        const [project] = await tx.select({ userId: projects.userId, status: projects.status }).from(projects).where(eq(projects.id, body.projectId))
        if (!project) throw new TalentError('PROJECT_NOT_FOUND', 'Project not found')
        if (project.userId !== senderUserId) throw new TalentError('PROJECT_FORBIDDEN', 'Project is not owned by sender')
        if (project.status !== ProjectStatus.Live) throw new TalentError('PROJECT_NOT_LIVE', 'Project must be Live')
      }
      const date = this.beijingDate()
      await tx.execute(sql`INSERT IGNORE INTO ${connectionDailyLimits} (sender_user_id, beijing_date, successful_count) VALUES (${senderUserId}, ${date}, 0)`)
      const [daily] = await tx.select().from(connectionDailyLimits).where(and(eq(connectionDailyLimits.senderUserId, senderUserId), eq(connectionDailyLimits.beijingDate, date))).for('update')
      const maximum = sender?.status === TalentProfileStatus.Published ? 10 : 3
      if ((daily?.successfulCount ?? 0) >= maximum) throw new TalentError('RATE_LIMITED', 'Daily connection request limit reached')
      const [inserted] = await tx.insert(connectionRequests).values({
        senderUserId, receiverUserId: body.receiverUserId, pairKey: pairKey(senderUserId, body.receiverUserId), projectId: body.projectId ?? null,
        purpose: body.purpose, message: body.message, senderContact: encryptContact(senderContact), status: ConnectionRequestStatus.Pending,
      })
      const [created] = await tx.select().from(connectionRequests).where(eq(connectionRequests.id, inserted.insertId))
      await tx.update(connectionDailyLimits).set({ successfulCount: sql`${connectionDailyLimits.successfulCount} + 1` }).where(eq(connectionDailyLimits.id, daily.id))
      return created
      })
    } catch (error) {
      if (error instanceof TalentError) throw error
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        throw new TalentError('PENDING_EXISTS', 'A pending request already exists')
      }
      throw error
    }
  }

  async accept(userId: string, id: number, body: AcceptBody) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(connectionRequests).where(eq(connectionRequests.id, id)).for('update')
      if (!row) throw new TalentError('REQUEST_NOT_FOUND', 'Connection request not found')
      if (row.receiverUserId !== userId) throw new TalentError('REQUEST_FORBIDDEN', 'Only the receiver can process this request')
      if (row.status === ConnectionRequestStatus.Accepted) return row
      if (row.status !== ConnectionRequestStatus.Pending) throw new TalentError('REQUEST_NOT_PENDING', 'Request is not pending')
      const receiverContact = authorizedContact(body)
      const profile = await this.getProfile(userId)
      if (profile?.status === TalentProfileStatus.Suspended) throw new TalentError('PROFILE_SUSPENDED', 'Suspended users cannot process requests')
      await tx.update(connectionRequests).set({ receiverContact: encryptContact(receiverContact), status: ConnectionRequestStatus.Accepted, acceptedAt: new Date(), handledAt: new Date() }).where(and(eq(connectionRequests.id, id), eq(connectionRequests.status, ConnectionRequestStatus.Pending)))
      const [accepted] = await tx.select().from(connectionRequests).where(eq(connectionRequests.id, id))
      return accepted
    })
  }

  async ignore(userId: string, id: number) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(connectionRequests).where(eq(connectionRequests.id, id)).for('update')
      if (!row) throw new TalentError('REQUEST_NOT_FOUND', 'Connection request not found')
      if (row.receiverUserId !== userId) throw new TalentError('REQUEST_FORBIDDEN', 'Only the receiver can process this request')
      if (row.status === ConnectionRequestStatus.Ignored) return row
      if (row.status !== ConnectionRequestStatus.Pending) throw new TalentError('REQUEST_NOT_PENDING', 'Request is not pending')
      const profile = await this.getProfile(userId)
      if (profile?.status === TalentProfileStatus.Suspended) throw new TalentError('PROFILE_SUSPENDED', 'Suspended users cannot process requests')
      await tx.update(connectionRequests).set({ pairKey: null, status: ConnectionRequestStatus.Ignored, handledAt: new Date() }).where(and(eq(connectionRequests.id, id), eq(connectionRequests.status, ConnectionRequestStatus.Pending)))
      const [ignored] = await tx.select().from(connectionRequests).where(eq(connectionRequests.id, id))
      return ignored
    })
  }

  async contacts(userId: string, id: number) {
    const [row] = await this.db.select().from(connectionRequests).where(eq(connectionRequests.id, id))
    if (!row || row.status !== ConnectionRequestStatus.Accepted) throw new TalentError('CONTACTS_FORBIDDEN', 'Contacts are only available for accepted requests')
    if (![row.senderUserId, row.receiverUserId].includes(userId)) throw new TalentError('CONTACTS_FORBIDDEN', 'Only connected users can view contacts')
    return this.contactsFor(row, userId)
  }

  async operatorList(query: { q?: string; status?: number; offset?: number; limit?: number }) {
    const rows = await this.db.select().from(talentProfiles)
      .where(query.status === undefined ? undefined : eq(talentProfiles.status, query.status))
      .orderBy(desc(talentProfiles.updatedAt))
    const filtered = query.q ? rows.filter((row) => row.userId.includes(query.q!) || row.headline.includes(query.q!)) : rows
    return filtered.slice(query.offset ?? 0, (query.offset ?? 0) + Math.min(query.limit ?? 20, MAX_LIMIT))
  }

  async suspensionAudit(userId: string) {
    const profile = await this.getProfile(userId)
    if (!profile) throw new TalentError('PROFILE_NOT_FOUND', 'Profile not found')
    const rows = await this.db.select().from(talentModerationRecords).where(eq(talentModerationRecords.talentProfileId, profile.id)).orderBy(desc(talentModerationRecords.createdAt))
    return rows.map((row) => ({
      id: row.id,
      talentProfileId: row.talentProfileId,
      action: row.action,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    }))
  }

  async suspend(operatorId: string, userId: string, reason: string) {
    return this.db.transaction(async (tx) => {
      const [profile] = await tx.select().from(talentProfiles).where(eq(talentProfiles.userId, userId)).for('update')
      if (!profile) throw new TalentError('PROFILE_NOT_FOUND', 'Profile not found')
      if (profile.status === TalentProfileStatus.Suspended) return profile
      await tx.update(talentProfiles).set({ status: TalentProfileStatus.Suspended }).where(eq(talentProfiles.userId, userId))
      await tx.update(connectionRequests).set({ pairKey: null, status: ConnectionRequestStatus.Cancelled, handledAt: new Date() }).where(and(or(eq(connectionRequests.senderUserId, userId), eq(connectionRequests.receiverUserId, userId)), eq(connectionRequests.status, ConnectionRequestStatus.Pending)))
      await tx.insert(talentModerationRecords).values({ talentProfileId: profile.id, operatorId, action: 'suspend', reason })
      return {
        id: profile.id,
        userId: profile.userId,
        status: TalentProfileStatus.Suspended,
        headline: profile.headline,
        bio: profile.bio,
        city: profile.city,
        roles: profile.roles,
        skills: profile.skills,
        seekingSkills: profile.seekingSkills,
        domains: profile.domains,
        durations: profile.durations,
        publishedAt: profile.publishedAt.toISOString(),
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      }
    })
  }
}
