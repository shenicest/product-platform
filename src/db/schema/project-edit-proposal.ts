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

export const SelectProjectEditProposal = createSelectSchema(projectEditProposals, {
  id: (s) => { s.description = 'Unique proposal identifier'; return s },
  projectId: (s) => { s.description = 'Associated project ID'; return s },
  changes: (s) => { s.description = 'JSON diff of changed content fields and their new values'; return s },
  status: (s) => { s.description = 'Proposal status: 0=Pending, 1=Approved, 2=Rejected, 3=RevisionRequired'; return s },
  reason: (s) => { s.description = "Operator's reason (set on reject or revision required)"; return s },
  reviewedBy: (s) => { s.description = 'Operator user ID who reviewed this proposal'; return s },
  reviewedAt: (s) => { s.description = 'Review timestamp'; return s },
  createdAt: (s) => { s.description = 'Creation timestamp'; return s },
  updatedAt: (s) => { s.description = 'Last update timestamp'; return s },
})
export type SelectProjectEditProposal = typeof SelectProjectEditProposal.static
