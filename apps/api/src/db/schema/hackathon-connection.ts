import { index, int, mysqlTable, text, timestamp, tinyint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

// Hackathon projects live in the external event database, so these tables
// intentionally have no FK. `receiver_user_id` refers to a User id from the
// shared auth system; `status` reuses the ConnectionRequestStatus numeric
// semantics (Pending 0 / Accepted 1 / Ignored 2 / Cancelled 3).

export const hackathonProjectContacts = mysqlTable('hackathon_project_contacts', {
  id: int('id').primaryKey().autoincrement(),
  eventId: int('event_id').notNull(),
  hackathonProjectId: int('hackathon_project_id').notNull(),
  receiverUserId: varchar('receiver_user_id', { length: 255 }).notNull(),
  notificationEmail: varchar('notification_email', { length: 254 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_hackathon_contacts_event_project').on(table.eventId, table.hackathonProjectId),
  index('idx_hackathon_contacts_receiver').on(table.receiverUserId),
])

export const hackathonConnectionRequests = mysqlTable('hackathon_connection_requests', {
  id: int('id').primaryKey().autoincrement(),
  eventId: int('event_id').notNull(),
  hackathonProjectId: int('hackathon_project_id').notNull(),
  receiverUserId: varchar('receiver_user_id', { length: 255 }).notNull(),
  senderUserId: varchar('sender_user_id', { length: 255 }).notNull(),
  purpose: varchar('purpose', { length: 64 }).notNull(),
  message: text('message').notNull(),
  senderContact: text('sender_contact').notNull(),
  receiverContact: text('receiver_contact'),
  status: tinyint('status').notNull(),
  pairKey: varchar('pair_key', { length: 511 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at'),
  handledAt: timestamp('handled_at'),
}, (table) => [
  index('idx_hackathon_connection_requests_sender').on(table.senderUserId, table.createdAt),
  index('idx_hackathon_connection_requests_receiver_status').on(table.receiverUserId, table.status, table.createdAt),
  index('idx_hackathon_connection_requests_project_status').on(table.eventId, table.hackathonProjectId, table.status),
  index('idx_hackathon_connection_requests_sender_project_status').on(table.senderUserId, table.hackathonProjectId, table.status),
  uniqueIndex('uq_hackathon_connection_requests_active_pair').on(table.pairKey),
])

export const hackathonConnectionDailyLimits = mysqlTable('hackathon_connection_daily_limits', {
  id: int('id').primaryKey().autoincrement(),
  senderUserId: varchar('sender_user_id', { length: 255 }).notNull(),
  beijingDate: varchar('beijing_date', { length: 10 }).notNull(),
  successfulCount: int('successful_count').notNull().default(0),
}, (table) => [
  uniqueIndex('uq_hackathon_connection_daily_sender_date').on(table.senderUserId, table.beijingDate),
])

export const connectionNotificationDeliveries = mysqlTable('connection_notification_deliveries', {
  id: int('id').primaryKey().autoincrement(),
  connectionRequestId: int('connection_request_id').notNull(),
  notificationType: varchar('notification_type', { length: 64 }).notNull(),
  recipientEmail: varchar('recipient_email', { length: 254 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  attemptCount: int('attempt_count').notNull().default(0),
  providerMessageId: varchar('provider_message_id', { length: 255 }),
  lastErrorCode: varchar('last_error_code', { length: 128 }),
  lastAttemptAt: timestamp('last_attempt_at'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_connection_notification_deliveries_request_type').on(table.connectionRequestId, table.notificationType),
])
