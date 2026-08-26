import { int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core'

export const bathConfig = mysqlTable('bath_config', {
  id: int('id').primaryKey().autoincrement(),
  eventStart: varchar('event_start', { length: 10 }).notNull(),
  eventEnd: varchar('event_end', { length: 10 }).notNull(),
  updatedBy: varchar('updated_by', { length: 255 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
})
