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
export type ReplaceChallengeResourcesBody = typeof ReplaceChallengeResourcesBody.static
export type PatchChallengeResourceBody = typeof PatchChallengeResourceBody.static
