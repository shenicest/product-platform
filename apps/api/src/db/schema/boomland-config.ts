import { index, int, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const seasonBudgets = mysqlTable('season_budgets', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  version: int('version').notNull(),
  totalAmount: int('total_amount').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  reason: varchar('reason', { length: 255 }).notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_season_budgets_season_version').on(table.seasonId, table.version),
  index('idx_season_budgets_season_status').on(table.seasonId, table.status),
])

export const seasonPointPools = mysqlTable('season_point_pools', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  totalPoints: int('total_points').notNull().default(0),
  allocatedPoints: int('allocated_points').notNull().default(0),
  usedPoints: int('used_points').notNull().default(0),
  version: int('version').notNull().default(1),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_season_point_pools_season').on(table.seasonId),
])

export const pointAllocations = mysqlTable('point_allocations', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  poolId: int('pool_id').notNull(),
  scorerUserId: varchar('scorer_user_id', { length: 255 }).notNull(),
  amount: int('amount').notNull(),
  usedAmount: int('used_amount').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_point_allocations_season_scorer').on(table.seasonId, table.scorerUserId),
  index('idx_point_allocations_season_status').on(table.seasonId, table.status),
])

export const seasonVerifierGrants = mysqlTable('season_verifier_grants', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  grantedBy: varchar('granted_by', { length: 255 }).notNull(),
  grantedAt: timestamp('granted_at').notNull().defaultNow(),
  revokedBy: varchar('revoked_by', { length: 255 }),
  revokedAt: timestamp('revoked_at'),
  revokeReason: text('revoke_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_season_verifier_grants_season_user').on(table.seasonId, table.userId),
  index('idx_season_verifier_grants_season_status').on(table.seasonId, table.status),
])
