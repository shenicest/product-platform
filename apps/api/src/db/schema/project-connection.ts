import { index, int, mysqlTable, text, timestamp, tinyint, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

// Platform-Project connections target a Live `projects` row. The receiver is
// the project owner snapshotted at creation time (project ownership does not
// transfer), so there is no separate receiver-configuration table. The table
// stays separate from the Talent and hackathon request tables for the reasons
// in ADR-0010/ADR-0014; only the primitives (status enum, contact encryption,
// pair-key pattern, daily-limit table) are shared.

export const projectConnectionRequests = mysqlTable('project_connection_requests', {
  id: int('id').primaryKey().autoincrement(),
  projectId: int('project_id').notNull(),
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
  index('idx_project_connection_requests_project_status').on(table.projectId, table.status),
  index('idx_project_connection_requests_sender_project_status').on(table.senderUserId, table.projectId, table.status),
  index('idx_project_connection_requests_receiver_status').on(table.receiverUserId, table.status, table.createdAt),
  uniqueIndex('uq_project_connection_requests_active_pair').on(table.pairKey),
])
