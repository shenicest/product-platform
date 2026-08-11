import { index, int, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const follows = mysqlTable('follows', {
  id: int('id').primaryKey().autoincrement(),
  followerUserId: varchar('follower_user_id', { length: 255 }).notNull(),
  followeeUserId: varchar('followee_user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_follows_follower_followee').on(table.followerUserId, table.followeeUserId),
  index('idx_follows_follower_user_id').on(table.followerUserId),
  index('idx_follows_followee_user_id').on(table.followeeUserId),
])
