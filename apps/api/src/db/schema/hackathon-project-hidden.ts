import { index, int, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

// Hackathon projects live in the external event database, so this table intentionally has no FK.
export const hackathonProjectHidden = mysqlTable('hackathon_project_hidden', {
  id: int('id').primaryKey().autoincrement(),
  eventId: int('event_id').notNull(),
  hackathonProjectId: int('hackathon_project_id').notNull(),
  hiddenBy: varchar('hidden_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_hackathon_hidden_event_project').on(table.eventId, table.hackathonProjectId),
  index('idx_hackathon_hidden_project_id').on(table.hackathonProjectId),
])
