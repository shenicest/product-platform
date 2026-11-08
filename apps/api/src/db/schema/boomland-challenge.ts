import { index, int, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core'
import {
  ChallengeResourceStatus,
  EnterpriseCooperationStatus,
  EnterprisePublicScope,
} from '@shenicest/shared'

export const challenges = mysqlTable('challenges', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  /** 四类命题之一（`ChallengeType`）；未分类为 null。不参与发布门槛。 */
  type: varchar('type', { length: 32 }),
  /** 赛季主题，必须取自该赛季 `seasons.themes` 的某一项；可为空。 */
  theme: varchar('theme', { length: 50 }),
  /**
   * 出题企业名。与 `season_enterprise_cooperations.enterprise_name` 是**同一个字符串**
   * （不做外键）：企业合作配置可以晚于命题录入，也可能一个企业有多条档位配置，
   * 用名字对齐比用 id 更稳，且不会因为删掉一条配置就把命题的企业归属清空。
   */
  enterpriseName: varchar('enterprise_name', { length: 255 }),
  /** 命题容量：该命题下最多几个参赛项目；null = 不限。 */
  capacity: int('capacity'),
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

/**
 * 资源承诺清单（产品文档 CHG-001「资源承诺表」）。
 *
 * 与 `challenges.resourceCommitment` 的分工：那一列是给选手看的**承诺摘要**文本，
 * 这张表是主办方**逐条跟踪兑现状态**的清单（CHG-004）。两者都要有 ——
 * 摘要决定选手看到什么，清单决定主办方兑现到哪一步。
 */
export const challengeResources = mysqlTable('challenge_resources', {
  id: int('id').primaryKey().autoincrement(),
  challengeId: int('challenge_id').notNull(),
  /** `ChallengeResourceKind`：资金 / 真实需求 / 数据库 / 专家渠道 / 合作机会 / 工具场地。 */
  kind: varchar('kind', { length: 24 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  /** 数量 / 条件摘要，如「3 个站点」「2 家客户对接」。 */
  quantity: varchar('quantity', { length: 100 }),
  conditions: text('conditions'),
  owner: varchar('owner', { length: 255 }),
  /** `ChallengeResourceStatus`，默认「已承诺」。 */
  status: varchar('status', { length: 16 }).notNull().default(ChallengeResourceStatus.Committed),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index('idx_challenge_resources_challenge_order').on(table.challengeId, table.sortOrder),
])

/**
 * 企业合作配置（产品文档 CHG-006）。
 *
 * 三项金额**分别记录**：管理费、平台服务费与奖金池出资口径不同，
 * 管理费不进入选手奖励账本 —— 所以不做「总费用 − 管理费」这类派生，
 * 三者各自落库、各自展示。
 */
export const seasonEnterpriseCooperations = mysqlTable('season_enterprise_cooperations', {
  id: int('id').primaryKey().autoincrement(),
  seasonId: int('season_id').notNull(),
  enterpriseName: varchar('enterprise_name', { length: 255 }).notNull(),
  /** `EnterpriseCooperationTier`：联合出品 / 合作 / 资源合作 / 意向。 */
  tier: varchar('tier', { length: 24 }).notNull(),
  /** 等级（金银标），商务口径，可空。 */
  grade: varchar('grade', { length: 16 }),
  /** 总费用（元）。 */
  totalAmount: int('total_amount').notNull().default(0),
  /** 管理费（元）—— 不进选手奖励账本。 */
  managementFee: int('management_fee').notNull().default(0),
  /** 奖金池出资（元）。 */
  prizePoolAmount: int('prize_pool_amount').notNull().default(0),
  /** 数据授权说明。 */
  dataGrant: text('data_grant'),
  /** `EnterprisePublicScope`：能否公开企业名称与命题。 */
  publicScope: varchar('public_scope', { length: 16 }).notNull().default(EnterprisePublicScope.Anonymous),
  /** `EnterpriseCooperationStatus`：已签约 / 洽谈中。 */
  status: varchar('status', { length: 16 }).notNull().default(EnterpriseCooperationStatus.Intent),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => [
  index('idx_season_cooperations_season_order').on(table.seasonId, table.sortOrder),
])
