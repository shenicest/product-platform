import { index, int, mysqlTable, timestamp, uniqueIndex } from 'drizzle-orm/mysql-core'

// Operator-curated homepage featured list. One row per project; `sortOrder`
// controls display order. The public endpoint joins to `projects` and only
// returns rows whose project is Live, so delisting a project automatically
// removes it from the featured section without losing the operator's config.
export const featuredProjects = mysqlTable('featured_projects', {
  id: int('id').primaryKey().autoincrement(),
  projectId: int('project_id').notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_featured_projects_project_id').on(table.projectId),
  index('idx_featured_projects_sort_order').on(table.sortOrder),
])
