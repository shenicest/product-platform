import { afterAll, describe, expect, it } from 'bun:test'
import { and, eq, inArray } from 'drizzle-orm'
import { ConnectionRequestStatus, HACKATHON_CONNECTION_PURPOSES } from '@shenicest/shared'
import { db } from '../../../src/db'
import {
  ConnectionDailyLimitScope,
  connectionDailyLimits,
  connectionNotificationDeliveries,
  hackathonConnectionRequests,
  hackathonProjectContacts,
} from '../../../src/db/schema'
import { decryptContact } from '../../../src/lib/contact-encryption'
import { NOTIFICATION_TYPES } from '../../../src/lib/mail/notification-types'
import { HACKATHON_EVENT_ID } from '../../../src/modules/hackathon/service'
import { HackathonConnectionService } from '../../../src/modules/hackathon-connection/service'

const contactConfig = { receiverUserId: '900001', notificationEmail: 'receiver@example.com' }
const contactRows: number[] = []
// Sender ids are unique per independent create-flow test: the 3/day limit is
// per sender per Beijing day, so a reused sender can silently run out of quota
// and flip the failing assertion to RATE_LIMITED.
const senderIds = [
  '900101', '900102', '900103', '900104', '900105', '900106', '900107', '900108', '900109',
  '900110', '900111', '900112', '900113', '900114', '900115', '900116', '900117', '900118',
]
let nextProjectId = 880000

function sourceStub() {
  return {
    getVisibleProject: async (hackathonProjectId: number) => ({ id: hackathonProjectId }),
    getProjectSummary: async (hackathonProjectId: number) => ({ name: `项目 ${hackathonProjectId}` }),
  }
}

const service = new HackathonConnectionService(db, sourceStub())
const invisibleSource = new HackathonConnectionService(db, {
  getVisibleProject: async () => null,
  getProjectSummary: async () => null,
})

async function seedContact(overrides: Partial<typeof hackathonProjectContacts.$inferInsert> = {}) {
  const hackathonProjectId = nextProjectId++
  const [row] = await db
    .insert(hackathonProjectContacts)
    .values({ eventId: HACKATHON_EVENT_ID, hackathonProjectId, ...contactConfig, ...overrides })
    .$returningId()
  contactRows.push(row.id)
  return hackathonProjectId
}

const validBody = {
  purpose: HACKATHON_CONNECTION_PURPOSES[1],
  message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。',
  wechat: 'sender-wechat',
}

function create(senderUserId: string, hackathonProjectId: number, overrides: Record<string, unknown> = {}) {
  return service.create(senderUserId, hackathonProjectId, { ...validBody, ...overrides } as typeof validBody)
}

afterAll(async () => {
  const requestRows = await db
    .select({ id: hackathonConnectionRequests.id })
    .from(hackathonConnectionRequests)
    .where(inArray(hackathonConnectionRequests.senderUserId, senderIds))
  if (requestRows.length) {
    await db.delete(connectionNotificationDeliveries).where(inArray(connectionNotificationDeliveries.connectionRequestId, requestRows.map((row) => row.id)))
  }
  await db.delete(hackathonConnectionRequests).where(inArray(hackathonConnectionRequests.senderUserId, senderIds))
  await db.delete(connectionDailyLimits).where(inArray(connectionDailyLimits.senderUserId, senderIds))
  if (contactRows.length) await db.delete(hackathonProjectContacts).where(inArray(hackathonProjectContacts.id, contactRows))
})

describe('HackathonConnectionService.create', () => {
  it('creates the request with locked receiver and a delivery task in one transaction', async () => {
    const sender = senderIds[0]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId)

    expect(created).toMatchObject({
      eventId: HACKATHON_EVENT_ID,
      hackathonProjectId,
      status: ConnectionRequestStatus.Pending,
    })
    expect(typeof created.id).toBe('number')
    expect(created.createdAt).toBeTruthy()

    const [row] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, created.id))
    expect(row.receiverUserId).toBe(contactConfig.receiverUserId)
    expect(row.pairKey).toBe(`${sender}:${hackathonProjectId}`)
    expect(row.message).toBe(validBody.message)
    expect(row.acceptedAt).toBeNull()
    expect(row.handledAt).toBeNull()
    // Contact is stored encrypted: no plaintext in DB, decrypts back.
    expect(row.senderContact).not.toContain('sender-wechat')
    expect(decryptContact(row.senderContact)).toEqual({ wechat: 'sender-wechat', email: null })

    const deliveries = await db
      .select()
      .from(connectionNotificationDeliveries)
      .where(eq(connectionNotificationDeliveries.connectionRequestId, created.id))
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      notificationType: NOTIFICATION_TYPES.CONNECTION_CREATED,
      recipientEmail: contactConfig.notificationEmail,
      status: 'Pending',
    })

    const [limit] = await db
      .select()
      .from(connectionDailyLimits)
      .where(and(eq(connectionDailyLimits.scope, ConnectionDailyLimitScope.HackathonConnection), eq(connectionDailyLimits.senderUserId, sender)))
    expect(limit.successfulCount).toBe(1)
  })

  it('rejects invisible projects, missing receivers, and self-connection', async () => {
    const sender = senderIds[1]
    await expect(invisibleSource.create(sender, 1, validBody)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })

    // A real project id that has no receiver row.
    const unconfigured = 899999
    await expect(create(sender, unconfigured)).rejects.toMatchObject({ code: 'NO_RECEIVER_CONFIGURED' })

    const own = await seedContact({ receiverUserId: sender })
    await expect(create(sender, own)).rejects.toMatchObject({ code: 'CANNOT_CONNECT_SELF' })
  })

  it('blocks duplicate Pending via the row check and concurrent transactions', async () => {
    const sender = senderIds[2]
    const hackathonProjectId = await seedContact()
    await create(sender, hackathonProjectId)
    await expect(create(sender, hackathonProjectId)).rejects.toMatchObject({ code: 'PENDING_EXISTS' })

    const concurrentProject = await seedContact()
    const results = await Promise.allSettled([
      create(sender, concurrentProject),
      create(sender, concurrentProject),
    ])
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'PENDING_EXISTS' })
  })

  it('blocks after Accepted and enforces the 7-day ignore cooldown', async () => {
    const sender = senderIds[3]
    const hackathonProjectId = await seedContact()
    await create(sender, hackathonProjectId)
    await db
      .update(hackathonConnectionRequests)
      .set({ status: ConnectionRequestStatus.Accepted, acceptedAt: new Date(), handledAt: new Date() })
      .where(eq(hackathonConnectionRequests.pairKey, `${sender}:${hackathonProjectId}`))
    await expect(create(sender, hackathonProjectId)).rejects.toMatchObject({ code: 'ALREADY_CONNECTED' })

    const cooldownProject = await seedContact()
    const ignored = await create(sender, cooldownProject)
    await db
      .update(hackathonConnectionRequests)
      .set({ status: ConnectionRequestStatus.Ignored, pairKey: null, handledAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .where(eq(hackathonConnectionRequests.id, ignored.id))
    await expect(create(sender, cooldownProject)).rejects.toMatchObject({ code: 'RETRY_COOLDOWN' })

    await db
      .update(hackathonConnectionRequests)
      .set({ handledAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
      .where(eq(hackathonConnectionRequests.id, ignored.id))
    const retried = await create(sender, cooldownProject)
    expect(retried.status).toBe(ConnectionRequestStatus.Pending)
  })

  it('treats the 7-day ignore cooldown as inclusive on the elapsed side', async () => {
    const baseRequest = {
      eventId: HACKATHON_EVENT_ID,
      receiverUserId: contactConfig.receiverUserId,
      purpose: HACKATHON_CONNECTION_PURPOSES[0],
      message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。',
      senderContact: 'iv.ciphertext.test',
    }
    // Just past the boundary (handled_at is second-precision, hence the 2s margin).
    const elapsedProject = await seedContact()
    await db.insert(hackathonConnectionRequests).values({
      ...baseRequest,
      hackathonProjectId: elapsedProject,
      senderUserId: senderIds[7],
      status: ConnectionRequestStatus.Ignored,
      pairKey: null,
      handledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 2000),
    })
    await expect(create(senderIds[7], elapsedProject)).resolves.toMatchObject({ status: ConnectionRequestStatus.Pending })

    // Just inside the boundary still rejects.
    const coolingProject = await seedContact()
    await db.insert(hackathonConnectionRequests).values({
      ...baseRequest,
      hackathonProjectId: coolingProject,
      senderUserId: senderIds[8],
      status: ConnectionRequestStatus.Ignored,
      pairKey: null,
      handledAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    })
    await expect(create(senderIds[8], coolingProject)).rejects.toMatchObject({ code: 'RETRY_COOLDOWN' })
  })

  it('limits creation to 3 per Beijing day across projects', async () => {
    const sender = senderIds[4]
    for (let index = 0; index < 3; index += 1) {
      const hackathonProjectId = await seedContact()
      await create(sender, hackathonProjectId)
    }
    const fourth = await seedContact()
    await expect(create(sender, fourth)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    const [limit] = await db
      .select()
      .from(connectionDailyLimits)
      .where(and(eq(connectionDailyLimits.scope, ConnectionDailyLimitScope.HackathonConnection), eq(connectionDailyLimits.senderUserId, sender)))
    expect(limit.successfulCount).toBe(3)
  })

  it('validates purpose, message, and contacts', async () => {
    const sender = senderIds[5]
    const hackathonProjectId = await seedContact()
    await expect(create(sender, hackathonProjectId, { purpose: '自由目的' } as unknown as typeof validBody)).rejects.toMatchObject({ code: 'INVALID_PURPOSE' })
    await expect(create(sender, hackathonProjectId, { message: '太短' })).rejects.toMatchObject({ code: 'INVALID_MESSAGE' })
    await expect(create(sender, hackathonProjectId, { message: ` ${'字'.repeat(29)} ` })).rejects.toMatchObject({ code: 'INVALID_MESSAGE' })
    await expect(create(sender, hackathonProjectId, { message: `${'字'.repeat(29)}\n还有一行凑足三十个字符` })).rejects.toMatchObject({ code: 'INVALID_MESSAGE' })
    await expect(create(sender, hackathonProjectId, { wechat: 'bad\nwechat' })).rejects.toMatchObject({ code: 'INVALID_CONTACT' })
    await expect(create(sender, hackathonProjectId, { wechat: 'a'.repeat(65) })).rejects.toMatchObject({ code: 'INVALID_CONTACT' })
    await expect(create(sender, hackathonProjectId, { email: 'not-an-email' })).rejects.toMatchObject({ code: 'INVALID_CONTACT' })
    await expect(create(sender, hackathonProjectId, { wechat: undefined, email: undefined })).rejects.toMatchObject({ code: 'INVALID_CONTACT' })
  })

  it('normalizes the email to lower-case inside the encrypted contact', async () => {
    const sender = senderIds[6]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId, { wechat: undefined, email: '  Person@Example.COM  ' })
    const [row] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, created.id))
    expect(row.senderContact).not.toContain('Person@Example')
    expect(decryptContact(row.senderContact)).toEqual({ wechat: null, email: 'person@example.com' })
  })
})

describe('HackathonConnectionService.statusFor', () => {
  it('returns null without records and the latest record otherwise', async () => {
    const sender = senderIds[5]
    expect(await service.statusFor(sender, 999999)).toBeNull()

    const hackathonProjectId = await seedContact()
    const first = await create(sender, hackathonProjectId)
    expect(await service.statusFor(sender, hackathonProjectId)).toMatchObject({ id: first.id, status: ConnectionRequestStatus.Pending })

    // Ignored the first, created a second: the latest wins.
    await db
      .update(hackathonConnectionRequests)
      .set({ status: ConnectionRequestStatus.Ignored, pairKey: null, handledAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
      .where(eq(hackathonConnectionRequests.id, first.id))
    const second = await create(sender, hackathonProjectId)
    const status = await service.statusFor(sender, hackathonProjectId)
    expect(status).toMatchObject({ id: second.id, status: ConnectionRequestStatus.Pending })
    expect(Object.keys(status as object).sort()).toEqual(['createdAt', 'id', 'status'])
    expect(JSON.stringify(status)).not.toContain('senderContact')
  })
})

describe('HackathonConnectionService.cancelPendingByProject', () => {
  it('cancels Pending requests and preserves Accepted ones', async () => {
    const pendingProject = await seedContact()
    const created = await create(senderIds[6], pendingProject)

    const acceptedProject = await seedContact()
    const accepted = await create(senderIds[6], acceptedProject)
    await db
      .update(hackathonConnectionRequests)
      .set({ status: ConnectionRequestStatus.Accepted, acceptedAt: new Date(), handledAt: new Date() })
      .where(eq(hackathonConnectionRequests.id, accepted.id))

    await service.cancelPendingByProject(HACKATHON_EVENT_ID, pendingProject)

    const [pendingRow] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, created.id))
    expect(pendingRow.status).toBe(ConnectionRequestStatus.Cancelled)
    expect(pendingRow.pairKey).toBeNull()
    expect(pendingRow.handledAt).not.toBeNull()

    const [acceptedRow] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, accepted.id))
    expect(acceptedRow.status).toBe(ConnectionRequestStatus.Accepted)
    expect(acceptedRow.pairKey).toBe(`${senderIds[6]}:${acceptedProject}`)
  })
})

const receiver = contactConfig.receiverUserId

describe('HackathonConnectionService.accept', () => {
  it('lets only the locked receiver accept, storing encrypted contact and acceptance timestamps', async () => {
    const sender = senderIds[10]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId)

    // Non-receivers — including the sender — get 404; existence is not leaked.
    await expect(service.accept(sender, created.id, { wechat: 'x' })).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' })
    await expect(service.accept('900199', created.id, { wechat: 'x' })).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' })
    await expect(service.ignore(sender, created.id)).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' })

    // Missing contact is rejected before any state changes.
    await expect(service.accept(receiver, created.id, {})).rejects.toMatchObject({ code: 'INVALID_CONTACT' })
    expect(await service.statusFor(sender, hackathonProjectId)).toMatchObject({ status: ConnectionRequestStatus.Pending })

    const view = await service.accept(receiver, created.id, { wechat: '  receiver-wx  ', email: 'Receiver@Example.COM' })
    expect(view).toMatchObject({
      id: created.id,
      source: 'hackathon',
      status: ConnectionRequestStatus.Accepted,
      senderUserId: sender,
      receiverUserId: receiver,
    })
    expect(view.target).toMatchObject({ type: 'hackathon_project', projectId: hackathonProjectId, eventId: HACKATHON_EVENT_ID, name: `项目 ${hackathonProjectId}` })
    expect(view.contacts!.mine).toEqual({ wechat: 'receiver-wx', email: 'receiver@example.com' })
    expect(view.contacts!.other).toEqual({ wechat: 'sender-wechat', email: null })
    expect(view.acceptedAt).toBeTruthy()
    expect(view.handledAt).toBeTruthy()

    const [row] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, created.id))
    expect(row.status).toBe(ConnectionRequestStatus.Accepted)
    expect(row.pairKey).toBeNull()
    expect(row.acceptedAt).not.toBeNull()
    expect(row.handledAt).not.toBeNull()
    expect(row.receiverContact).not.toContain('receiver-wx')
    expect(decryptContact(row.receiverContact)).toEqual({ wechat: 'receiver-wx', email: 'receiver@example.com' })
  })

  it('returns the original record on repeated accept without overwriting contact', async () => {
    const sender = senderIds[11]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId)
    const first = await service.accept(receiver, created.id, { wechat: 'original-wx' })

    const second = await service.accept(receiver, created.id, { email: 'changed@example.com' })
    expect(second.status).toBe(ConnectionRequestStatus.Accepted)
    expect(second.contacts!.mine).toEqual({ wechat: 'original-wx', email: null })
    expect(second.acceptedAt).toBe(first.acceptedAt)

    const [row] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, created.id))
    expect(decryptContact(row.receiverContact)).toEqual({ wechat: 'original-wx', email: null })
  })

  it('rejects accept on cancelled requests with the cancel persisted', async () => {
    const sender = senderIds[12]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId)
    await service.cancelPendingByProject(HACKATHON_EVENT_ID, hackathonProjectId)

    await expect(service.accept(receiver, created.id, { wechat: 'x' })).rejects.toMatchObject({ code: 'REQUEST_NOT_PENDING' })
  })

  it('cancels the pending request and reports 409 when the project is hidden', async () => {
    const sender = senderIds[13]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId)

    // The hidden check runs before contact validation: an empty body still 409s
    // (not 400) and the cancel is persisted.
    await expect(invisibleSource.accept(receiver, created.id, {})).rejects.toMatchObject({ code: 'REQUEST_NOT_PENDING' })

    const [row] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, created.id))
    expect(row.status).toBe(ConnectionRequestStatus.Cancelled)
    expect(row.pairKey).toBeNull()
    expect(row.handledAt).not.toBeNull()
    expect(row.receiverContact).toBeNull()
  })
})

describe('HackathonConnectionService.ignore', () => {
  it('ignores once, stays idempotent, and preserves the authorized contact of accepted rows', async () => {
    const sender = senderIds[14]
    const ignoredProject = await seedContact()
    const created = await create(sender, ignoredProject)

    await expect(service.ignore('900199', created.id)).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND' })

    const view = await service.ignore(receiver, created.id)
    expect(view.status).toBe(ConnectionRequestStatus.Ignored)
    expect(view.handledAt).toBeTruthy()
    expect(view.contacts).toBeUndefined()
    const repeated = await service.ignore(receiver, created.id)
    expect(repeated.status).toBe(ConnectionRequestStatus.Ignored)
    expect(repeated.handledAt).toBe(view.handledAt)

    const [row] = await db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, created.id))
    expect(row.pairKey).toBeNull()
    expect(row.senderContact).not.toContain('sender-wechat')

    // An accepted request can no longer be ignored.
    const acceptedProject = await seedContact()
    const accepted = await create(sender, acceptedProject)
    await service.accept(receiver, accepted.id, { wechat: 'receiver-wx' })
    await expect(service.ignore(receiver, accepted.id)).rejects.toMatchObject({ code: 'REQUEST_NOT_PENDING' })
  })

  it('lets the sender re-apply after the cooldown following an ignore', async () => {
    const sender = senderIds[15]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId)
    await service.ignore(receiver, created.id)

    await expect(create(sender, hackathonProjectId)).rejects.toMatchObject({ code: 'RETRY_COOLDOWN' })

    await db
      .update(hackathonConnectionRequests)
      .set({ handledAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
      .where(eq(hackathonConnectionRequests.id, created.id))
    const retried = await create(sender, hackathonProjectId)
    expect(retried.id).not.toBe(created.id)
    expect(retried.status).toBe(ConnectionRequestStatus.Pending)
  })
})

describe('HackathonConnectionService.contacts', () => {
  it('unlocks mine/other contacts for both parties only after acceptance', async () => {
    const sender = senderIds[10]
    const hackathonProjectId = await seedContact()
    const created = await create(sender, hackathonProjectId)

    // Pending: nobody may read contacts.
    await expect(service.contacts(sender, created.id)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })
    await expect(service.contacts(receiver, created.id)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })
    await expect(service.contacts('900199', created.id)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })
    // A missing record is indistinguishable from a forbidden one.
    await expect(service.contacts(receiver, 99999999)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })

    await service.accept(receiver, created.id, { wechat: 'receiver-wx' })

    const asSender = await service.contacts(sender, created.id)
    expect(asSender.mine).toEqual({ wechat: 'sender-wechat', email: null })
    expect(asSender.other).toEqual({ wechat: 'receiver-wx', email: null })

    const asReceiver = await service.contacts(receiver, created.id)
    expect(asReceiver.mine).toEqual({ wechat: 'receiver-wx', email: null })
    expect(asReceiver.other).toEqual({ wechat: 'sender-wechat', email: null })

    await expect(service.contacts('900199', created.id)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })

    // Ignored and Cancelled states never unlock contacts.
    const ignoredProject = await seedContact()
    const ignored = await create(senderIds[16], ignoredProject)
    await service.ignore(receiver, ignored.id)
    await expect(service.contacts(senderIds[16], ignored.id)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })

    const cancelledProject = await seedContact()
    const cancelled = await create(senderIds[17], cancelledProject)
    await service.cancelPendingByProject(HACKATHON_EVENT_ID, cancelledProject)
    await expect(service.contacts(receiver, cancelled.id)).rejects.toMatchObject({ code: 'CONTACTS_FORBIDDEN' })
  })
})
