import { afterAll, describe, expect, it } from 'bun:test'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { ConnectionRequestStatus, PROJECT_CONNECTION_PURPOSES, ProjectStatus } from '@shenicest/shared'
import { db } from '../../../src/db'
import {
  ConnectionDailyLimitScope,
  connectionDailyLimits,
  connectionNotificationDeliveries,
  projectConnectionRequests,
  projects,
} from '../../../src/db/schema'
import { decryptContact } from '../../../src/lib/contact-encryption'
import { NOTIFICATION_TYPES } from '../../../src/lib/mail/notification-types'
import { ProjectConnectionService } from '../../../src/modules/project-connection/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'

const OWNER = '920001'
const SENDERS = [
  '920101', '920102', '920103', '920104', '920105', '920106', '920107', '920108', '920109',
  '920110', '920111', '920112', '920113', '920114', '920115', '920116',
]
const projectRows: number[] = []
const sharedUserIds: number[] = []

const service = new ProjectConnectionService(db, { webBaseUrl: 'https://shenicest.test/' })

const validBody = {
  purpose: PROJECT_CONNECTION_PURPOSES[1],
  message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。',
  wechat: 'sender-wechat',
}

function create(senderUserId: string, projectId: number, overrides: Record<string, unknown> = {}) {
  return service.create(senderUserId, projectId, { ...validBody, ...overrides } as typeof validBody)
}

async function seedProject(overrides: Partial<typeof projects.$inferInsert> = {}) {
  const [row] = await db
    .insert(projects)
    .values({
      userId: OWNER,
      status: ProjectStatus.Live,
      name: `项目 ${projectRows.length + 1}`,
      ...overrides,
    })
    .$returningId()
  projectRows.push(row.id)
  return row.id
}

async function seedSharedUser(userId: string, email: string) {
  await db.execute(
    sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, email, nickname) VALUES (${Number(userId)}, ${email}, ${'用户' + userId}) ON DUPLICATE KEY UPDATE email = VALUES(email)`,
  )
  sharedUserIds.push(Number(userId))
}

afterAll(async () => {
  const requestRows = await db
    .select({ id: projectConnectionRequests.id })
    .from(projectConnectionRequests)
    .where(
      inArray(projectConnectionRequests.senderUserId, SENDERS),
    )
  if (requestRows.length) {
    await db.delete(connectionNotificationDeliveries).where(
      inArray(connectionNotificationDeliveries.connectionRequestId, requestRows.map((row) => row.id)),
    )
    await db.delete(projectConnectionRequests).where(
      inArray(projectConnectionRequests.id, requestRows.map((row) => row.id)),
    )
  }
  await db.delete(connectionDailyLimits).where(inArray(connectionDailyLimits.senderUserId, SENDERS))
  if (projectRows.length) await db.delete(projects).where(inArray(projects.id, projectRows))
  if (sharedUserIds.length) {
    await db.execute(
      sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id IN (${sql.join(sharedUserIds.map((id) => sql`${id}`), sql`, `)})`,
    )
  }
})

describe('ProjectConnectionService.create', () => {
  it('creates a request with the project owner locked as receiver and a delivery task', async () => {
    const sender = SENDERS[0]
    await seedSharedUser(OWNER, 'owner@example.com')
    const projectId = await seedProject()

    const created = await create(sender, projectId)
    expect(created).toMatchObject({ projectId, status: ConnectionRequestStatus.Pending })

    const [row] = await db
      .select()
      .from(projectConnectionRequests)
      .where(eq(projectConnectionRequests.id, created.id))
    expect(row.receiverUserId).toBe(OWNER)
    expect(row.pairKey).toBe(`${sender}:${projectId}`)
    expect(row.senderContact).not.toContain('sender-wechat')
    expect(decryptContact(row.senderContact)).toEqual({ wechat: 'sender-wechat', phone: null, email: null })

    const deliveries = await db
      .select()
      .from(connectionNotificationDeliveries)
      .where(eq(connectionNotificationDeliveries.connectionRequestId, created.id))
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      notificationType: NOTIFICATION_TYPES.PROJECT_CONNECTION_CREATED,
      recipientEmail: 'owner@example.com',
      status: 'Pending',
    })

    const [limit] = await db
      .select()
      .from(connectionDailyLimits)
      .where(
        and(
          eq(connectionDailyLimits.scope, ConnectionDailyLimitScope.ProjectConnection),
          eq(connectionDailyLimits.senderUserId, sender),
        ),
      )
    expect(limit.successfulCount).toBe(1)
  })

  it('accepts a phone-only authorization and rejects malformed phones', async () => {
    const sender = SENDERS[8]
    const projectId = await seedProject()
    const created = await create(sender, projectId, {
      wechat: undefined,
      phone: '+86 138-0013-8000',
    })
    const [row] = await db
      .select()
      .from(projectConnectionRequests)
      .where(eq(projectConnectionRequests.id, created.id))
    expect(decryptContact(row.senderContact)).toEqual({
      wechat: null,
      phone: '+86 138-0013-8000',
      email: null,
    })

    await expect(
      create(SENDERS[9], await seedProject(), { wechat: undefined, phone: 'not-a-phone' }),
    ).rejects.toMatchObject({ code: 'INVALID_CONTACT' })
  })

  it('rejects non-live projects and self-connection', async () => {
    const sender = SENDERS[1]
    const draft = await seedProject({ status: ProjectStatus.Draft })
    await expect(create(sender, draft)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    await expect(create(sender, 99999999)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })

    const own = await seedProject({ userId: sender })
    await expect(create(sender, own)).rejects.toMatchObject({ code: 'CANNOT_CONNECT_SELF' })
  })

  it('blocks duplicate Pending and Accepted, and enforces the ignore cooldown', async () => {
    const sender = SENDERS[2]
    const projectId = await seedProject()
    await create(sender, projectId)
    await expect(create(sender, projectId)).rejects.toMatchObject({ code: 'PENDING_EXISTS' })

    const concurrentProject = await seedProject()
    const results = await Promise.allSettled([
      create(sender, concurrentProject),
      create(sender, concurrentProject),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const acceptedSender = SENDERS[3]
    const acceptedProject = await seedProject()
    const acceptedCreated = await create(acceptedSender, acceptedProject)
    await service.accept(OWNER, acceptedCreated.id, { wechat: 'owner-wx' })
    await expect(create(acceptedSender, acceptedProject)).rejects.toMatchObject({ code: 'ALREADY_CONNECTED' })

    const cooldownProject = await seedProject()
    const ignored = await create(acceptedSender, cooldownProject)
    await db
      .update(projectConnectionRequests)
      .set({ status: ConnectionRequestStatus.Ignored, pairKey: null, handledAt: new Date() })
      .where(eq(projectConnectionRequests.id, ignored.id))
    await expect(create(acceptedSender, cooldownProject)).rejects.toMatchObject({ code: 'RETRY_COOLDOWN' })
  })

  it('enforces the daily creation quota', async () => {
    const sender = SENDERS[4]
    for (let index = 0; index < 3; index += 1) {
      await create(sender, await seedProject())
    }
    await expect(create(sender, await seedProject())).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('ProjectConnectionService.accept / ignore / contacts', () => {
  it('lets only the owner accept, then unlocks both authorized contacts', async () => {
    const sender = SENDERS[5]
    const projectId = await seedProject()
    const created = await create(sender, projectId, { email: 'SENDER@Example.COM', wechat: undefined })

    await expect(
      service.accept(sender, created.id, { wechat: 'wrong-party' }),
    ).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' })

    const accepted = await service.accept(OWNER, created.id, { phone: '138-0013-8000' })
    expect(accepted.status).toBe(ConnectionRequestStatus.Accepted)
    expect(accepted.contacts).toEqual({
      mine: { wechat: null, phone: '138-0013-8000', email: null },
      other: { wechat: null, phone: null, email: 'sender@example.com' },
    })

    const senderView = await service.contacts(sender, created.id)
    expect(senderView).toEqual({
      mine: { wechat: null, phone: null, email: 'sender@example.com' },
      other: { wechat: null, phone: '138-0013-8000', email: null },
    })
    await expect(service.contacts(SENDERS[6], created.id)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })
  })

  it('cancels Pending requests when the project is delisted and refuses accept', async () => {
    const sender = SENDERS[6]
    const projectId = await seedProject()
    const created = await create(sender, projectId)
    await db.update(projects).set({ status: ProjectStatus.Delisted }).where(eq(projects.id, projectId))

    await expect(service.accept(OWNER, created.id, { wechat: 'owner-wx' })).rejects.toMatchObject({
      code: 'REQUEST_NOT_PENDING',
    })
    const [row] = await db
      .select()
      .from(projectConnectionRequests)
      .where(eq(projectConnectionRequests.id, created.id))
    expect(row.status).toBe(ConnectionRequestStatus.Cancelled)
  })

  it('reports status gating flags and a unified list entry', async () => {
    const sender = SENDERS[7]
    const projectId = await seedProject()
    const created = await create(sender, projectId)

    expect(await service.statusFor(sender, projectId)).toMatchObject({
      data: { id: created.id, status: ConnectionRequestStatus.Pending },
      receiverConfigured: true,
      viewerIsReceiver: false,
    })
    expect(await service.statusFor(OWNER, projectId)).toMatchObject({ viewerIsReceiver: true })

    const list = await service.listForUser(OWNER)
    const item = list.data.find((entry) => entry.id === created.id)
    expect(item).toMatchObject({
      source: 'project',
      target: {
        type: 'project',
        projectId,
        url: `https://shenicest.test/projects/${projectId}`,
      },
      purpose: validBody.purpose,
    })
    expect(list.pendingReceived).toBeGreaterThanOrEqual(1)
  })
})
