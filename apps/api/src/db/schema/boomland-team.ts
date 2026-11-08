import { index, int, json, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import {
  RecruitmentApplicationStatus,
  RecruitmentCardStatus,
  SeasonProjectMemberRole,
  SeasonProjectMemberStatus,
  SeasonProjectSource,
  SeasonProjectStage,
  SeasonProjectStatus,
} from '@shenicest/shared'

/**
 * 赛季项目：长期项目（`projects`）参加某一赛季的记录。
 *
 * **为什么是关联表而不是往 `projects` 上加字段**：产品共生里的项目是长期主体，
 * 同一个项目可以先后带入多个赛季（PRD LIB-003），每个赛季的积分、命题、成员
 * 都各算各的。用 `projects.seasonId` 这种单值字段表达不了「一对多」，而且
 * 赛季一结束就得把字段清空，历史归属就丢了。
 *
 * 项目**内容**（名称、简介、封面…）仍然只在 `projects` 里存一份；这张表只放
 * 赛季范围的归属与配置。所以读取 DTO 时需要 join `projects` 取名称与简介。
 */
export const seasonProjects = mysqlTable('season_projects', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  projectId: int('project_id').notNull(),
  ownerUserId: varchar('owner_user_id', { length: 255 }).notNull(),
  /** `SeasonProjectSource`：赛季内新建 / 带入已有项目。 */
  source: varchar('source', { length: 16 }).notNull().default(SeasonProjectSource.Created),
  /** 本项目选择的赛季方向，取自 `seasons.themes` 的子集。 */
  themes: json('themes').$type<string[]>().notNull(),
  /** 主/辅命题 id 数组：平行、无主次，数量受 `rules.maxChallengesPerProject` 约束。 */
  challengeIds: json('challenge_ids').$type<number[]>().notNull(),
  /** `SeasonProjectStatus`：draft / published / archived。 */
  status: varchar('status', { length: 16 }).notNull().default(SeasonProjectStatus.Published),
  /**
   * `SeasonProjectStage`：seed → sprout → grow → bloom → fruit → boom。
   *
   * 只前进不回退；本批只做展示（命题详情页「选择本命题的项目」），阶段流转接口不在本批。
   */
  stage: varchar('stage', { length: 16 }).notNull().default(SeasonProjectStage.Seed),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  // 同一项目在同一赛季只能有一条赛季项目记录（PRD 5.3 硬性口径）。
  uniqueIndex('uq_season_projects_season_project').on(table.seasonId, table.projectId),
  index('idx_season_projects_season_status').on(table.seasonId, table.status),
  index('idx_season_projects_owner').on(table.ownerUserId),
])

/**
 * 赛季项目核心成员。
 *
 * 本批只写 `owner`（发起时自动 `accepted`）：邀请 / 移除接口属于 P1，
 * 但表先建好，否则「组队规则」卡里的核心人数、以及招募申请被接受之后
 * 「等发起人登记你」的文案都没有真实数据可依。
 */
export const seasonProjectMembers = mysqlTable('season_project_members', {
  id: int('id').primaryKey().autoincrement(),
  seasonProjectId: int('season_project_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  /** `SeasonProjectMemberRole`：owner / core。 */
  role: varchar('role', { length: 16 }).notNull().default(SeasonProjectMemberRole.Core),
  /** `SeasonProjectMemberStatus`：invited / accepted / removed。 */
  status: varchar('status', { length: 16 }).notNull().default(SeasonProjectMemberStatus.Invited),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  uniqueIndex('uq_season_project_members_project_user').on(table.seasonProjectId, table.userId),
  index('idx_season_project_members_user').on(table.userId),
])

/**
 * 招募卡（PRD 5.8 / TAL-003，P1）。
 *
 * 一个赛季项目同时最多一张 `open` 卡：再开一张会让申请者分不清该投哪张，
 * 也让「已发布招募卡」这个状态在 UI 上无处安放。
 */
export const recruitmentCards = mysqlTable('recruitment_cards', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  seasonProjectId: int('season_project_id').notNull(),
  creatorUserId: varchar('creator_user_id', { length: 255 }).notNull(),
  /** 需要的角色，自由文本数组（如「前端」「数据分析」）。 */
  roles: json('roles').$type<string[]>().notNull(),
  /** 技能关键词，可空（如「小程序」「Python」）。 */
  skills: json('skills').$type<string[]>().notNull(),
  description: text('description').notNull(),
  deadline: timestamp('deadline').notNull(),
  /** `RecruitmentCardStatus`：open / closed。 */
  status: varchar('status', { length: 16 }).notNull().default(RecruitmentCardStatus.Open),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index('idx_recruitment_cards_season_status').on(table.seasonId, table.status),
  index('idx_recruitment_cards_project').on(table.seasonProjectId),
  index('idx_recruitment_cards_creator').on(table.creatorUserId),
])

/**
 * 招募申请（PRD 5.8，P1）。
 *
 * 接受申请**不等于**登记为赛季核心成员（PRD 原文）：组队仍走 `season_project_members`
 * 的登记与确认流程。所以这里只记录申请本身的处理结果。
 */
export const recruitmentApplications = mysqlTable('recruitment_applications', {
  id: int('id').primaryKey().autoincrement(),
  cardId: int('card_id').notNull(),
  applicantUserId: varchar('applicant_user_id', { length: 255 }).notNull(),
  message: text('message').notNull(),
  /** `RecruitmentApplicationStatus`：pending / accepted / declined。 */
  status: varchar('status', { length: 16 }).notNull().default(RecruitmentApplicationStatus.Pending),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  // 同一张卡同一人只能申请一次：重复提交是误操作，不是新信息。
  uniqueIndex('uq_recruitment_applications_card_applicant').on(table.cardId, table.applicantUserId),
  index('idx_recruitment_applications_card_status').on(table.cardId, table.status),
  index('idx_recruitment_applications_applicant').on(table.applicantUserId),
])
