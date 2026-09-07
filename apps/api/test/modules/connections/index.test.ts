import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { inArray, or } from 'drizzle-orm'
import { ConnectionRequestStatus } from '@shenicest/shared'
import { db } from '../../../src/db'
import {
  connectionDailyLimits,
  connectionNotificationDeliveries,
  connectionRequests,
  hackathonConnectionDailyLimits,
  hackathonConnectionRequests,
  hackathonProjectContacts,
  talentProfiles,
} from '../../../src/db/schema'
import { HACKATHON_EVENT_ID } from '../../../src/modules/hackathon/service'
import { HackathonConnectionService } from '../../../src/modules/hackathon-connection/service'
import { ConnectionsService } from '../../../src/modules/connections/service'
import { connectionsModule } from '../../../src/modules/connections'
import { TalentService } from '../../../src/modules/talent/service'
import { authHeaders, signToken } from '../../fixtures/auth'

const VIEWER = '900301'
const T1 = '901301'
const T2 = '901302'
const T3 = '901303'
const VIEWER2 = '900401'
const HACK_SENDER_1 = '900501'
const HACK_SENDER_2 = '900502'
const HACK_SENDER_3 = '900503'
const HACK_SENDER_4 = '900504'
const HACK_RECEIVER = '900002'
const allUsers = [VIEWER, T1, T2, T3, VIEWER2, HACK_SENDER_1, HACK_SENDER_2, HACK_SENDER_3, HACK_SENDER_4]

const talentService = new TalentService(db)
const hackathonService = new HackathonConnectionService(db, {
  getVisibleProject: async (hackathonProjectId: number) => ({ id: hackathonProjectId }),
  getProjectSummary: async (hackathonProjectId: number) => ({
    name: `项目 ${hackathonProjectId}`,
    url: `https://shenicest.test/hackathon/projects/${hackathonProjectId}`,
  }),
})
// Same wiring as the module index, with only the event-db seam stubbed.
const aggregate = new ConnectionsService({
  talentConnections: (userId) => talentService.connections(userId),
  hackathonConnections: (userId) => hackathonService.listForUser(userId),
})

const talentProfileBody = {
  headline: '全栈产品搭档',
  bio: '擅长从用户研究到产品交付，希望与认真解决真实问题的团队长期合作。',
  city: '上海',
  roles: ['开发'],
  skills: ['前端开发', '后端开发', '全栈开发'],
  seekingSkills: [],
  domains: ['效率工具'],
  durations: ['长期合作'],
}

const talentMessage = '希望一起推进这个产品并验证市场需求，认真讨论合作方式并尽快开始执行。'
const message = talentMessage
const contactRows: number[] = []
let nextProjectId = 871000

async function seedContact(hackathonProjectId: number, overrides: Partial<typeof hackathonProjectContacts.$inferInsert> = {}) {
  const [row] = await db
    .insert(hackathonProjectContacts)
    .values({
      eventId: HACKATHON_EVENT_ID,
      hackathonProjectId,
      receiverUserId: HACK_RECEIVER,
      notificationEmail: 'r@example.com',
      ...overrides,
    })
    .$returningId()
  contactRows.push(row.id!)
}

function createHackathon(sender: string, hackathonProjectId: number, overrides: Record<string, unknown> = {}) {
  return hackathonService.create(
    sender,
    hackathonProjectId,
    {
      purpose: '合作交流',
      message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。',
      wechat: `hack-${sender}-wx`,
      ...overrides,
    },
  )
}

beforeAll(async () => {
  // Talent source: a Pending request addressed to the viewer, and an Accepted
  // one where the viewer is the sender. Receivers need Published profiles.
  await talentService.publish(VIEWER, talentProfileBody)
  await talentService.publish(VIEWER2, talentProfileBody)
  await talentService.publish(T1, talentProfileBody)
  await talentService.publish(T2, talentProfileBody)
  await talentService.publish(T3, talentProfileBody)
  expect((await talentService.send(T1, { receiverUserId: VIEWER, purpose: '短期协作', message, wechat: 't1-wx' })).id).toBeTruthy()
  const acceptedTalent = await talentService.send(VIEWER, {
    receiverUserId: T2,
    purpose: '短期协作',
    message,
    wechat: 'viewer-wx-talent',
    email: 'VIEWER-TALENT@Example.COM',
  })
  await talentService.accept(T2, acceptedTalent.id, { email: 'T2@Example.com' })

  // Hackathon source: Pending received, Accepted received, Pending sent, Ignored.
  await seedContact(nextProjectId, { receiverUserId: VIEWER })
  await createHackathon(HACK_SENDER_1, nextProjectId)
  await seedContact(nextProjectId + 1, { receiverUserId: VIEWER })
  const acceptedHackathon = await createHackathon(HACK_SENDER_2, nextProjectId + 1)
  await hackathonService.accept(VIEWER, (acceptedHackathon as { id: number }).id, {
    wechat: 'viewer-wx-hack',
    email: 'VIEWER-HACK@Example.COM',
  })
  await seedContact(nextProjectId + 2)
  await createHackathon(VIEWER, nextProjectId + 2)
  await seedContact(nextProjectId + 3, { receiverUserId: VIEWER })
  const ignoredHackathon = await createHackathon(HACK_SENDER_3, nextProjectId + 3)
  await hackathonService.ignore(VIEWER, (ignoredHackathon as { id: number }).id)
})

afterAll(async () => {
  const userIds = [...allUsers, HACK_RECEIVER]
  await db.delete(connectionRequests).where(
    or(
      inArray(connectionRequests.senderUserId, userIds),
      inArray(connectionRequests.receiverUserId, userIds),
    ),
  )
  await db.delete(connectionDailyLimits).where(inArray(connectionDailyLimits.senderUserId, userIds))
  await db.delete(talentProfiles).where(inArray(talentProfiles.userId, userIds))

  const requestRows = await db
    .select({ id: hackathonConnectionRequests.id })
    .from(hackathonConnectionRequests)
    .where(
      or(
        inArray(hackathonConnectionRequests.senderUserId, allUsers),
        inArray(hackathonConnectionRequests.receiverUserId, allUsers),
      ),
    )
  if (requestRows.length) {
    await db.delete(connectionNotificationDeliveries).where(inArray(connectionNotificationDeliveries.connectionRequestId, requestRows.map((row) => row.id)))
    await db.delete(hackathonConnectionRequests).where(inArray(hackathonConnectionRequests.id, requestRows.map((row) => row.id)))
  }
  await db.delete(hackathonConnectionDailyLimits).where(inArray(hackathonConnectionDailyLimits.senderUserId, allUsers))
  if (contactRows.length) await db.delete(hackathonProjectContacts).where(inArray(hackathonProjectContacts.id, contactRows))
})

describe('ConnectionsService (service level)', () => {
  it('merges both sources into the unified shape', async () => {
    const result = await aggregate.connections(VIEWER)
    const talentItem = result.data.find((item) => item.source === 'talent' && item.receiverUserId === VIEWER)
    const hackathonAccepted = result.data.find((item) => item.source === 'hackathon' && item.status === ConnectionRequestStatus.Accepted)

    expect(talentItem).toMatchObject({
      source: 'talent',
      status: ConnectionRequestStatus.Pending,
      senderUserId: T1,
      receiverUserId: VIEWER,
    })
    expect(talentItem!.sender).toMatchObject({ userId: T1, nickname: null, hasPublishedTalentProfile: true })
    expect(talentItem!.target).toEqual({ type: 'talent_user' })

    expect(hackathonAccepted!.target).toMatchObject({
      type: 'hackathon_project',
      name: `项目 ${nextProjectId + 1}`,
      url: `https://shenicest.test/hackathon/projects/${nextProjectId + 1}`,
      eventId: HACKATHON_EVENT_ID,
    })
    expect(hackathonAccepted!.sender).toMatchObject({ userId: HACK_SENDER_2, hasPublishedTalentProfile: false })
    expect(hackathonAccepted!.contacts!.mine).toEqual({ wechat: 'viewer-wx-hack', email: 'viewer-hack@example.com' })
    expect(hackathonAccepted!.contacts!.other).toEqual({ wechat: `hack-${HACK_SENDER_2}-wx`, email: null })
  })

  it('puts pending-received requests first, then newest first', async () => {
    const result = await aggregate.connections(VIEWER)
    const pendingReceived = result.data.slice(0, 2).every(
      (item) => item.status === ConnectionRequestStatus.Pending && item.receiverUserId === VIEWER,
    )
    expect(pendingReceived).toBe(true)
    const rest = result.data.slice(2)
    for (let index = 1; index < rest.length; index += 1) {
      expect(rest[index - 1].createdAt >= rest[index].createdAt).toBe(true)
    }
  })

  it('filters by source and direction', async () => {
    const talentOnly = (await aggregate.connections(VIEWER, { source: 'talent' })).data
    expect(talentOnly.length).toBeGreaterThan(0)
    expect(talentOnly.every((item) => item.source === 'talent')).toBe(true)
    const hackathonOnly = (await aggregate.connections(VIEWER, { source: 'hackathon' })).data
    expect(hackathonOnly.length).toBeGreaterThan(0)
    expect(hackathonOnly.every((item) => item.source === 'hackathon')).toBe(true)

    const sent = (await aggregate.connections(VIEWER, { direction: 'sent' })).data
    expect(sent.length).toBeGreaterThan(0)
    expect(sent.every((item) => item.senderUserId === VIEWER)).toBe(true)
    expect(sent.some((item) => item.source === 'talent')).toBe(true)
    expect(sent.some((item) => item.source === 'hackathon')).toBe(true)

    const received = (await aggregate.connections(VIEWER, { direction: 'received' })).data
    expect(received.every((item) => item.receiverUserId === VIEWER)).toBe(true)
  })

  it('sums pendingReceived per selected source, consistent with the talent endpoint', async () => {
    expect((await aggregate.connections(VIEWER)).pendingReceived).toBe(2)
    expect((await aggregate.connections(VIEWER, { source: 'talent' })).pendingReceived).toBe(1)
    expect((await aggregate.connections(VIEWER, { source: 'hackathon' })).pendingReceived).toBe(1)

    // Cross-check against the untouched talent endpoint for the talent part.
    const talentResult = await talentService.connections(VIEWER)
    expect((await aggregate.connections(VIEWER, { source: 'talent' })).pendingReceived).toBe(talentResult.pendingReceived)
  })

  it('exposes contacts only for accepted talents viewed by a party', async () => {
    const asViewer = await aggregate.connections(VIEWER, { source: 'talent' })
    const accepted = asViewer.data.find((item) => item.status === ConnectionRequestStatus.Accepted)!
    expect(accepted.contacts!.mine).toEqual({ wechat: 'viewer-wx-talent', email: 'viewer-talent@example.com' })
    expect(accepted.contacts!.other).toEqual({ wechat: null, email: 't2@example.com' })
    const pending = asViewer.data.find((item) => item.status === ConnectionRequestStatus.Pending)!
    expect(pending.contacts).toBeUndefined()

    // The counterpart viewer (receiver of the accepted request) sees their own mine/other orientation.
    const asT2 = await aggregate.connections(T2, { source: 'talent' })
    const acceptedAsT2 = asT2.data.find((item) => item.status === ConnectionRequestStatus.Accepted)!
    expect(acceptedAsT2.contacts!.mine).toEqual({ wechat: null, email: 't2@example.com' })
    expect(acceptedAsT2.contacts!.other).toEqual({ wechat: 'viewer-wx-talent', email: 'viewer-talent@example.com' })
  })

  it('never leaks contact ciphertext in the aggregated payload', async () => {
    const result = await aggregate.connections(VIEWER)
    const hackathonCiphertexts = await db
      .select({ senderContact: hackathonConnectionRequests.senderContact, receiverContact: hackathonConnectionRequests.receiverContact })
      .from(hackathonConnectionRequests)
    const talentCiphertexts = await db
      .select({ senderContact: connectionRequests.senderContact, receiverContact: connectionRequests.receiverContact })
      .from(connectionRequests)
    const payload = JSON.stringify(result)
    for (const row of [...hackathonCiphertexts, ...talentCiphertexts]) {
      expect(payload).not.toContain(row.senderContact)
      if (row.receiverContact) expect(payload).not.toContain(row.receiverContact)
    }
  })
})

describe('GET /connections (module level)', () => {
  const app = new Elysia().use(connectionsModule)

  it('requires authentication', async () => {
    const response = await app.handle(new Request('http://localhost/connections'))
    expect(response.status).toBe(401)
  })

  it('aggregates talent rows for a viewer without hackathon data', async () => {
    // VIEWER2 has no hackathon requests, so the aggregate never touches the
    // (stubbed) event database through the real module wiring. T3 was published
    // in beforeAll.
    await talentService.send(T3, { receiverUserId: VIEWER2, purpose: '共同创业', message, wechat: 't3-wx' })
    const token = await signToken({ user_id: VIEWER2 })

    const response = await app.handle(new Request('http://localhost/connections?source=talent', {
      headers: authHeaders(token),
    }))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.pendingReceived).toBe(1)
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({ source: 'talent', status: ConnectionRequestStatus.Pending, receiverUserId: VIEWER2 })
    expect((await app.handle(new Request('http://localhost/connections?source=hackathon', { headers: authHeaders(token) })).then((res) => res.json())).data).toHaveLength(0)
  })
})
