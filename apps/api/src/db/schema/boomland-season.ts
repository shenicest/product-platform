import type { SeasonRules, SeasonSchedule } from '@shenicest/shared'
import { boolean, index, int, json, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const seasons = mysqlTable('seasons', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 16 }).notNull().default('season'),
  city: varchar('city', { length: 100 }),
  intro: text('intro'),
  themes: json('themes').$type<string[]>().notNull(),
  applyOpen: timestamp('apply_open'),
  applyClose: timestamp('apply_close'),
  startAt: timestamp('start_at'),
  teamDeadline: timestamp('team_deadline'),
  challengeFreezeAt: timestamp('challenge_freeze_at'),
  workDeadline: timestamp('work_deadline'),
  scoreDeadline: timestamp('score_deadline'),
  settleDate: timestamp('settle_date'),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  approvedAt: timestamp('approved_at'),
  approvedBy: varchar('approved_by', { length: 255 }),
  submittedAt: timestamp('submitted_at'),
  rejectedAt: timestamp('rejected_at'),
  rejectedBy: varchar('rejected_by', { length: 255 }),
  rejectionReason: text('rejection_reason'),
  startedAt: timestamp('started_at'),
  suspendedAt: timestamp('suspended_at'),
  statusBeforeSuspend: varchar('status_before_suspend', { length: 16 }),
  resumedAt: timestamp('resumed_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
  pinned: boolean('pinned').notNull().default(false),
  participantCapacity: int('participant_capacity'),
  awardingEntity: varchar('awarding_entity', { length: 255 }),
  agreementVersion: varchar('agreement_version', { length: 32 }).notNull().default('v1'),
  rulesVersion: int('rules_version').notNull().default(1),
  rules: json('rules').$type<SeasonRules>().notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_seasons_code').on(table.code),
  index('idx_seasons_status_start').on(table.status, table.startAt),
  index('idx_seasons_pinned').on(table.pinned),
  index('idx_seasons_approved').on(table.approvedAt),
])

export const seasonRuleCardItems = mysqlTable('season_rule_card_items', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  key: varchar('key', { length: 64 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  value: text('value').notNull(),
  required: boolean('required').notNull().default(false),
  visible: boolean('visible').notNull().default(true),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_season_rule_card_season_key').on(table.seasonId, table.key),
  index('idx_season_rule_card_season_order').on(table.seasonId, table.sortOrder),
])

export const seasonAnnouncements = mysqlTable('season_announcements', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  category: varchar('category', { length: 16 }).notNull().default('general'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_season_announcements_season_created').on(table.seasonId, table.createdAt),
])

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').primaryKey().autoincrement(),
  actorUserId: varchar('actor_user_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: varchar('target_id', { length: 64 }).notNull(),
  seasonId: int('season_id'),
  detail: json('detail').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_audit_logs_season_created').on(table.seasonId, table.createdAt),
  index('idx_audit_logs_actor').on(table.actorUserId),
  index('idx_audit_logs_action').on(table.action),
])

export type SeasonScheduleColumns = {
  applyOpen: Date | null
  applyClose: Date | null
  startAt: Date | null
  teamDeadline: Date | null
  challengeFreezeAt: Date | null
  workDeadline: Date | null
  scoreDeadline: Date | null
  settleDate: Date | null
}

export function scheduleToColumns(schedule: SeasonSchedule): SeasonScheduleColumns {
  return {
    applyOpen: new Date(schedule.applyOpen),
    applyClose: new Date(schedule.applyClose),
    startAt: new Date(schedule.startAt),
    teamDeadline: new Date(schedule.teamDeadline),
    challengeFreezeAt: new Date(schedule.challengeFreezeAt),
    workDeadline: new Date(schedule.workDeadline),
    scoreDeadline: new Date(schedule.scoreDeadline),
    settleDate: new Date(schedule.settleDate),
  }
}

export function scheduleFromRow(row: SeasonScheduleColumns): SeasonSchedule | null {
  if (
    !row.applyOpen || !row.applyClose || !row.startAt || !row.teamDeadline ||
    !row.challengeFreezeAt || !row.workDeadline || !row.scoreDeadline || !row.settleDate
  ) return null
  return {
    applyOpen: row.applyOpen.toISOString(),
    applyClose: row.applyClose.toISOString(),
    startAt: row.startAt.toISOString(),
    teamDeadline: row.teamDeadline.toISOString(),
    challengeFreezeAt: row.challengeFreezeAt.toISOString(),
    workDeadline: row.workDeadline.toISOString(),
    scoreDeadline: row.scoreDeadline.toISOString(),
    settleDate: row.settleDate.toISOString(),
  }
}
