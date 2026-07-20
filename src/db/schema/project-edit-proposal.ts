import { index, int, json, mysqlTable, text, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'

export const projectEditProposals = mysqlTable('project_edit_proposals', {
  id: int('id').primaryKey().autoincrement(),
  projectId: int('project_id').notNull(),
  changes: json('changes').$type<Record<string, unknown>>().notNull(),
  status: tinyint('status').notNull().default(0),
  reason: text('reason'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index('idx_proposals_project_id').on(table.projectId),
  index('idx_proposals_status').on(table.status),
])

export const InsertProjectEditProposal = createInsertSchema(projectEditProposals, {
  id: undefined,
  createdAt: undefined,
  updatedAt: undefined,
})
export type InsertProjectEditProposal = typeof InsertProjectEditProposal.static

export const SelectProjectEditProposal = createSelectSchema(projectEditProposals)
export type SelectProjectEditProposal = typeof SelectProjectEditProposal.static
