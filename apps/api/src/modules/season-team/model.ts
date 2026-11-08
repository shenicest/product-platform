import { t } from 'elysia'
import { SEASON_PROJECT_LIMITS, SEASON_RULE_LIMITS } from '@shenicest/shared'

export const SeasonTeamParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
})

export const SeasonProjectParams = t.Object({
  id: t.Numeric({ description: 'Season project ID' }),
})

export const RecruitmentCardParams = t.Object({
  id: t.Numeric({ description: 'Recruitment card ID' }),
})

export const RecruitmentApplicationParams = t.Object({
  id: t.Numeric({ description: 'Recruitment application ID' }),
})

/**
 * 命题 id 数组的形状校验。
 *
 * 数量上限**不取** `SEASON_RULE_LIMITS.maxChallengesPerProject.max`（= 3）：
 * 真正生效的上限是 `seasons.rules.maxChallengesPerProject`，每个赛季可能不同，
 * 只能在拿到赛季行之后判断。若这里也按 3 卡死，超限请求会先被 TypeBox 拦成
 * 笼统的 `VALIDATION_ERROR`，前端就拿不到 `CHALLENGE_LIMIT_EXCEEDED` 这个
 * 能定位到字段的领域错误。这里只挡明显畸形的请求（防御一个超长数组进业务层）。
 */
const CHALLENGE_IDS_SCHEMA = t.Array(t.Integer({ minimum: 1 }), {
  minItems: 1,
  maxItems: SEASON_RULE_LIMITS.maxChallengesPerProject.max * 10,
})

const THEMES_SCHEMA = t.Array(t.String({ minLength: 1, maxLength: 50 }), {
  maxItems: SEASON_PROJECT_LIMITS.themes.max,
})

const CreateProjectBody = t.Object({
  mode: t.Literal('create'),
  name: t.String({
    minLength: SEASON_PROJECT_LIMITS.name.min,
    maxLength: SEASON_PROJECT_LIMITS.name.max,
  }),
  tagline: t.Optional(t.Union([t.String({ maxLength: SEASON_PROJECT_LIMITS.tagline.max }), t.Null()])),
  themes: t.Optional(THEMES_SCHEMA),
  challengeIds: CHALLENGE_IDS_SCHEMA,
})

const BringProjectBody = t.Object({
  mode: t.Literal('bring'),
  projectId: t.Integer({ minimum: 1 }),
  themes: t.Optional(THEMES_SCHEMA),
  challengeIds: CHALLENGE_IDS_SCHEMA,
})

/**
 * 发起项目 / 带入已有项目。
 *
 * 用 `mode` 判别而不是两个接口：两者在赛季层的产物完全一样（一条 `season_projects`
 * 关联行 + owner 成员行），差别只在项目内容从哪来。合成一个 body 让前端只有一套
 * 错误码与 DTO。
 */
export const CreateSeasonProjectBody = t.Union([CreateProjectBody, BringProjectBody])

export const SeasonProjectQuery = t.Object({
  seasonId: t.Optional(t.Numeric({ minimum: 1 })),
})

export const PublishRecruitmentCardBody = t.Object({
  seasonProjectId: t.Integer({ minimum: 1 }),
  roles: t.Array(
    t.String({ minLength: 1, maxLength: SEASON_PROJECT_LIMITS.roles.itemMax }),
    { minItems: SEASON_PROJECT_LIMITS.roles.min, maxItems: SEASON_PROJECT_LIMITS.roles.max },
  ),
  skills: t.Optional(t.Array(
    t.String({ minLength: 1, maxLength: SEASON_PROJECT_LIMITS.skills.itemMax }),
    { maxItems: SEASON_PROJECT_LIMITS.skills.max },
  )),
  description: t.String({
    minLength: SEASON_PROJECT_LIMITS.description.min,
    maxLength: SEASON_PROJECT_LIMITS.description.max,
  }),
  deadline: t.String({ minLength: 1, description: 'ISO 8601' }),
})

const RecruitmentCardStatusSchema = t.Union([t.Literal('open'), t.Literal('closed')])

export const UpdateRecruitmentCardBody = t.Object({
  status: RecruitmentCardStatusSchema,
})

export const ApplyRecruitmentCardBody = t.Object({
  message: t.String({ minLength: 1, maxLength: 2000 }),
})

const RecruitmentApplicationStatusSchema = t.Union([
  t.Literal('accepted'),
  t.Literal('declined'),
])

export const UpdateRecruitmentApplicationBody = t.Object({
  status: RecruitmentApplicationStatusSchema,
})

export type CreateSeasonProjectBody = typeof CreateSeasonProjectBody.static
export type SeasonProjectQuery = typeof SeasonProjectQuery.static
export type PublishRecruitmentCardBody = typeof PublishRecruitmentCardBody.static
export type UpdateRecruitmentCardBody = typeof UpdateRecruitmentCardBody.static
export type ApplyRecruitmentCardBody = typeof ApplyRecruitmentCardBody.static
export type UpdateRecruitmentApplicationBody = typeof UpdateRecruitmentApplicationBody.static
