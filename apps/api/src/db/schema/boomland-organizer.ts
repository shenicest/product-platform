import { index, int, mysqlTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const organizerOrgs = mysqlTable('organizer_orgs', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_organizer_orgs_name').on(table.name),
])

export const organizerOrgMembers = mysqlTable('organizer_org_members', {
  id: int('id').primaryKey().autoincrement(),
  orgId: int('org_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_organizer_org_members_org_user').on(table.orgId, table.userId),
  index('idx_organizer_org_members_user').on(table.userId),
])

export const seasonOrganizers = mysqlTable('season_organizers', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  orgId: int('org_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_season_organizers_season_org').on(table.seasonId, table.orgId),
  index('idx_season_organizers_org').on(table.orgId),
])
