import { index, int, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core'

export const challenges = mysqlTable('challenges', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  realProblem: text('real_problem'),
  targetCustomer: text('target_customer'),
  minimumDeliverable: text('minimum_deliverable'),
  resourceCommitment: text('resource_commitment'),
  resultEvidenceRules: text('result_evidence_rules'),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  version: int('version').notNull().default(1),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index('idx_challenges_season_status').on(table.seasonId, table.status),
])
