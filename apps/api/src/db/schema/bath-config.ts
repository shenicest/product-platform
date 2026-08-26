import { int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core'

export const bathConfig = mysqlTable('bath_config', {
  id: int('id').primaryKey().autoincrement(),
  eventStart: varchar('event_start', { length: 10 }).notNull(),
  eventEnd: varchar('event_end', { length: 10 }).notNull(),
  dailyStart: varchar('daily_start', { length: 5 }).notNull().default('09:00'),
  dailyEnd: varchar('daily_end', { length: 5 }).notNull().default('21:00'),
  updatedBy: varchar('updated_by', { length: 255 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
})
