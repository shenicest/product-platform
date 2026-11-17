import { index, int, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

/**
 * 公告本体。一条公告一行，`scope` 决定谁可见：
 *
 * - `global`：所有登录用户可见，收件人表零行；
 * - `direct`：只有 announcement_recipients 里列出的用户可见。
 *
 * 这里**没有**已读字段，也没有 `user_id` —— 全局公告一旦按用户展开，
 * 行数就是「公告数 × 用户数」。已读状态放在 user_announcement_reads
 * 里，每人一条读水位线（见 docs/announcement-center.md §3）。
 */
export const announcements = mysqlTable('announcements', {
  id: int('id').primaryKey().autoincrement(),
  scope: varchar('scope', { length: 16 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  level: varchar('level', { length: 16 }).notNull().default('info'),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  // 站内相对路径（如 /seasons/12）。发布时校验必须以单个 / 开头，
  // 不允许 //host 这种协议相对地址，避免变成开放跳转。
  linkPath: varchar('link_path', { length: 512 }),
  seasonId: int('season_id'),
  // 未读比较基准。发布路径显式写 NOW(3)（DB 时钟），不依赖 defaultNow
  // —— default 生成的是 `DEFAULT (now())`，只有秒精度。
  publishedAt: timestamp('published_at', { fsp: 3 }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { fsp: 3 }),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  sourceType: varchar('source_type', { length: 32 }),
  sourceId: varchar('source_id', { length: 64 }),
  // 幂等键：同一业务事件重试时不让公告变成两条。MySQL 唯一索引允许多个 NULL。
  dedupeKey: varchar('dedupe_key', { length: 191 }),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  // 全局未读计数：等值(scope) + 范围(published_at)，直接走这个索引。
  index('idx_announcements_scope_published').on(table.scope, table.publishedAt),
  index('idx_announcements_published').on(table.publishedAt),
  index('idx_announcements_season_published').on(table.seasonId, table.publishedAt),
  uniqueIndex('uq_announcements_dedupe').on(table.dedupeKey),
])

/**
 * 专属公告的投递名单：这条公告进了谁的收件箱。
 *
 * 它**不是**已读表 —— 只回答「投给谁」，不回答「谁读了」。
 * 全局公告在这里零行，这是已读数据量与公告数量解耦的关键。
 */
export const announcementRecipients = mysqlTable('announcement_recipients', {
  id: int('id').primaryKey().autoincrement(),
  announcementId: int('announcement_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_announcement_recipients_announcement_user').on(table.announcementId, table.userId),
  // 未读计数按 user_id 定位收件人行，再回表主键取 published_at。
  index('idx_announcement_recipients_user').on(table.userId, table.announcementId),
])

/**
 * 每人一条读水位线。
 *
 * `last_read_at = T` 表示「T（含）之前的公告都算读过」。没有行 = 从未点过
 * 已读 = 全部可见公告都算未读（上线即历史未读，见设计文档 §3.4）。
 * 全表行数 ≈ 用户数，与公告数无关。
 */
export const userAnnouncementReads = mysqlTable('user_announcement_reads', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  lastReadAt: timestamp('last_read_at', { fsp: 3 }).notNull(),
  // 不用 `.onUpdateNow()`：drizzle 生成的是不带精度的 `ON UPDATE CURRENT_TIMESTAMP`，
  // MySQL 会因为列是 timestamp(3) 而报 ER_INVALID_ON_UPDATE。唯一写入口
  // （markAllRead 的 upsert）本来就显式写 NOW(3)。
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow(),
})
