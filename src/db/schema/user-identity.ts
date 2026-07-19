import { int, mysqlTable, varchar, tinyint, timestamp, unique } from 'drizzle-orm/mysql-core'

export const userIdentities = mysqlTable('user_identities', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  role: tinyint('role').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  unique('uk_user_role').on(table.userId, table.role),
])
