import { t } from 'elysia'

export const ChallengeIdParams = t.Object({
  id: t.Numeric({ description: 'Challenge ID' }),
})

export const ChallengeResourceIdParams = t.Object({
  id: t.Numeric({ description: 'Challenge resource ID' }),
})

export const SeasonChallengesParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
})

export const ListSeasonChallengesQuery = t.Object({
  includeDrafts: t.Optional(t.String({ description: '"true" to include drafts' })),
})

/**
 * 发布命题的可选说明（契约 §1.2：`note = changeNote ?? '发布命题'`）。
 *
 * 单独一个 model 而不是复用 UpdateChallengeBody：发布只改状态，不该允许
 * 顺手改内容（那会让「发布」和「编辑」两个版本记录的语义混在一起）。
 */
export const PublishChallengeBody = t.Object({
  changeNote: t.Optional(t.Union([t.String(), t.Null()])),
})

const ChallengeTextField = t.Optional(t.Union([t.String({ minLength: 1, maxLength: 20000 }), t.Null()]))

/**
 * 命题的分类字段（类型 / 主题 / 企业 / 容量）。
 *
 * 这里只校验「形状」（字符串或 null、长度上限），枚举与归属校验放在 service：
 * 只有那里才能抛出带 `field` 的 `VALIDATION_ERROR`，前端表单才标得出具体是哪个输入框。
 * 用 TypeBox 的枚举校验只会得到一条没有 field 的通用 400。
 */
const ChallengeTypeField = t.Optional(t.Union([t.String({ maxLength: 32 }), t.Null()]))
const ChallengeThemeField = t.Optional(t.Union([t.String({ maxLength: 50 }), t.Null()]))
const ChallengeEnterpriseField = t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()]))
const ChallengeCapacityField = t.Optional(t.Union([t.Number(), t.Null()]))

/**
 * 命题详情页新增的可选字段（契约 §3.3）。
 *
 * 这里**只校验形状**：长度上限（`CHALLENGE_CARD_LIMITS`）、五维权重合计、
 * 整数区间全部放在 service —— 只有那里才能返回带 `field` 的
 * `VALIDATION_ERROR`，前端表单才标得出具体是哪个输入框。
 * 把 `maxLength` 写进 TypeBox 只会得到一条没有 field 的通用 400。
 */
const ChallengeDetailFields = {
  summary: t.Optional(t.Union([t.String(), t.Null()])),
  background: t.Optional(t.Union([t.String(), t.Null()])),
  industry: t.Optional(t.Union([t.String(), t.Null()])),
  scope: t.Optional(t.Union([t.String(), t.Null()])),
  outOfScope: t.Optional(t.Union([t.String(), t.Null()])),
  monthlyGoal: t.Optional(t.Union([t.String(), t.Null()])),
  /** 建议技能：条数与单条长度在 service 校验（`suggestedSkills`）。 */
  suggestedSkills: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
  teamCapacity: t.Optional(t.Union([t.Number(), t.Null()])),
  ownerName: t.Optional(t.Union([t.String(), t.Null()])),
  responseSla: t.Optional(t.Union([t.String(), t.Null()])),
  /** 五维权重：key 合法性、0–100 整数、合计 100 在 service 校验。 */
  scoringWeights: t.Optional(t.Union([t.Record(t.String(), t.Number()), t.Null()])),
  singleWorkCap: t.Optional(t.Union([t.Number(), t.Null()])),
  rightsPublicScope: t.Optional(t.Union([t.String(), t.Null()])),
  rightsConfidentiality: t.Optional(t.Union([t.String(), t.Null()])),
  rightsIp: t.Optional(t.Union([t.String(), t.Null()])),
  rightsEnterpriseUsage: t.Optional(t.Union([t.String(), t.Null()])),
  rightsProcurement: t.Optional(t.Union([t.String(), t.Null()])),
  rightsSpecialTerms: t.Optional(t.Union([t.String(), t.Null()])),
  rightsExclusivity: t.Optional(t.Union([t.String(), t.Null()])),
  /** 只用于写 `challenge_versions`，不落 `challenges` 表。 */
  changeNote: t.Optional(t.Union([t.String(), t.Null()])),
}

export const CreateChallengeBody = t.Object({
  title: t.String({ minLength: 2, maxLength: 255 }),
  realProblem: ChallengeTextField,
  targetCustomer: ChallengeTextField,
  minimumDeliverable: ChallengeTextField,
  resourceCommitment: ChallengeTextField,
  resultEvidenceRules: ChallengeTextField,
  type: ChallengeTypeField,
  theme: ChallengeThemeField,
  enterpriseName: ChallengeEnterpriseField,
  capacity: ChallengeCapacityField,
  ...ChallengeDetailFields,
})

export const UpdateChallengeBody = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
  realProblem: ChallengeTextField,
  targetCustomer: ChallengeTextField,
  minimumDeliverable: ChallengeTextField,
  resourceCommitment: ChallengeTextField,
  resultEvidenceRules: ChallengeTextField,
  type: ChallengeTypeField,
  theme: ChallengeThemeField,
  enterpriseName: ChallengeEnterpriseField,
  capacity: ChallengeCapacityField,
  ...ChallengeDetailFields,
})

/**
 * 资源清单的一条。
 *
 * `status` 留空表示「已承诺」—— 新建资源时默认口径就是承诺兑现，
 * 主办方之后按 CHG-004 逐条推进到「已提供 / 已使用」。
 */
export const ChallengeResourceItem = t.Object({
  kind: t.String({ minLength: 1, maxLength: 24 }),
  title: t.String({ minLength: 1, maxLength: 255 }),
  quantity: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  conditions: t.Optional(t.Union([t.String({ maxLength: 20000 }), t.Null()])),
  owner: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  status: t.Optional(t.Union([t.String({ maxLength: 16 }), t.Null()])),
})

/**
 * 整表替换的请求体。
 *
 * 刻意不写 `maxItems`：条数上限（`MAX_CHALLENGE_RESOURCES`）在 service 里校验，
 * 那样超限时能返回带 `field: 'items'` 的中文错误，而不是一条通用 400。
 */
export const ReplaceChallengeResourcesBody = t.Object({
  items: t.Array(ChallengeResourceItem),
})

/** 单条资源的部分更新；主要用途是把 `status` 推进到下一档。 */
export const PatchChallengeResourceBody = t.Object({
  kind: t.Optional(t.String({ minLength: 1, maxLength: 24 })),
  title: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
  quantity: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  conditions: t.Optional(t.Union([t.String({ maxLength: 20000 }), t.Null()])),
  owner: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  status: t.Optional(t.String({ maxLength: 16 })),
})

export type CreateChallengeBody = typeof CreateChallengeBody.static
export type UpdateChallengeBody = typeof UpdateChallengeBody.static
export type PublishChallengeBody = typeof PublishChallengeBody.static
export type ReplaceChallengeResourcesBody = typeof ReplaceChallengeResourcesBody.static
export type PatchChallengeResourceBody = typeof PatchChallengeResourceBody.static