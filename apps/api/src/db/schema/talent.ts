import { index, int, json, mysqlTable, text, timestamp, tinyint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const talentProfiles = mysqlTable('talent_profiles', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  status: tinyint('status').notNull(),
  headline: varchar('headline', { length: 255 }).notNull(),
  bio: text('bio').notNull(),
  city: varchar('city', { length: 100 }),
  roles: json('roles').$type<string[]>().notNull(),
  skills: json('skills').$type<string[]>().notNull(),
  seekingSkills: json('seeking_skills').$type<string[]>().notNull(),
  domains: json('domains').$type<string[]>().notNull(),
  durations: json('durations').$type<string[]>().notNull(),
  publishedAt: timestamp('published_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_talent_profiles_user_id').on(table.userId),
  index('idx_talent_profiles_status_updated').on(table.status, table.updatedAt),
])

export const connectionRequests = mysqlTable('connection_requests', {
  id: int('id').primaryKey().autoincrement(),
  senderUserId: varchar('sender_user_id', { length: 255 }).notNull(),
  receiverUserId: varchar('receiver_user_id', { length: 255 }).notNull(),
  pairKey: varchar('pair_key', { length: 511 }),
  projectId: int('project_id'),
  purpose: varchar('purpose', { length: 255 }).notNull(),
  message: text('message').notNull(),
  senderContact: text('sender_contact').notNull(),
  receiverContact: text('receiver_contact'),
  status: tinyint('status').notNull(),
  acceptedAt: timestamp('accepted_at'),
  handledAt: timestamp('handled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_connection_requests_sender').on(table.senderUserId, table.createdAt),
  index('idx_connection_requests_receiver_status').on(table.receiverUserId, table.status),
  index('idx_connection_requests_pair').on(table.senderUserId, table.receiverUserId, table.status),
  uniqueIndex('uq_connection_requests_active_pair').on(table.pairKey),
])

export const talentModerationRecords = mysqlTable('talent_moderation_records', {
  id: int('id').primaryKey().autoincrement(),
  talentProfileId: int('talent_profile_id').notNull(),
  operatorId: varchar('operator_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [index('idx_talent_moderation_profile').on(table.talentProfileId)])

export const connectionDailyLimits = mysqlTable('connection_daily_limits', {
  id: int('id').primaryKey().autoincrement(),
  senderUserId: varchar('sender_user_id', { length: 255 }).notNull(),
  beijingDate: varchar('beijing_date', { length: 10 }).notNull(),
  successfulCount: int('successful_count').notNull().default(0),
}, (table) => [
  uniqueIndex('uq_connection_daily_sender_date').on(table.senderUserId, table.beijingDate),
])
