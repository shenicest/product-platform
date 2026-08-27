import { index, int, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const bathBookings = mysqlTable('bath_bookings', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  timeSlot: varchar('time_slot', { length: 5 }).notNull(),
  gender: varchar('gender', { length: 10 }).notNull(),
  checkoutDeadline: timestamp('checkout_deadline'),
  checkedOutAt: timestamp('checked_out_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_bath_bookings_date_slot_gender').on(table.date, table.timeSlot, table.gender),
  index('idx_bath_bookings_user_date').on(table.userId, table.date),
])
