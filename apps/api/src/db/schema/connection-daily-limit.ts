import { int, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

// One row per (scope, sender, Beijing date): successful-creation counters for
// per-user daily quotas. Scopes are separate quota pools — Talent Plaza and
// hackathon connections never consume each other's allowance.
export const ConnectionDailyLimitScope = {
  TalentConnection: 'talent_connection',
  HackathonConnection: 'hackathon_connection',
} as const

export const connectionDailyLimits = mysqlTable('connection_daily_limits', {
  id: int('id').primaryKey().autoincrement(),
  scope: varchar('scope', { length: 64 }).notNull(),
  senderUserId: varchar('sender_user_id', { length: 255 }).notNull(),
  beijingDate: varchar('beijing_date', { length: 10 }).notNull(),
  successfulCount: int('successful_count').notNull().default(0),
}, (table) => [
  uniqueIndex('uq_connection_daily_scope_sender_date').on(table.scope, table.senderUserId, table.beijingDate),
])
