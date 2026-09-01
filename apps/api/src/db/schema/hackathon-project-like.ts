import { index, int, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

// Hackathon projects live in the external event database, so this table intentionally has no FK.
export const hackathonProjectLikes = mysqlTable('hackathon_project_likes', {
  id: int('id').primaryKey().autoincrement(),
  hackathonProjectId: int('hackathon_project_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_hackathon_likes_project_user').on(table.hackathonProjectId, table.userId),
  index('idx_hackathon_likes_user_id').on(table.userId),
])
