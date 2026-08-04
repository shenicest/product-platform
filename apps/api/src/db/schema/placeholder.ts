import { int, mysqlTable, varchar, timestamp } from 'drizzle-orm/mysql-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'

export const platformMeta = mysqlTable('platform_meta', {
  id: int('id').primaryKey().autoincrement(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: varchar('value', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const InsertPlatformMeta = createInsertSchema(platformMeta, {
  id: undefined,
  createdAt: undefined,
})
export type InsertPlatformMeta = typeof InsertPlatformMeta.static

export const SelectPlatformMeta = createSelectSchema(platformMeta)
export type SelectPlatformMeta = typeof SelectPlatformMeta.static
