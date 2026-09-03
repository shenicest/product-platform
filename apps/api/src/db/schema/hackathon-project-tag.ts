import { index, int, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const hackathonProjectTags = mysqlTable('hackathon_project_tags', {
  id: int('id').primaryKey().autoincrement(),
  eventId: int('event_id').notNull(),
  hackathonProjectId: int('hackathon_project_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  tagId: varchar('tag_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_hackathon_tag_project_user').on(table.eventId, table.hackathonProjectId, table.userId, table.tagId),
  index('idx_hackathon_tags_project').on(table.eventId, table.hackathonProjectId),
  index('idx_hackathon_tags_user').on(table.userId),
])
