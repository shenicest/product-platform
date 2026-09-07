import { afterAll, describe, expect, it } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../src/db'
import { connectionNotificationDeliveries } from '../../src/db/schema'
import { InMemoryMailer, MailSendError, type Mailer } from '../../src/lib/mail/mailer'
import { NOTIFICATION_TYPES } from '../../src/lib/mail/notification-types'
import { DELIVERY_STATUS, MailWorker, type DeliveryTask } from '../../src/worker/mail-worker'

const content = { subject: 'Test subject', html: '<p>Test</p>', text: 'Test' }
const resolveContent = async (): Promise<typeof content> => content

// Mutable test clock: the worker asks `now()` on every operation, so tests
// advance time by moving `nowMs` forward — no sleeping, no DB surgery.
let nowMs = Date.now()
const clock = () => new Date(nowMs)
const advanceMinutes = (minutes: number) => {
  nowMs += minutes * 60_000
}

const insertedIds: number[] = []
let nextRequestId = 9001

async function insertDelivery(overrides: Partial<typeof connectionNotificationDeliveries.$inferInsert> = {}) {
  const connectionRequestId = nextRequestId++
  const [row] = await db
    .insert(connectionNotificationDeliveries)
    .values({
      connectionRequestId,
      notificationType: NOTIFICATION_TYPES.CONNECTION_CREATED,
      recipientEmail: 'receiver@example.com',
      status: DELIVERY_STATUS.Pending,
      ...overrides,
    })
    .$returningId()
  insertedIds.push(row.id)
  return { id: row.id, connectionRequestId }
}

async function getDelivery(id: number) {
  const [row] = await db
    .select()
    .from(connectionNotificationDeliveries)
    .where(eq(connectionNotificationDeliveries.id, id))
    .limit(1)
  return row
}

function buildWorker(mailer: Mailer, resolve: (task: DeliveryTask) => Promise<typeof content | null> = resolveContent) {
  return new MailWorker({ db, mailer, resolveContent: resolve, now: clock })
}

const keyFor = (connectionRequestId: number) => `${connectionRequestId}:${NOTIFICATION_TYPES.CONNECTION_CREATED}`

afterAll(async () => {
  if (insertedIds.length) {
    await db.delete(connectionNotificationDeliveries).where(inArray(connectionNotificationDeliveries.id, insertedIds))
  }
})

describe('MailWorker.tick', () => {
  it('claims a Pending row, sends it exactly once, and marks it Sent', async () => {
    const mailer = new InMemoryMailer()
    const worker = buildWorker(mailer)
    const delivery = await insertDelivery()

    await worker.tick()
    const sent = await getDelivery(delivery.id)
    expect(sent.status).toBe(DELIVERY_STATUS.Sent)
    expect(sent.attemptCount).toBe(1)
    expect(sent.providerMessageId).toBe('in-memory-1')
    expect(sent.sentAt).not.toBeNull()
    expect(mailer.calls).toHaveLength(1)
    expect(mailer.calls[0].idempotencyKey).toBe(keyFor(delivery.connectionRequestId))
    expect(mailer.calls[0].to).toBe('receiver@example.com')

    // A second poll must not resend the same idempotency key.
    await worker.tick()
    expect(mailer.calls).toHaveLength(1)
  })

  it('does not claim a Pending row before its backoff elapses, then retries it', async () => {
    const mailer = new InMemoryMailer()
    const worker = buildWorker(mailer)
    const delivery = await insertDelivery()

    await worker.tick()
    expect(await getDelivery(delivery.id)).toMatchObject({ status: DELIVERY_STATUS.Sent, attemptCount: 1 })

    // Fresh Pending row: first attempt runs immediately, but a failed attempt
    // must wait out the 1-minute backoff before the retry.
    const failing = buildWorker(new FailingMailer('SendLimitExceeded'), resolveContent)
    const retry = await insertDelivery()
    await failing.tick()
    expect(await getDelivery(retry.id)).toMatchObject({ status: DELIVERY_STATUS.Pending, attemptCount: 1, lastErrorCode: 'SendLimitExceeded' })

    await failing.tick()
    expect(await getDelivery(retry.id)).toMatchObject({ status: DELIVERY_STATUS.Pending, attemptCount: 1 })

    advanceMinutes(2)
    const mailerAfterBackoff = new InMemoryMailer()
    const recovering = new MailWorker({ db, mailer: mailerAfterBackoff, resolveContent: resolveContent, now: clock })
    await recovering.tick()
    expect(await getDelivery(retry.id)).toMatchObject({ status: DELIVERY_STATUS.Sent, attemptCount: 2 })
    expect(mailerAfterBackoff.calls).toHaveLength(1)
  })

  it('marks a delivery Failed after the third failed attempt', async () => {
    const worker = buildWorker(new FailingMailer('InvalidParameter'))
    const delivery = await insertDelivery()

    await worker.tick()
    advanceMinutes(2)
    await worker.tick()
    advanceMinutes(6)
    await worker.tick()

    expect(await getDelivery(delivery.id)).toMatchObject({ status: DELIVERY_STATUS.Failed, attemptCount: 3, lastErrorCode: 'InvalidParameter' })

    // Failed rows are never retried.
    advanceMinutes(60)
    await worker.tick()
    expect(await getDelivery(delivery.id)).toMatchObject({ status: DELIVERY_STATUS.Failed, attemptCount: 3 })
  })

  it('reclaims a stale Sending row but leaves a fresh one alone', async () => {
    const mailer = new InMemoryMailer()
    const worker = buildWorker(mailer)
    const stale = await insertDelivery({
      status: DELIVERY_STATUS.Sending,
      attemptCount: 1,
      lastAttemptAt: new Date(nowMs - 11 * 60_000),
    })
    advanceMinutes(1)
    const fresh = await insertDelivery({
      status: DELIVERY_STATUS.Sending,
      attemptCount: 1,
      lastAttemptAt: new Date(nowMs),
    })

    await worker.tick()
    expect(await getDelivery(stale.id)).toMatchObject({ status: DELIVERY_STATUS.Sent, attemptCount: 2 })
    expect(await getDelivery(fresh.id)).toMatchObject({ status: DELIVERY_STATUS.Sending, attemptCount: 1 })
    expect(mailer.calls.map((call) => call.idempotencyKey)).toEqual([keyFor(stale.connectionRequestId)])
  })

  it('marks the delivery Failed when the content can never be resolved', async () => {
    const worker = buildWorker(new InMemoryMailer(), async () => null)
    const delivery = await insertDelivery()

    await worker.tick()
    expect(await getDelivery(delivery.id)).toMatchObject({ status: DELIVERY_STATUS.Failed, lastErrorCode: 'CONTENT_UNAVAILABLE' })
  })

  it('retries when content resolution fails transiently', async () => {
    let calls = 0
    const worker = buildWorker(new InMemoryMailer(), async () => {
      calls += 1
      if (calls === 1) throw new Error('db hiccup')
      return content
    })
    const delivery = await insertDelivery()

    await worker.tick()
    expect(await getDelivery(delivery.id)).toMatchObject({ status: DELIVERY_STATUS.Pending, attemptCount: 1, lastErrorCode: 'CONTENT_RESOLVE_ERROR' })

    advanceMinutes(2)
    await worker.tick()
    expect(await getDelivery(delivery.id)).toMatchObject({ status: DELIVERY_STATUS.Sent, attemptCount: 2 })
  })

  it('processes several eligible rows in one tick', async () => {
    const mailer = new InMemoryMailer()
    const worker = buildWorker(mailer)
    const deliveries = [await insertDelivery(), await insertDelivery(), await insertDelivery()]

    await worker.tick()
    const statuses = await Promise.all(deliveries.map(async (delivery) => (await getDelivery(delivery.id)).status))
    expect(statuses).toEqual([DELIVERY_STATUS.Sent, DELIVERY_STATUS.Sent, DELIVERY_STATUS.Sent])
    expect(mailer.calls).toHaveLength(3)
  })
})

class FailingMailer implements Mailer {
  constructor(private readonly code: string) {}
  async send(): Promise<never> {
    throw new MailSendError(this.code, 'provider error')
  }
}
