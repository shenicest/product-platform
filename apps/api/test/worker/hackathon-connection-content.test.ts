import { afterAll, describe, expect, it } from 'bun:test'
import { inArray } from 'drizzle-orm'
import { db } from '../../src/db'
import { hackathonConnectionRequests } from '../../src/db/schema'
import { NOTIFICATION_TYPES } from '../../src/lib/mail/notification-types'
import { createHackathonConnectionContentResolver } from '../../src/worker/hackathon-connection-content'

const insertedRequestIds: number[] = []
let nextProjectId = 5000

async function insertRequest(overrides: Partial<typeof hackathonConnectionRequests.$inferInsert> = {}) {
  const hackathonProjectId = nextProjectId++
  const [row] = await db
    .insert(hackathonConnectionRequests)
    .values({
      eventId: 4,
      hackathonProjectId,
      receiverUserId: '10',
      senderUserId: '11',
      purpose: '合作交流',
      message: '希望交流产品设计经验。',
      senderContact: 'iv.ciphertext.test',
      status: 0,
      ...overrides,
    })
    .$returningId()
  insertedRequestIds.push(row.id)
  return { id: row.id, hackathonProjectId }
}

function buildResolver(overrides: Partial<Parameters<typeof createHackathonConnectionContentResolver>[0]> = {}) {
  return createHackathonConnectionContentResolver({
    db,
    getProjectSummary: async (hackathonProjectId) => ({ name: `项目 ${hackathonProjectId}` }),
    getSenderNickname: async () => '林晓',
    webBaseUrl: 'https://shenicest.test/',
    ...overrides,
  })
}

const taskFor = (connectionRequestId: number) => ({
  id: connectionRequestId,
  connectionRequestId,
  notificationType: NOTIFICATION_TYPES.CONNECTION_CREATED,
  recipientEmail: 'receiver@example.com',
})

afterAll(async () => {
  if (insertedRequestIds.length) {
    await db.delete(hackathonConnectionRequests).where(inArray(hackathonConnectionRequests.id, insertedRequestIds))
  }
})

describe('createHackathonConnectionContentResolver', () => {
  it('renders the created-email template from the request row and project summary', async () => {
    const request = await insertRequest()
    const resolver = buildResolver()

    const content = await resolver(taskFor(request.id))
    expect(content).not.toBeNull()
    expect(content!.subject).toBe('[Shenicest] 你的黑客松项目收到一条新的建联申请')
    expect(content!.html).toContain(`项目 ${request.hackathonProjectId}`)
    expect(content!.html).toContain('林晓')
    expect(content!.html).toContain('合作交流')
    expect(content!.html).toContain('希望交流产品设计经验。')
    expect(content!.html).toContain(`href="https://shenicest.test/hackathon/projects/${request.hackathonProjectId}"`)
    expect(content!.html).toContain('href="https://shenicest.test/connections"')
    expect(content!.text).toContain('希望交流产品设计经验。')
  })

  it('falls back to 平台用户 when the sender has no public nickname', async () => {
    const request = await insertRequest()
    const resolver = buildResolver({ getSenderNickname: async () => null })

    const content = await resolver(taskFor(request.id))
    expect(content!.html).toContain('平台用户')
  })

  it('returns null when the request row is gone', async () => {
    const resolver = buildResolver()
    expect(await resolver(taskFor(99999999))).toBeNull()
  })

  it('returns null when the project summary is unavailable', async () => {
    const request = await insertRequest()
    const resolver = buildResolver({ getProjectSummary: async () => null })

    expect(await resolver(taskFor(request.id))).toBeNull()
  })

  it('returns null for unknown notification types', async () => {
    const resolver = buildResolver()
    expect(
      await resolver({ id: 1, connectionRequestId: 1, notificationType: 'something_else', recipientEmail: 'r@e.com' }),
    ).toBeNull()
  })
})
