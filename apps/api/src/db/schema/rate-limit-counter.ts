import { index, int, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const rateLimitCounters = mysqlTable('rate_limit_counters', {
  id: int('id').primaryKey().autoincrement(),
  scope: varchar('scope', { length: 64 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),
  windowStartedAt: timestamp('window_started_at').notNull(),
  count: int('count').notNull().default(0),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => [
  uniqueIndex('uq_rate_limit_scope_key_window').on(table.scope, table.keyHash, table.windowStartedAt),
  index('idx_rate_limit_expires_at').on(table.expiresAt),
])
