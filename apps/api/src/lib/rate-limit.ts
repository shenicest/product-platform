import { createHmac } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { status } from 'elysia'
import { db } from '../db'
import { rateLimitCounters } from '../db/schema'

const KEY_SECRET = process.env.SHENICEST_RATE_LIMIT_SECRET
if (!KEY_SECRET) throw new Error('SHENICEST_RATE_LIMIT_SECRET environment variable is required')

export type RateLimitRule = { scope: string; windowSeconds: number; limit: number }
type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }
  | { allowed: false; retryAfter: number; unavailable: true }

export const rateLimitExceeded = (retryAfter: number) => status(429, {
  error: { code: 'RATE_LIMITED', message: 'Too many requests' },
  retryAfter,
})

export const rateLimitUnavailable = () => status(503, {
  error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Service temporarily unavailable' },
})

const hashKey = (value: string) => createHmac('sha256', KEY_SECRET).update(value).digest('hex')

export async function consumeRateLimit(key: string, rules: RateLimitRule[]): Promise<RateLimitResult> {
  const now = new Date()
  const windows = rules.map((rule) => {
    const startedAt = new Date(Math.floor(now.getTime() / 1000 / rule.windowSeconds) * rule.windowSeconds * 1000)
    return { rule, startedAt, expiresAt: new Date(startedAt.getTime() + rule.windowSeconds * 1000) }
  })

  try {
    return await db.transaction(async (tx) => {
      for (const { rule, startedAt, expiresAt } of windows) {
        const keyHash = hashKey(`${rule.scope}:${key}`)
        await tx.insert(rateLimitCounters).values({
          scope: rule.scope,
          keyHash,
          windowStartedAt: startedAt,
          expiresAt,
          count: 1,
        }).onDuplicateKeyUpdate({
          // Do not increase an already exhausted window. This keeps the
          // counter bounded while the upsert remains atomic under concurrency.
          set: { count: sql`IF(${rateLimitCounters.count} <= ${rule.limit}, ${rateLimitCounters.count} + 1, ${rateLimitCounters.count})` },
        })

        const [counter] = await tx.select({ count: rateLimitCounters.count })
          .from(rateLimitCounters)
          .where(and(
            eq(rateLimitCounters.scope, rule.scope),
            eq(rateLimitCounters.keyHash, keyHash),
            eq(rateLimitCounters.windowStartedAt, startedAt),
          ))
          .limit(1)

        if (!counter || counter.count > rule.limit) {
          return { allowed: false as const, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)) }
        }
      }
      return { allowed: true as const }
    })
  } catch {
    // Authentication endpoints fail closed when the limiter cannot be reached.
    return { allowed: false as const, retryAfter: 60, unavailable: true as const }
  }
}

export const clientIp = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 255) || 'unknown'
  return request.headers.get('x-real-ip')?.trim().slice(0, 255) || 'unknown'
}
