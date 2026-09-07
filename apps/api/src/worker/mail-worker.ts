import { and, eq, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import type { Database } from '../db'
import { connectionNotificationDeliveries } from '../db/schema'
import { logEvent } from '../lib/log-event'
import { MailSendError, type EmailContent, type Mailer } from '../lib/mail/mailer'

export const DELIVERY_STATUS = {
  Pending: 'Pending',
  Sending: 'Sending',
  Sent: 'Sent',
  Failed: 'Failed',
} as const

// Max send attempts per delivery row. Backoff per completed attempt:
// 1min / 5min / 30min (the last entry only applies if MAX_ATTEMPTS is raised).
const MAX_ATTEMPTS = 3
const BACKOFF_MINUTES: Record<number, number> = { 1: 1, 2: 5, 3: 30 }
// A Sending row older than this is a dead owner (crash between claim and
// terminal update) and may be reclaimed by any worker instance.
const STALE_SENDING_MINUTES = 10

// Single source of truth for the per-attempt backoff, mirrored into the claim
// predicate's SQL CASE below.
const BACKOFF_CASE = sql`(CASE ${connectionNotificationDeliveries.attemptCount} ${sql.raw(
  Object.entries(BACKOFF_MINUTES)
    .map(([attempt, minutes]) => `WHEN ${attempt} THEN ${minutes}`)
    .join(' '),
)} ELSE 0 END)`

export interface DeliveryTask {
  id: number
  connectionRequestId: number
  notificationType: string
  recipientEmail: string
}

export type ContentResolver = (task: DeliveryTask) => Promise<EmailContent | null>

export interface MailWorkerOptions {
  db: Database
  mailer: Mailer
  resolveContent: ContentResolver
  pollIntervalMs?: number
  batchSize?: number
  // Injectable clock so tests can advance time without sleeping.
  now?: () => Date
}

// In-process polling worker for connection_notification_deliveries (D6).
// Delivery rows are claimed with a conditional UPDATE latch (Pending → Sending,
// affectedRows = 1 wins), so running several API instances is safe: only the
// instance that flips the row actually sends. Outcome writes are additionally
// guarded by the claimed attempt count, so a late write from a stale-reclaimed
// owner can never clobber the newer owner's state.
export class MailWorker {
  private timer: ReturnType<typeof setInterval> | undefined
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly options: MailWorkerOptions) {}

  start(): void {
    if (this.timer) return
    const pollIntervalMs = this.options.pollIntervalMs ?? 30000
    this.timer = setInterval(() => {
      this.queue = this.queue
        .then(() => this.tick())
        .catch((err) => console.error('[mail-worker] tick failed:', err))
    }, pollIntervalMs)
    this.timer.unref?.()
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    await this.queue
  }

  // One poll cycle: claim up to batchSize eligible rows and deliver them.
  async tick(): Promise<void> {
    const { db, batchSize = 10 } = this.options
    const tasks = await db
      .select({
        id: connectionNotificationDeliveries.id,
        connectionRequestId: connectionNotificationDeliveries.connectionRequestId,
        notificationType: connectionNotificationDeliveries.notificationType,
        recipientEmail: connectionNotificationDeliveries.recipientEmail,
      })
      .from(connectionNotificationDeliveries)
      .where(this.eligible())
      .orderBy(connectionNotificationDeliveries.id)
      .limit(batchSize)
    for (const task of tasks) {
      const attempt = await this.claim(task.id)
      if (attempt === null) continue
      await this.deliver(task, attempt)
    }
  }

  // Rows are eligible when Pending and their per-attempt backoff has elapsed,
  // or when a Sending row is stale (owner died mid-send).
  private eligible(): SQL | undefined {
    const now = this.clock()
    return or(
      and(
        eq(connectionNotificationDeliveries.status, DELIVERY_STATUS.Pending),
        or(
          isNull(connectionNotificationDeliveries.lastAttemptAt),
          lte(
            connectionNotificationDeliveries.lastAttemptAt,
            sql`DATE_SUB(${now}, INTERVAL ${BACKOFF_CASE} MINUTE)`,
          ),
        ),
      ),
      and(
        eq(connectionNotificationDeliveries.status, DELIVERY_STATUS.Sending),
        lte(
          connectionNotificationDeliveries.lastAttemptAt,
          sql`DATE_SUB(${now}, INTERVAL ${STALE_SENDING_MINUTES} MINUTE)`,
        ),
      ),
    )
  }

  // Claims the row by flipping Pending → Sending with an attempt-count guard.
  // Returns the row's attempt count after the increment (this attempt), or
  // null when the latch was lost to another worker instance.
  private async claim(id: number): Promise<number | null> {
    const { db } = this.options
    const [result] = await db
      .update(connectionNotificationDeliveries)
      .set({
        status: DELIVERY_STATUS.Sending,
        attemptCount: sql`${connectionNotificationDeliveries.attemptCount} + 1`,
        lastAttemptAt: this.clock(),
      })
      .where(and(eq(connectionNotificationDeliveries.id, id), this.eligible()))
    if (result.affectedRows !== 1) return null
    const [row] = await db
      .select({ attemptCount: connectionNotificationDeliveries.attemptCount })
      .from(connectionNotificationDeliveries)
      .where(eq(connectionNotificationDeliveries.id, id))
      .limit(1)
    return row?.attemptCount ?? null
  }

  private async deliver(task: DeliveryTask, attempt: number): Promise<void> {
    const { db, mailer } = this.options
    let content: EmailContent | null
    try {
      content = await this.options.resolveContent(task)
    } catch (err) {
      console.error(`[mail-worker] content resolution failed for delivery ${task.id}:`, err)
      await this.writeOutcome(task.id, attempt, DELIVERY_STATUS.Pending, 'CONTENT_RESOLVE_ERROR')
      return
    }
    // Content that can never resolve (request/project gone) is terminal, not
    // retryable — otherwise it would exhaust attempts on guaranteed failures.
    if (!content) {
      await this.writeOutcome(task.id, attempt, DELIVERY_STATUS.Failed, 'CONTENT_UNAVAILABLE')
      this.logDelivery('mail_delivery_failed', task, 'Failed', 'CONTENT_UNAVAILABLE')
      return
    }
    try {
      const { providerMessageId } = await mailer.send({
        to: task.recipientEmail,
        idempotencyKey: `${task.connectionRequestId}:${task.notificationType}`,
        ...content,
      })
      await this.writeOutcome(task.id, attempt, DELIVERY_STATUS.Sent, undefined, {
        providerMessageId: providerMessageId ?? null,
        sentAt: this.clock(),
      })
      this.logDelivery('mail_delivery_sent', task, 'Sent')
    } catch (err) {
      console.error(`[mail-worker] send failed for delivery ${task.id}:`, err)
      const code = err instanceof MailSendError ? err.code : 'UNKNOWN'
      const terminal = attempt >= MAX_ATTEMPTS
      await this.writeOutcome(
        task.id,
        attempt,
        terminal ? DELIVERY_STATUS.Failed : DELIVERY_STATUS.Pending,
        code,
      )
      if (terminal) this.logDelivery('mail_delivery_failed', task, 'Failed', code)
    }
  }

  // Funnel events for the delivery pipeline (PRD 15): one line per terminal
  // outcome — success and exhausted failures. Retriable attempts are visible
  // via the delivery row, not as events.
  private logDelivery(
    event: string,
    task: DeliveryTask,
    status: string,
    errorCode?: string,
  ): void {
    logEvent(event, {
      requestId: task.connectionRequestId,
      deliveryId: task.id,
      notificationType: task.notificationType,
      status,
      ...(errorCode !== undefined ? { errorCode } : {}),
    })
  }

  // Writes the outcome of attempt N. The status + attempt-count guard means a
  // write from a dead owner whose row was reclaimed (attempt incremented) or
  // already finalized is a no-op.
  private async writeOutcome(
    id: number,
    attempt: number,
    status: (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS],
    lastErrorCode?: string,
    extra: { providerMessageId?: string | null; sentAt?: Date } = {},
  ): Promise<void> {
    await this.options.db
      .update(connectionNotificationDeliveries)
      .set({ status, ...(lastErrorCode !== undefined ? { lastErrorCode } : {}), ...extra })
      .where(
        and(
          eq(connectionNotificationDeliveries.id, id),
          eq(connectionNotificationDeliveries.status, DELIVERY_STATUS.Sending),
          eq(connectionNotificationDeliveries.attemptCount, attempt),
        ),
      )
  }

  private clock(): Date {
    return this.options.now ? this.options.now() : new Date()
  }
}
