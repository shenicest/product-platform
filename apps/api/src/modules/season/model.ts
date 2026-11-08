import { t } from 'elysia'
import { SEASON_RULE_LIMITS } from '@shenicest/shared'

export const SeasonIdParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
})

export const SeasonScheduleSchema = t.Object({
  applyOpen: t.String({ description: 'ISO 8601' }),
  applyClose: t.String({ description: 'ISO 8601' }),
  startAt: t.String({ description: 'ISO 8601' }),
  teamDeadline: t.String({ description: 'ISO 8601' }),
  challengeFreezeAt: t.String({ description: 'ISO 8601' }),
  workDeadline: t.String({ description: 'ISO 8601' }),
  scoreDeadline: t.String({ description: 'ISO 8601' }),
  settleDate: t.String({ description: 'ISO 8601' }),
})

/**
 * 计分口径三项：`null` 与 `0` 都表示「本季不计分」，所以下限是 0 且允许 null。
 *
 * 上下限取自 `SEASON_RULE_LIMITS`，避免后端校验与 shared 的领域常量漂移。
 */
function scoreValueSchema(limit: { min: number; max: number }) {
  return t.Union([
    t.Number({ minimum: limit.min, maximum: limit.max }),
    t.Null(),
  ])
}

export const SeasonRulesSchema = t.Object({
  maxChallengesPerProject: t.Number({
    minimum: SEASON_RULE_LIMITS.maxChallengesPerProject.min,
    maximum: SEASON_RULE_LIMITS.maxChallengesPerProject.max,
  }),
  maxProjectsPerParticipant: t.Number({
    minimum: SEASON_RULE_LIMITS.maxProjectsPerParticipant.min,
    maximum: SEASON_RULE_LIMITS.maxProjectsPerParticipant.max,
  }),
  maxCoreMembers: t.Number({
    minimum: SEASON_RULE_LIMITS.maxCoreMembers.min,
    maximum: SEASON_RULE_LIMITS.maxCoreMembers.max,
  }),
  singleWorkCap: scoreValueSchema(SEASON_RULE_LIMITS.singleWorkCap),
  exchangeRatio: scoreValueSchema(SEASON_RULE_LIMITS.exchangeRatio),
  reviewThreshold: scoreValueSchema(SEASON_RULE_LIMITS.reviewThreshold),
  dailyQuotaEnabled: t.Boolean(),
})

const SeasonTypeSchema = t.Union([t.Literal('season'), t.Literal('hackathon')])

export const CreateSeasonBody = t.Object({
  code: t.String({ minLength: 1, maxLength: 32, pattern: '^[A-Za-z0-9_-]+$' }),
  name: t.String({ minLength: 2, maxLength: 255 }),
  type: t.Optional(SeasonTypeSchema),
  city: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  intro: t.Optional(t.Union([t.String({ maxLength: 5000 }), t.Null()])),
  themes: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 20 })),
  schedule: t.Optional(t.Union([SeasonScheduleSchema, t.Null()])),
  rules: t.Optional(t.Partial(SeasonRulesSchema)),
  organizerOrgIds: t.Array(t.Number(), { minItems: 1 }),
  agreementVersion: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
  awardingEntity: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  participantCapacity: t.Optional(t.Union([t.Integer({ minimum: 1, maximum: 100000 }), t.Null()])),
})

export const UpdateSeasonBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
  type: t.Optional(SeasonTypeSchema),
  city: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  intro: t.Optional(t.Union([t.String({ maxLength: 5000 }), t.Null()])),
  themes: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 20 })),
  agreementVersion: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
  awardingEntity: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  participantCapacity: t.Optional(t.Union([t.Integer({ minimum: 1, maximum: 100000 }), t.Null()])),
})

const AnnouncementInput = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
  content: t.Optional(t.String({ minLength: 1, maxLength: 5000 })),
})

export const UpdateScheduleBody = t.Object({
  schedule: SeasonScheduleSchema,
  announcement: t.Optional(AnnouncementInput),
})

export const UpdateRulesBody = t.Object({
  rules: SeasonRulesSchema,
  announcement: t.Optional(AnnouncementInput),
})

export const UpdateRuleCardBody = t.Object({
  items: t.Array(t.Object({
    key: t.String({ minLength: 1, maxLength: 64 }),
    label: t.String({ minLength: 1, maxLength: 255 }),
    value: t.String({ minLength: 1 }),
    visible: t.Optional(t.Boolean()),
  })),
  announcement: t.Optional(AnnouncementInput),
})

/**
 * 赛季主题整表替换。
 *
 * 约束与 `CreateSeasonBody.themes` 完全一致（单条 ≤ 50 字、≤ 20 条）：
 * 主题既是赛季创建时的入参，也是这里单独维护的列表，两处口径必须一样，
 * 否则「创建时能填、保存时被拒」这种自相矛盾的体验就会冒出来。
 * trim / 去空 / 去重仍由 `normalizeThemes` 负责 —— 那是业务归一化，不是格式校验。
 */
export const UpdateSeasonThemesBody = t.Object({
  themes: t.Array(t.String({ maxLength: 50 }), { maxItems: 20 }),
})

/**
 * 企业合作配置的单条入参。
 *
 * 这里**只声明类型与必填**，不写长度上限、不写成 `t.Union([t.Literal(...)])`：
 * TypeBox 的校验失败只能给出统一的 `VALIDATION_ERROR`，说不出是第几条的哪个字段，
 * 而整表替换一次提交多行，前端必须拿到 `items[1].tier` 这样的定位才能改对。
 * 所以枚举取值、1..255、≤16、金额区间全部放到 service 里校验，错误里带 field。
 * 代价是超长字符串会先进入业务层再被拒 —— 一次请求的代价，换来可定位的错误。
 */
export const EnterpriseCooperationItemSchema = t.Object({
  enterpriseName: t.String(),
  tier: t.String(),
  grade: t.Optional(t.Union([t.String(), t.Null()])),
  totalAmount: t.Number(),
  managementFee: t.Number(),
  prizePoolAmount: t.Number(),
  dataGrant: t.Optional(t.Union([t.String(), t.Null()])),
  publicScope: t.String(),
  status: t.String(),
})

export const UpdateEnterpriseCooperationsBody = t.Object({
  items: t.Array(EnterpriseCooperationItemSchema),
})

export const UpdateOrganizersBody = t.Object({
  organizerOrgIds: t.Array(t.Number(), { minItems: 1 }),
})

export const ReasonBody = t.Object({
  reason: t.String({ minLength: 2, maxLength: 2000 }),
})

export const CloneSeasonBody = t.Object({
  code: t.String({ minLength: 1, maxLength: 32, pattern: '^[A-Za-z0-9_-]+$' }),
  name: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
})

export const PinBody = t.Object({
  pinned: t.Boolean(),
})

export const AnnouncementBody = t.Object({
  title: t.String({ minLength: 2, maxLength: 255 }),
  content: t.String({ minLength: 1, maxLength: 5000 }),
  category: t.Optional(t.Union([
    t.Literal('general'),
    t.Literal('schedule'),
    t.Literal('rules'),
  ])),
})

export const ListSeasonsQuery = t.Object({
  status: t.Optional(t.String()),
  type: t.Optional(SeasonTypeSchema),
  city: t.Optional(t.String()),
  theme: t.Optional(t.String()),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const ListManageQuery = t.Object({
  status: t.Optional(t.String()),
  pendingApproval: t.Optional(t.String()),
  type: t.Optional(SeasonTypeSchema),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const AuditQuery = t.Object({
  action: t.Optional(t.String()),
  targetType: t.Optional(t.String()),
  targetId: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export type CreateSeasonBody = typeof CreateSeasonBody.static
export type UpdateSeasonBody = typeof UpdateSeasonBody.static
export type UpdateScheduleBody = typeof UpdateScheduleBody.static
export type UpdateRulesBody = typeof UpdateRulesBody.static
export type UpdateRuleCardBody = typeof UpdateRuleCardBody.static
export type UpdateSeasonThemesBody = typeof UpdateSeasonThemesBody.static
export type EnterpriseCooperationItemInput = typeof EnterpriseCooperationItemSchema.static
export type UpdateEnterpriseCooperationsBody = typeof UpdateEnterpriseCooperationsBody.static
export type UpdateOrganizersBody = typeof UpdateOrganizersBody.static
export type CloneSeasonBody = typeof CloneSeasonBody.static
export type AnnouncementBody = typeof AnnouncementBody.static
export type ListSeasonsQuery = typeof ListSeasonsQuery.static
export type ListManageQuery = typeof ListManageQuery.static
export type AuditQuery = typeof AuditQuery.static
