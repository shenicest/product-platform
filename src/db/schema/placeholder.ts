import { int, mysqlTable, varchar, timestamp } from 'drizzle-orm/mysql-core'

export const platformMeta = mysqlTable('platform_meta', {
  id: int('id').primaryKey().autoincrement(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: varchar('value', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
