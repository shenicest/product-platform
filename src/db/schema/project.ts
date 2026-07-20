import { boolean, index, int, json, mysqlTable, text, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'
import { t } from 'elysia'

export const projects = mysqlTable('projects', {
  id: int('id').primaryKey().autoincrement(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  status: tinyint('status').notNull().default(0),
  name: varchar('name', { length: 255 }).notNull(),
  tagline: varchar('tagline', { length: 255 }),
  description: text('description'),
  coverUrl: varchar('cover_url', { length: 255 }),
  demoImages: json('demo_images').$type<string[]>(),
  demoVideoUrl: varchar('demo_video_url', { length: 255 }),
  demoLink: varchar('demo_link', { length: 255 }),
  stage: tinyint('stage'),
  categories: json('categories').$type<string[]>(),
  targetUsers: text('target_users'),
  userProblem: text('user_problem'),
  progress: text('progress'),
  nextSteps: text('next_steps'),
  messageToUsers: text('message_to_users'),
  isOpenForBeta: boolean('is_open_for_beta'),
  betaDescription: text('beta_description'),
  contactName: varchar('contact_name', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactWechat: varchar('contact_wechat', { length: 255 }),
  teamName: varchar('team_name', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index('idx_projects_user_id').on(table.userId),
  index('idx_projects_status').on(table.status),
  index('idx_projects_stage').on(table.stage),
])

export const InsertProject = createInsertSchema(projects, {
  id: undefined,
  createdAt: undefined,
  updatedAt: undefined,
  name: (schema) => t.String({ ...schema, minLength: 1 }),
  demoImages: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
  categories: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
})
export type InsertProject = typeof InsertProject.static

export const SelectProject = createSelectSchema(projects)
export type SelectProject = typeof SelectProject.static
