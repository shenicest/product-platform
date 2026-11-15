import { and, count, desc, eq, gt, isNull, lt, lte, or, sql } from 'drizzle-orm'
import {
  AnnouncementLevel,
  AnnouncementScope,
  AnnouncementType,
} from '@shenicest/shared'
import type { Database } from '../../db'
import { announcementRecipients, announcements, userAnnouncementReads } from '../../db/schema'
import type { AnnouncementItem, AnnouncementListQuery } from './model'

type AnnouncementRow = typeof announcements.$inferSelect

/**
 * 发布公告需要的写句柄。
 *
 * 只取 insert / select 两个方法：`Database` 和事务句柄 `tx` 都满足，
 * 于是业务模块可以在自己的事务里发公告（见 docs/announcement-center.md §6），
 * 不用为了写一条公告另开一个不参与回滚的连接。
 */
export type AnnouncementWriter = Pick<Database, 'insert' | 'select'>

export interface AnnouncementPublishInput {
  type: AnnouncementType
  level?: AnnouncementLevel
  title: string
  content: string
  /** 站内相对路径；发布时校验，必须以单个 `/` 开头。 */
  linkPath?: string | null
  seasonId?: number | null
  /** 操作者 userId；系统生成的公告填 `'system'`。 */
  createdBy: string
  sourceType?: string | null
  sourceId?: string | null
  /** 幂等键：同一业务事件重试时不重复发公告。 */
  dedupeKey?: string | null
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
/** 收件人分批写入的行数：一条 INSERT 不超过 500 行，避免超出 max_allowed_packet。 */
const RECIPIENT_CHUNK = 500

/**
 * 公告的「已读」模型是**每人一条读水位线**：
 *
 *   unread = 对我可见 ∧ published_at > last_read_at （没有水位行 = 全部未读）
 *
 * 因此这里没有「逐条已读」的写入口 —— 一键已读是一次单人写。设计取舍见
 * docs/announcement-center.md §2/§3。
 */
export class AnnouncementService {
  constructor(private db: Database) {}

  /**
   * 发一条全局公告：所有登录用户可见，收件人表零行。
   */
  async publishGlobal(input: AnnouncementPublishInput, tx: AnnouncementWriter = this.db) {
    return this.insertAnnouncement(tx, AnnouncementScope.Global, input)
  }

  /**
   * 发一条专属公告：收件人名单在发布时确定。
   *
   * 收件人为空时**不发公告**并返回 `id: null` —— 典型场景是给一个还没有
   * 选手的赛季发赛程变更，这不该让上游的业务事务失败。
   *
   * 写句柄放最后一个参数（与 `publishGlobal` 一致）：业务模块在自己的事务里
   * 调 `publishDirect(userIds, input, tx)` 即可。
   */
  async publishDirect(
    userIds: readonly string[],
    input: AnnouncementPublishInput,
    tx: AnnouncementWriter = this.db,
  ) {
    const recipients = [...new Set(userIds.filter((userId) => userId.length > 0))]
    if (recipients.length === 0) return { id: null as number | null, created: false }

    const { id, created } = await this.insertAnnouncement(tx, AnnouncementScope.Direct, input)
    if (created) {
      for (let offset = 0; offset < recipients.length; offset += RECIPIENT_CHUNK) {
        const chunk = recipients.slice(offset, offset + RECIPIENT_CHUNK)
        await tx.insert(announcementRecipients).values(
          chunk.map((userId) => ({ announcementId: id, userId })),
        )
      }
    }
    return { id, created }
  }

  /**
   * 铃铛角标数据：未读数 + 读水位线。
   *
   * 水位线为 null（从未点过已读）时**不加** published_at 过滤条件，而不是拿
   * 纪元时间去比 —— 后者会引入 1970 边界与时区转换的噪音。
   */
  async summary(userId: string) {
    const watermark = await this.getWatermark(userId)
    return {
      unreadCount: await this.countUnread(userId, watermark),
      lastReadAt: watermark ? watermark.toISOString() : null,
    }
  }

  /**
   * 公告列表：全局 + 专属两个来源各取一页，在内存里按
   * `(published_at DESC, id DESC)` 归并。
   *
   * 两段查询各自走 `(scope, published_at)` 与 `(user_id, announcement_id)`
   * 索引；归并而不是 UNION，是因为两边的可见性条件本来就不同，SQL 层
   * UNION 反而更难读。每段多取 1 行用于判断「还有没有下一页」。
   */
  async list(userId: string, query: AnnouncementListQuery) {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const watermark = await this.getWatermark(userId)
    const cursor = decodeCursor(query.cursor)
    const unreadOnly = query.unreadOnly === 'true'

    const cursorCondition = cursor
      ? or(
          lt(announcements.publishedAt, cursor.publishedAt),
          and(eq(announcements.publishedAt, cursor.publishedAt), lt(announcements.id, cursor.id)),
        )
      : undefined
    // unreadOnly 且没有水位行时，「未读」= 全部可见，不需要额外条件。
    const unreadCondition =
      unreadOnly && watermark ? gt(announcements.publishedAt, watermark) : undefined
    const publishedCondition = lte(announcements.publishedAt, sql`NOW(3)`)

    const [globalRows, directRows, unreadCount] = await Promise.all([
      this.db
        .select()
        .from(announcements)
        .where(
          and(
            eq(announcements.scope, AnnouncementScope.Global),
            isNull(announcements.revokedAt),
            publishedCondition,
            unreadCondition,
            cursorCondition,
          ),
        )
        .orderBy(desc(announcements.publishedAt), desc(announcements.id))
        .limit(limit + 1),
      this.db
        .select({ announcement: announcements })
        .from(announcementRecipients)
        .innerJoin(announcements, eq(announcements.id, announcementRecipients.announcementId))
        .where(
          and(
            eq(announcementRecipients.userId, userId),
            isNull(announcements.revokedAt),
            publishedCondition,
            unreadCondition,
            cursorCondition,
          ),
        )
        .orderBy(desc(announcements.publishedAt), desc(announcements.id))
        .limit(limit + 1),
      this.countUnread(userId, watermark),
    ])

    const merged = [...globalRows, ...directRows.map((row) => row.announcement)].sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || b.id - a.id,
    )
    const items = merged.slice(0, limit)

    return {
      items: items.map((row) => toItem(row, watermark)),
      nextCursor: merged.length > limit ? encodeCursor(items[items.length - 1]!) : null,
      unreadCount,
    }
  }

  /**
   * 一键已读：把读水位线推到「请求那一刻」。
   *
   * - `GREATEST` 保证水位只前进不后退（多标签页并发、重试都安全）；
   * - `NOW(3)` 与公告的 published_at 同一个 DB 时钟源，不受应用服务器时钟偏移影响。
   */
  async markAllRead(userId: string) {
    await this.db.execute(sql`
      INSERT INTO ${userAnnouncementReads} (user_id, last_read_at, updated_at)
      VALUES (${userId}, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        last_read_at = GREATEST(last_read_at, NOW(3)),
        updated_at = NOW(3)
    `)
    const watermark = await this.getWatermark(userId)
    if (!watermark) throw new Error('announcement read watermark was not persisted')
    return { lastReadAt: watermark.toISOString(), unreadCount: 0 as const }
  }

  private async getWatermark(userId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ lastReadAt: userAnnouncementReads.lastReadAt })
      .from(userAnnouncementReads)
      .where(eq(userAnnouncementReads.userId, userId))
      .limit(1)
    return row?.lastReadAt ?? null
  }

  private async countUnread(userId: string, watermark: Date | null): Promise<number> {
    // published_at 是「对外生效时间」：未来时间（定时发布）在到点前既不可见也不计数。
    const publishedCondition = lte(announcements.publishedAt, sql`NOW(3)`)
    const globalConditions = [
      eq(announcements.scope, AnnouncementScope.Global),
      isNull(announcements.revokedAt),
      publishedCondition,
    ]
    const directConditions = [
      eq(announcementRecipients.userId, userId),
      isNull(announcements.revokedAt),
      publishedCondition,
    ]
    if (watermark) {
      globalConditions.push(gt(announcements.publishedAt, watermark))
      directConditions.push(gt(announcements.publishedAt, watermark))
    }

    const [[globalRow], [directRow]] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(announcements)
        .where(and(...globalConditions)),
      this.db
        .select({ value: count() })
        .from(announcementRecipients)
        .innerJoin(announcements, eq(announcements.id, announcementRecipients.announcementId))
        .where(and(...directConditions)),
    ])

    return (globalRow?.value ?? 0) + (directRow?.value ?? 0)
  }

  /**
   * 写入公告本体。
   *
   * `published_at` 显式写 `NOW(3)`：与读水位线同一个时钟源，且保留毫秒精度
   * （列的 default 是 `DEFAULT (now())`，只有秒精度）。
   *
   * 幂等靠 `dedupe_key` 唯一索引：命中重复时读回已有 id 并返回
   * `created: false`，调用方据此跳过收件人写入。MySQL 里唯一键冲突不会
   * 中止外层事务，所以这里可以放心 catch 后继续。
   */
  private async insertAnnouncement(
    tx: AnnouncementWriter,
    scope: AnnouncementScope,
    input: AnnouncementPublishInput,
  ) {
    const title = input.title.trim()
    if (!title) throw new Error('announcement title is required')
    const content = input.content.trim()
    if (!content) throw new Error('announcement content is required')

    try {
      const [result] = await tx.insert(announcements).values({
        scope,
        type: input.type,
        level: input.level ?? AnnouncementLevel.Info,
        title,
        content,
        linkPath: internalPathOrThrow(input.linkPath),
        seasonId: input.seasonId ?? null,
        publishedAt: sql`NOW(3)`,
        createdBy: input.createdBy,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        dedupeKey: input.dedupeKey ?? null,
      })
      return { id: result.insertId, created: true }
    } catch (error) {
      if (!input.dedupeKey || !isDuplicateKey(error)) throw error
      const [existing] = await tx
        .select({ id: announcements.id })
        .from(announcements)
        .where(eq(announcements.dedupeKey, input.dedupeKey))
        .limit(1)
      if (!existing) throw error
      return { id: existing.id, created: false }
    }
  }
}

function toItem(row: AnnouncementRow, watermark: Date | null): AnnouncementItem {
  return {
    id: row.id,
    type: row.type as AnnouncementItem['type'],
    level: row.level as AnnouncementItem['level'],
    title: row.title,
    content: row.content,
    linkPath: row.linkPath,
    seasonId: row.seasonId,
    publishedAt: row.publishedAt.toISOString(),
    isRead: watermark !== null && row.publishedAt.getTime() <= watermark.getTime(),
  }
}

/**
 * 游标 = `<publishedAt 毫秒>_<id>`。
 *
 * 只用一个时间戳做游标时，同一毫秒内发布的多条公告会在翻页处重复或漏掉，
 * 所以带上自增 id 作为第二排序键。格式由 model.ts 的 pattern 校验。
 */
function encodeCursor(row: AnnouncementRow): string {
  return `${row.publishedAt.getTime()}_${row.id}`
}

function decodeCursor(cursor: string | undefined): { publishedAt: Date; id: number } | null {
  if (!cursor) return null
  const [rawTime, rawId] = cursor.split('_')
  const time = Number(rawTime)
  const id = Number(rawId)
  if (!Number.isFinite(time) || !Number.isInteger(id)) return null
  return { publishedAt: new Date(time), id }
}

/**
 * 公告正文里的跳转只允许站内相对路径。
 *
 * `//evil.com` 是协议相对地址，`\` 在部分浏览器里等价于 `/`，两者都能把
 * 「站内链接」变成开放跳转，所以一并拒绝。
 */
function internalPathOrThrow(linkPath: string | null | undefined): string | null {
  if (!linkPath) return null
  if (
    linkPath.length > 512 ||
    !linkPath.startsWith('/') ||
    linkPath.startsWith('//') ||
    linkPath.includes('\\')
  ) {
    throw new Error(`announcement linkPath must be an internal path, got: ${linkPath}`)
  }
  return linkPath
}

function isDuplicateKey(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code, errno, cause } = error as { code?: string; errno?: number; cause?: unknown }
  if (code === 'ER_DUP_ENTRY' || errno === 1062) return true
  // drizzle 会把驱动错误包成 DrizzleQueryError，真正的 errno/code 在 cause 上。
  return cause !== undefined && cause !== null && cause !== error
    ? isDuplicateKey(cause)
    : false
}
