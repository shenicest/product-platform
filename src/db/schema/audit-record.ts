import { index, int, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'

export const auditRecords = mysqlTable('audit_records', {
  id: int('id').primaryKey().autoincrement(),
  projectId: int('project_id').notNull(),
  operatorId: varchar('operator_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  proposalId: int('proposal_id'),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_audit_records_project_id').on(table.projectId),
  index('idx_audit_records_operator_id').on(table.operatorId),
  index('idx_audit_records_created_at').on(table.createdAt),
])

export const InsertAuditRecord = createInsertSchema(auditRecords, {
  id: undefined,
  createdAt: undefined,
})
export type InsertAuditRecord = typeof InsertAuditRecord.static

export const SelectAuditRecord = createSelectSchema(auditRecords)
export type SelectAuditRecord = typeof SelectAuditRecord.static
