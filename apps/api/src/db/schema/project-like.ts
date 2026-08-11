import { int, index, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const projectLikes = mysqlTable('project_likes', {
  id: int('id').primaryKey().autoincrement(),
  projectId: int('project_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_project_likes_project_user').on(table.projectId, table.userId),
  index('idx_project_likes_user_id').on(table.userId),
])
