import { and, count, eq, ne } from 'drizzle-orm'
import { SeasonStatus } from '@shenicest/shared'
import type { Database } from '../../db'
import { organizerOrgMembers, organizerOrgs, seasonOrganizers, seasons } from '../../db/schema'
import { UserProfileService } from '../user/service'
import {
  BoomlandAccessService,
  boomlandError,
  iso,
  writeAudit,
} from '../boomland-shared'

export class OrganizerOrgService {
  private access: BoomlandAccessService
  private users: UserProfileService

  constructor(private db: Database) {
    this.access = new BoomlandAccessService(db)
    this.users = new UserProfileService(db)
  }

  private async getOrg(orgId: number) {
    const rows = await this.db.select().from(organizerOrgs).where(eq(organizerOrgs.id, orgId)).limit(1)
    return rows[0] ?? null
  }

  private async assertOrg(orgId: number) {
    const org = await this.getOrg(orgId)
    if (!org) throw boomlandError('ORGANIZER_ORG_NOT_FOUND', '主办方组织不存在', 404)
    return org
  }

  private async assertNameAvailable(name: string, exceptId?: number) {
    const rows = await this.db.select({ id: organizerOrgs.id }).from(organizerOrgs).where(eq(organizerOrgs.name, name))
    if (rows.some((row) => row.id !== exceptId)) {
      throw boomlandError('ORGANIZER_ORG_NAME_TAKEN', '主办方组织名称已存在', 409, { field: 'name' })
    }
  }

  async list(userId: string) {
    const [orgs, members] = await Promise.all([
      this.db.select().from(organizerOrgs).orderBy(organizerOrgs.name),
      this.db.select({ orgId: organizerOrgMembers.orgId, userId: organizerOrgMembers.userId }).from(organizerOrgMembers),
    ])
    const membershipsByOrg = new Map<number, string[]>()
    for (const member of members) {
      const list = membershipsByOrg.get(member.orgId) ?? []
      list.push(member.userId)
      membershipsByOrg.set(member.orgId, list)
    }
    return orgs.map((org) => {
      const orgMembers = membershipsByOrg.get(org.id) ?? []
      return {
        id: org.id,
        name: org.name,
        memberCount: orgMembers.length,
        isMember: orgMembers.includes(userId),
        createdAt: iso(org.createdAt),
      }
    })
  }

  async listMembers(orgId: number, userId: string) {
    await this.assertOrg(orgId)
    await this.access.assertOrgMemberOrOperator(orgId, userId)
    const rows = await this.db
      .select()
      .from(organizerOrgMembers)
      .where(eq(organizerOrgMembers.orgId, orgId))
      .orderBy(organizerOrgMembers.createdAt)
    return Promise.all(rows.map(async (row) => {
      const profile = await this.users.getPublicProfile(row.userId)
      return {
        userId: row.userId,
        name: profile?.nickname ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        joinedAt: iso(row.createdAt),
      }
    }))
  }

  async create(name: string, actorUserId: string) {
    const trimmed = name.trim()
    await this.assertNameAvailable(trimmed)
    const [result] = await this.db.insert(organizerOrgs).values({ name: trimmed })
    await writeAudit(this.db, {
      actorUserId,
      action: 'organizer_org.created',
      targetType: 'organizer_org',
      targetId: String(result.insertId),
      detail: { name: trimmed },
    })
    const org = await this.assertOrg(result.insertId)
    return { id: org.id, name: org.name, memberCount: 0, isMember: false, createdAt: iso(org.createdAt) }
  }

  async rename(orgId: number, name: string, actorUserId: string) {
    const org = await this.assertOrg(orgId)
    const trimmed = name.trim()
    await this.assertNameAvailable(trimmed, orgId)
    await this.db.update(organizerOrgs).set({ name: trimmed }).where(eq(organizerOrgs.id, orgId))
    await writeAudit(this.db, {
      actorUserId,
      action: 'organizer_org.updated',
      targetType: 'organizer_org',
      targetId: String(orgId),
      detail: { from: org.name, to: trimmed },
    })
    const updated = await this.assertOrg(orgId)
    return { id: updated.id, name: updated.name }
  }

  async remove(orgId: number, actorUserId: string) {
    const org = await this.assertOrg(orgId)
    const [used] = await this.db
      .select({ value: count() })
      .from(seasonOrganizers)
      .where(eq(seasonOrganizers.orgId, orgId))
    if ((used?.value ?? 0) > 0) {
      throw boomlandError('ORGANIZER_ORG_IN_USE', '该组织仍有赛季关联，不能删除', 409)
    }
    await this.db.delete(organizerOrgMembers).where(eq(organizerOrgMembers.orgId, orgId))
    await this.db.delete(organizerOrgs).where(eq(organizerOrgs.id, orgId))
    await writeAudit(this.db, {
      actorUserId,
      action: 'organizer_org.deleted',
      targetType: 'organizer_org',
      targetId: String(orgId),
      detail: { name: org.name },
    })
  }

  async addMember(orgId: number, userId: string, actorUserId: string) {
    await this.assertOrg(orgId)
    if (!(await this.users.exists(userId))) {
      throw boomlandError('USER_NOT_FOUND', '用户不存在', 404, { field: 'userId' })
    }
    const existing = await this.db
      .select({ id: organizerOrgMembers.id })
      .from(organizerOrgMembers)
      .where(and(eq(organizerOrgMembers.orgId, orgId), eq(organizerOrgMembers.userId, userId)))
      .limit(1)
    if (existing.length > 0) {
      throw boomlandError('ORGANIZER_MEMBER_EXISTS', '该用户已是组织成员', 409)
    }
    const [result] = await this.db.insert(organizerOrgMembers).values({ orgId, userId })
    await writeAudit(this.db, {
      actorUserId,
      action: 'organizer_member.added',
      targetType: 'organizer_org',
      targetId: String(orgId),
      detail: { userId, memberId: result.insertId },
    })
    const profile = await this.users.getPublicProfile(userId)
    return {
      userId,
      name: profile?.nickname ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      joinedAt: new Date().toISOString(),
    }
  }

  async removeMember(orgId: number, userId: string, actorUserId: string) {
    await this.assertOrg(orgId)
    const existing = await this.db
      .select({ id: organizerOrgMembers.id })
      .from(organizerOrgMembers)
      .where(and(eq(organizerOrgMembers.orgId, orgId), eq(organizerOrgMembers.userId, userId)))
      .limit(1)
    if (existing.length === 0) {
      throw boomlandError('ORGANIZER_MEMBER_NOT_FOUND', '该用户不是组织成员', 404)
    }
    const [memberCount] = await this.db
      .select({ value: count() })
      .from(organizerOrgMembers)
      .where(eq(organizerOrgMembers.orgId, orgId))
    if ((memberCount?.value ?? 0) <= 1) {
      const [attached] = await this.db
        .select({ value: count() })
        .from(seasonOrganizers)
        .innerJoin(seasons, eq(seasonOrganizers.seasonId, seasons.id))
        .where(and(eq(seasonOrganizers.orgId, orgId), ne(seasons.status, SeasonStatus.Cancelled)))
      if ((attached?.value ?? 0) > 0) {
        throw boomlandError('ORGANIZER_ORG_LAST_MEMBER', '该组织仍有关联赛季，不能移除最后一名成员', 409)
      }
    }
    await this.db
      .delete(organizerOrgMembers)
      .where(and(eq(organizerOrgMembers.orgId, orgId), eq(organizerOrgMembers.userId, userId)))
    await writeAudit(this.db, {
      actorUserId,
      action: 'organizer_member.removed',
      targetType: 'organizer_org',
      targetId: String(orgId),
      detail: { userId },
    })
  }
}
