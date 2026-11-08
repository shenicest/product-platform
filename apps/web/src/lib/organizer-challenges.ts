import {
  CHALLENGE_CAPACITY_LIMITS,
  CHALLENGE_CARD_LIMITS,
  CHALLENGE_RESOURCE_KINDS,
  CHALLENGE_RESOURCE_KIND_LABELS,
  CHALLENGE_RESOURCE_STATUSES,
  CHALLENGE_RESOURCE_STATUS_LABELS,
  CHALLENGE_RIGHTS_FIELDS,
  CHALLENGE_RIGHTS_FIELD_LABELS,
  CHALLENGE_SCORING_DIMENSIONS,
  CHALLENGE_SCORING_DIMENSION_LABELS,
  CHALLENGE_SCORING_WEIGHT_MAX,
  CHALLENGE_SCORING_WEIGHT_TOTAL,
  CHALLENGE_TYPES,
  CHALLENGE_TYPE_HINTS,
  CHALLENGE_TYPE_LABELS,
  ChallengeResourceKind,
  ChallengeResourceStatus,
  ChallengeScoringDimension,
  ChallengeStatus,
  ENTERPRISE_COOPERATION_AMOUNT_LIMITS,
  ENTERPRISE_COOPERATION_STATUS_LABELS,
  ENTERPRISE_COOPERATION_TIER_LABELS,
  ENTERPRISE_COOPERATION_TIERS,
  ENTERPRISE_PUBLIC_SCOPE_LABELS,
  EnterpriseCooperationStatus,
  EnterprisePublicScope,
  MAX_CHALLENGE_RESOURCES,
  enterpriseCooperationStatusLabel,
  enterpriseCooperationTierLabel,
  enterprisePublicScopeLabel,
  seasonProjectStageLabel,
} from '@shenicest/shared'
import type { SeasonChallenge } from '@/lib/boomland'

/**
 * 命题与资源 tab 的纯函数与类型。
 *
 * 这里**只有**计算：没有 React、没有 fetch，方便直接单测。页面（Server Component）
 * 只负责取数，客户端视图只负责把这里的结果摆进 DOM。
 *
 * 口径提醒（见 docs/boomland/CONTEXT.md）：
 *   · 命题发布门槛只看**五件套**，`type` / `theme` / `enterpriseName` / `capacity`
 *     都不是必填项 —— 校验里不能把它们升级成发布条件；
 *   · 企业合作的三项金额（总费用 / 管理费 / 奖金池出资）**分别记录、分别展示**，
 *     管理费不进选手奖励账本，所以这里不提供任何「总费用 − 管理费」式派生函数。
 */

// ---------------------------------------------------------------------------
// 后端响应形状
// ---------------------------------------------------------------------------

/** 资源承诺清单的一行（`GET /seasons/:id/challenges` 里的 `resources`）。 */
export type ChallengeResourceDto = {
  id: number
  challengeId: number
  /** `ChallengeResourceKind` 六类之一。 */
  kind: string
  title: string
  quantity: string | null
  conditions: string | null
  owner: string | null
  /** `ChallengeResourceStatus` 六态之一。 */
  status: string
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

/** 命题版本记录的一行（`challenge_versions`，契约 §1.2）。 */
export type ChallengeVersionDto = {
  id: number
  /** 该条记录对应的命题版本号。 */
  version: number
  /** 变更说明（后端自动生成或取 `changeNote`）。 */
  note: string
  /** 操作人。 */
  changedBy: string
  createdAt: string
}

/**
 * 「选择本命题的项目」的一行（契约 §3.1 的 `projects`）。
 *
 * 与赛季项目列表同口径：只有未归档、且 `challengeIds` 含本命题的赛季项目。
 */
export type ChallengeProjectDto = {
  seasonProjectId: number
  projectId: number
  name: string
  tagline: string | null
  /** `SeasonProjectStage`；阶段只前进，本批只做展示。 */
  stage: string
  ownerName: string | null
}

/**
 * `GET /seasons/:id/challenges?includeDrafts=true` 的一行。
 *
 * 在既有五件套字段上新增 `type` / `theme` / `enterpriseName` / `capacity`
 * 与三个派生字段（`selectedCount` / `fivePieceComplete` / `missingFields`）。
 * 派生字段以后端为准，前端不重算 —— 发布按钮的可用性必须与后端判定一致。
 *
 * 第二批（命题详情页契约 §1.1 / §3.1）又加了命题卡正文、评分、七项权益、
 * `versions` 与 `projects`。**这些字段全部声明成可空**：后端可能还没上线，
 * 页面读不到时必须当成「未填写」，而不是崩在 `undefined.length` 上。
 */
export type ChallengeDto = SeasonChallenge & {
  type: string | null
  theme: string | null
  enterpriseName: string | null
  capacity: number | null
  /** 已被项目选择的次数；项目选择命题（CHG-003）未实现，本批恒为 0。 */
  selectedCount: number
  /** 五件套是否齐全（= 能否发布）。 */
  fivePieceComplete: boolean
  /** 缺失字段的中文名，发布按钮据此给提示。 */
  missingFields: string[]
  resources: ChallengeResourceDto[]

  /** 命题卡正文（契约 §1.1）。 */
  summary?: string | null
  background?: string | null
  /** 目标客户 / 产业对象。 */
  industry?: string | null
  scope?: string | null
  outOfScope?: string | null
  monthlyGoal?: string | null
  suggestedSkills?: string[]
  /** 团队容量（该命题下最多几个项目团队）；null = 不限。 */
  teamCapacity?: number | null
  ownerName?: string | null
  responseSla?: string | null

  /** 评分与奖励：五维权重；null = 未配置（按等权）。 */
  scoringWeights?: Record<string, number> | null
  /** 命题单次评分上限；null = 用赛季上限。 */
  singleWorkCap?: number | null

  /** 公开与权益：七项平铺在命题上，不套 `rights` 对象。 */
  rightsPublicScope?: string | null
  rightsConfidentiality?: string | null
  rightsIp?: string | null
  rightsEnterpriseUsage?: string | null
  rightsProcurement?: string | null
  rightsSpecialTerms?: string | null
  rightsExclusivity?: string | null

  /** 版本记录；后端未上线时缺省，视图一律 `?? []`。 */
  versions?: ChallengeVersionDto[]
  /** 选择本命题的项目；后端未上线时缺省，视图一律 `?? []`。 */
  projects?: ChallengeProjectDto[]
}

/** 企业合作配置的一行（`GET /seasons/:id/cooperations`）。 */
export type EnterpriseCooperationDto = {
  id: number
  seasonId: number
  enterpriseName: string
  /** `EnterpriseCooperationTier`。 */
  tier: string
  /** 等级（金银标），可空。 */
  grade: string | null
  /** 总费用（元）。 */
  totalAmount: number
  /** 管理费（元）—— 不进选手奖励账本。 */
  managementFee: number
  /** 奖金池出资（元）。 */
  prizePoolAmount: number
  dataGrant: string | null
  /** `EnterprisePublicScope`。 */
  publicScope: string
  /** `EnterpriseCooperationStatus`。 */
  status: string
  sortOrder: number
}

// ---------------------------------------------------------------------------
// 五件套
// ---------------------------------------------------------------------------

/**
 * 五件套的字段顺序与中文名。
 *
 * 中文名与后端 `FIELD_LABELS` 保持一致（`apps/api/src/modules/challenge/service.ts`）：
 * 同一个缺失项在接口的 `missingFields` 与页面提示里必须是同一个词，
 * 否则主办方会以为「资源投入」和「资源需求」是两个不同的坑。
 */
export const FIVE_PIECE_FIELDS = [
  { key: 'realProblem', label: '真实问题' },
  { key: 'targetCustomer', label: '目标客户' },
  { key: 'minimumDeliverable', label: '最小交付物' },
  { key: 'resourceCommitment', label: '资源投入' },
  { key: 'resultEvidenceRules', label: '结果证据规则' },
] as const satisfies ReadonlyArray<{
  key: 'realProblem' | 'targetCustomer' | 'minimumDeliverable' | 'resourceCommitment' | 'resultEvidenceRules'
  label: string
}>

type FivePieceFieldKey = (typeof FIVE_PIECE_FIELDS)[number]['key']

/**
 * 本地算一遍缺失的五件套字段。
 *
 * 展示以接口的 `missingFields` 为准（后端是裁判）；这个函数给两个地方兜底：
 *   · 单测里能独立验证「哪些字段算缺失」；
 *   · 后端老版本不返回派生字段时，视图还能给出正确提示。
 */
export function missingFivePieceFields(
  fields: Partial<Record<FivePieceFieldKey, string | null>>,
): string[] {
  return FIVE_PIECE_FIELDS.filter((field) => {
    const value = fields[field.key]
    return typeof value !== 'string' || value.trim().length === 0
  }).map((field) => field.label)
}

export type FivePieceSummary = {
  complete: boolean
  /** 表格里的短文案：`完整` / `缺失 2 项`。 */
  label: string
  tone: 'success' | 'warning'
  /** `title` 里列出缺什么，鼠标悬停即可知道要补哪些字段。 */
  title: string
}

/**
 * 五件套摘要。
 *
 * 只吃接口给的 `fivePieceComplete` / `missingFields`，不在前端重新判断 ——
 * 发布门槛的判定与「能不能点发布」必须是同一份结论。
 */
export function fivePieceSummary(input: {
  fivePieceComplete: boolean
  missingFields?: readonly string[]
}): FivePieceSummary {
  const missing = input.missingFields ?? []
  if (input.fivePieceComplete) {
    return { complete: true, label: '完整', tone: 'success', title: '五件套齐全，可以发布' }
  }
  // 后端说了不完整却没给清单：宁可显示「缺失」也不猜具体缺哪几项。
  const label = missing.length > 0 ? `缺失 ${missing.length} 项` : '缺失'
  return {
    complete: false,
    label,
    tone: 'warning',
    title: missing.length > 0 ? `还缺：${missing.join('、')}` : '五件套未齐全，暂不能发布',
  }
}

/** 发布按钮的 `title`：齐全时返回 `undefined`（不需要提示）。 */
export function publishBlockedReason(input: {
  fivePieceComplete: boolean
  missingFields?: readonly string[]
}): string | undefined {
  if (input.fivePieceComplete) return undefined
  const summary = fivePieceSummary(input)
  return `${summary.title}。补齐后才能发布。`
}

// ---------------------------------------------------------------------------
// 容量 / 金额 / 文本
// ---------------------------------------------------------------------------

/**
 * 「已选容量」的展示：`已选 / 容量`。
 *
 * 容量为空表示不限 —— 分母写「不限」而不是留白，否则 `0 / ` 看起来像数据缺了。
 */
export function capacityLabel(selectedCount: number | null | undefined, capacity: number | null): string {
  const selected = typeof selectedCount === 'number' && Number.isFinite(selectedCount)
    ? selectedCount
    : 0
  return capacity === null ? `${selected} / 不限` : `${selected} / ${capacity}`
}

const AMOUNT_FORMAT = new Intl.NumberFormat('en-US')

/**
 * 金额（元）的展示：千分位分隔，`0` 显示为破折号。
 *
 * 为什么 0 不显示 `0`：这三项金额里 0 的语义是「这一档没有这项费用」，
 * 写个 0 容易被当成「已确认是 0 元」；破折号读起来是「不适用」。
 */
export function formatAmount(yuan: number | null | undefined): string {
  if (yuan === null || yuan === undefined) return '—'
  if (!Number.isFinite(yuan)) return '—'
  if (yuan === 0) return '—'
  return AMOUNT_FORMAT.format(yuan)
}

/** 命题标题的兜底：标题是必填项，理论上不会空；真空了也别渲染成 `null`。 */
export function challengeTitleLabel(title: string | null | undefined): string {
  const trimmed = title?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : '未命名命题'
}

/** 赛季主题的兜底：未选主题时给出低调占位，而不是空白。 */
export function challengeThemeLabel(theme: string | null | undefined): string {
  return theme?.trim() ? theme.trim() : '未设置主题'
}

// ---------------------------------------------------------------------------
// 状态谓词
// ---------------------------------------------------------------------------

/**
 * 命题此刻能不能改内容 / 资源。
 *
 * 与后端 `update` / `PUT resources` 同口径：已关闭、已归档不可改
 * （`CHALLENGE_STATUS_LOCKED`），其余状态都可以。
 */
export function canEditChallenge(status: string): boolean {
  return status !== ChallengeStatus.Closed && status !== ChallengeStatus.Archived
}

/** 资源清单是否被状态锁住（已关闭 / 已归档）。 */
export function isChallengeLocked(status: string): boolean {
  return !canEditChallenge(status)
}

export type ChallengeRowActionKey = 'publish' | 'reference' | 'edit' | 'close' | 'archive'

/** 行内动作的展示文案（顺序即按钮顺序）。 */
export const CHALLENGE_ROW_ACTION_LABELS: Record<ChallengeRowActionKey, string> = {
  publish: '发布',
  reference: '转参考资料',
  edit: '编辑',
  close: '关闭',
  archive: '归档',
}

/**
 * 当前状态下可用的行内动作。
 *
 * 逐条对齐后端的状态机（`ChallengeService`）：
 *   · `publish`：draft / reference → published；
 *   · `reference`：draft → reference；
 *   · `edit`：除 closed / archived 外都能改（改已发布的命题会让 version +1）；
 *   · `close`：published → closed；
 *   · `archive`：published / closed → archived。
 *
 * 不在列表里的动作**不渲染**，而不是渲染成禁用按钮 —— 一个永远点不动的
 * 「归档」只会让人反复去点。
 */
export function challengeRowActions(status: string): ChallengeRowActionKey[] {
  const actions: ChallengeRowActionKey[] = []
  if (status === ChallengeStatus.Draft || status === ChallengeStatus.Reference) {
    actions.push('publish')
  }
  if (status === ChallengeStatus.Draft) actions.push('reference')
  if (canEditChallenge(status)) actions.push('edit')
  if (status === ChallengeStatus.Published) actions.push('close')
  if (status === ChallengeStatus.Published || status === ChallengeStatus.Closed) {
    actions.push('archive')
  }
  return actions
}

// ---------------------------------------------------------------------------
// 命题草稿表单
// ---------------------------------------------------------------------------

/**
 * 命题草稿的表单值。
 *
 * 全部用字符串：`capacity` 空串 = 不限（与赛季名额同口径），`type` / `theme`
 * 空串 = 未选择（落库为 null）。这样输入框不需要区分 `undefined` 与 `''`。
 */
export type ChallengeDraftValues = {
  title: string
  type: string
  theme: string
  realProblem: string
  resourceCommitment: string
  capacity: string
}

export type ChallengeDraftErrors = Partial<Record<keyof ChallengeDraftValues, string>>

/** `POST /seasons/:id/challenges` 与 `PATCH /challenges/:id` 的请求体。 */
export type ChallengeDraftPayload = {
  title: string
  type: string | null
  theme: string | null
  capacity: number | null
  realProblem: string | null
  resourceCommitment: string | null
}

export function emptyChallengeDraft(): ChallengeDraftValues {
  return {
    title: '',
    type: '',
    theme: '',
    realProblem: '',
    resourceCommitment: '',
    capacity: '',
  }
}

/** 编辑模式：用表格里的行回填表单。 */
export function challengeDraftFromRow(challenge: {
  title: string
  type: string | null
  theme: string | null
  realProblem: string | null
  resourceCommitment: string | null
  capacity: number | null
}): ChallengeDraftValues {
  return {
    title: challenge.title,
    type: challenge.type ?? '',
    theme: challenge.theme ?? '',
    realProblem: challenge.realProblem ?? '',
    resourceCommitment: challenge.resourceCommitment ?? '',
    capacity: challenge.capacity === null ? '' : String(challenge.capacity),
  }
}

/**
 * 草稿校验。
 *
 * 只有标题是必填 —— 五件套的其余四项可以之后再补（发布时才卡），
 * 所以它们**不在这里报错**。`theme` 非空时必须取自本赛季主题列表，
 * 与后端 `VALIDATION_ERROR field: 'theme'` 同口径。
 */
export function validateChallengeDraft(
  values: ChallengeDraftValues,
  options: { themes: readonly string[] },
): ChallengeDraftErrors {
  const errors: ChallengeDraftErrors = {}

  const title = values.title.trim()
  if (!title) errors.title = '请填写命题标题'
  else if (title.length < 2) errors.title = '命题标题至少 2 个字符'
  else if (title.length > 255) errors.title = '命题标题最多 255 个字符'

  if (values.type && !CHALLENGE_TYPES.includes(values.type as (typeof CHALLENGE_TYPES)[number])) {
    errors.type = '请选择有效的命题类型'
  }

  const theme = values.theme.trim()
  if (theme) {
    if (options.themes.length === 0) {
      errors.theme = '本赛季还没有赛季主题，先到「赛季设置」里添加'
    } else if (!options.themes.includes(theme)) {
      errors.theme = '赛季主题必须取自本赛季已配置的主题'
    }
  }

  const capacity = values.capacity.trim()
  if (capacity) {
    if (!/^\d+$/.test(capacity)) {
      errors.capacity = '命题容量必须是正整数'
    } else {
      const value = Number(capacity)
      if (value < CHALLENGE_CAPACITY_LIMITS.min || value > CHALLENGE_CAPACITY_LIMITS.max) {
        errors.capacity = `命题容量必须在 ${CHALLENGE_CAPACITY_LIMITS.min}–${CHALLENGE_CAPACITY_LIMITS.max} 之间`
      }
    }
  }

  if (values.realProblem.trim().length > 20_000) {
    errors.realProblem = '真实问题最多 20000 个字符'
  }
  if (values.resourceCommitment.trim().length > 20_000) {
    errors.resourceCommitment = '资源需求最多 20000 个字符'
  }

  return errors
}

/** 表单 → 请求体；调用前应先通过 {@link validateChallengeDraft}。 */
export function toChallengePayload(values: ChallengeDraftValues): ChallengeDraftPayload {
  const capacity = values.capacity.trim()
  return {
    title: values.title.trim(),
    type: values.type || null,
    theme: values.theme.trim() || null,
    capacity: capacity ? Number(capacity) : null,
    realProblem: values.realProblem.trim() || null,
    resourceCommitment: values.resourceCommitment.trim() || null,
  }
}

// ---------------------------------------------------------------------------
// 命题详情：命题卡内容 / 评分与奖励 / 公开与权益（契约 §1.1、§3.3、§4.2）
// ---------------------------------------------------------------------------

/**
 * 命题详情表单值。
 *
 * 全部用字符串（含权重与容量）：输入框需要保留「正在输入的中间态」，
 * 提交前再由 {@link toChallengeDetailPayload} 转成数字 / null。
 * 建议技能用逗号分隔的字符串 —— 胶囊输入在输入过程中也需要一个原始字符串。
 */
export type ChallengeDetailValues = {
  summary: string
  background: string
  /** 目标客户 / 产业对象。 */
  industry: string
  scope: string
  outOfScope: string
  monthlyGoal: string
  /** 建议技能：逗号（中英文均可）分隔，≤ 10 条，单条 ≤ 30 字。 */
  suggestedSkills: string
  teamCapacity: string
  ownerName: string
  responseSla: string
  /** 五维权重：每维一个字符串（0–100 整数）。 */
  weights: Record<ChallengeScoringDimension, string>
  singleWorkCap: string
  rightsPublicScope: string
  rightsConfidentiality: string
  rightsIp: string
  rightsEnterpriseUsage: string
  rightsProcurement: string
  rightsSpecialTerms: string
  rightsExclusivity: string
  /** 变更说明：只用于写版本记录，不落 `challenges` 表。 */
  changeNote: string
}

/**
 * 表单错误。
 *
 * `weights` 是「合计 ≠ 100」这类**组级**错误（摆在五个数字输入下方），
 * `weightOf` 是单维的格式错误（标红对应输入框）。两者分开：合计错了
 * 不代表某一维填错了，把五个框一起标红只会让人不知道改哪个。
 */
export type ChallengeDetailErrors = Partial<
  Record<Exclude<keyof ChallengeDetailValues, 'weights'>, string>
> & {
  weights?: string
  weightOf?: Partial<Record<ChallengeScoringDimension, string>>
}

/** `PATCH /challenges/:id` 的请求体（详情部分 + 版本说明）。 */
export type ChallengeDetailPayload = {
  summary: string | null
  background: string | null
  industry: string | null
  scope: string | null
  outOfScope: string | null
  monthlyGoal: string | null
  suggestedSkills: string[]
  teamCapacity: number | null
  ownerName: string | null
  responseSla: string | null
  scoringWeights: Record<string, number> | null
  singleWorkCap: number | null
  rightsPublicScope: string | null
  rightsConfidentiality: string | null
  rightsIp: string | null
  rightsEnterpriseUsage: string | null
  rightsProcurement: string | null
  rightsSpecialTerms: string | null
  rightsExclusivity: string | null
  /** 只有填写了才发：空串会被后端当成一条「没有说明」的版本记录。 */
  changeNote?: string
}

/** 空的权重表单值：全部空串 = 未配置（保存时落 null，按等权）。 */
export function emptyScoringWeights(): Record<ChallengeScoringDimension, string> {
  return CHALLENGE_SCORING_DIMENSIONS.reduce(
    (acc, dimension) => ({ ...acc, [dimension]: '' }),
    {} as Record<ChallengeScoringDimension, string>,
  )
}

export function emptyChallengeDetailDraft(): ChallengeDetailValues {
  return {
    summary: '',
    background: '',
    industry: '',
    scope: '',
    outOfScope: '',
    monthlyGoal: '',
    suggestedSkills: '',
    teamCapacity: '',
    ownerName: '',
    responseSla: '',
    weights: emptyScoringWeights(),
    singleWorkCap: '',
    rightsPublicScope: '',
    rightsConfidentiality: '',
    rightsIp: '',
    rightsEnterpriseUsage: '',
    rightsProcurement: '',
    rightsSpecialTerms: '',
    rightsExclusivity: '',
    changeNote: '',
  }
}

/** 建议技能的展示 / 回填口径：`、` 分隔（与详情页一致），提交前再拆开。 */
export function formatSuggestedSkills(skills: readonly string[] | null | undefined): string {
  return (skills ?? []).filter((skill) => skill.trim().length > 0).join('、')
}

/** 拆分建议技能：中英文逗号、顿号、换行都算分隔符；trim 后去空。 */
export function parseSuggestedSkills(raw: string): string[] {
  return raw
    .split(/[,，、\n]/)
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0)
}

/** 权重表单值：null / 缺失 = 未配置（全部空串），不伪造默认权重。 */
export function scoringWeightFormValues(
  weights: Record<string, number> | null | undefined,
): Record<ChallengeScoringDimension, string> {
  const base = emptyScoringWeights()
  if (!weights) return base
  for (const dimension of CHALLENGE_SCORING_DIMENSIONS) {
    const value = weights[dimension]
    if (typeof value === 'number' && Number.isFinite(value)) base[dimension] = String(value)
  }
  return base
}

/**
 * 五维权重合计（表单值的实时合计）。
 *
 * 空串按 0 计；非数字按 0 计 —— 合计提示只用来表达「离 100 还差多少」，
 * 具体的格式错误由校验函数逐维报。
 */
export function scoringWeightsTotal(
  weights: Record<ChallengeScoringDimension, string>,
): number {
  return CHALLENGE_SCORING_DIMENSIONS.reduce((sum, dimension) => {
    const value = Number(weights[dimension]?.trim())
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
}

/** 权重是否全部为空 / 0（= 未配置，保存时清空为 null）。 */
export function scoringWeightsAreEmpty(
  weights: Record<ChallengeScoringDimension, string>,
): boolean {
  return CHALLENGE_SCORING_DIMENSIONS.every((dimension) => {
    const raw = weights[dimension]?.trim()
    return !raw || Number(raw) === 0
  })
}

/**
 * 合计提示文案。
 *
 * 合计 ≠ 100 时返回一句**可直接展示**的说明（含当前合计与差额），
 * 合计正确或未配置时返回 `undefined` —— 正确的时候不该再占一行。
 */
export function scoringWeightsTotalHint(
  weights: Record<ChallengeScoringDimension, string>,
): string | undefined {
  if (scoringWeightsAreEmpty(weights)) return undefined
  const total = scoringWeightsTotal(weights)
  if (total === CHALLENGE_SCORING_WEIGHT_TOTAL) return undefined
  const diff = CHALLENGE_SCORING_WEIGHT_TOTAL - total
  return diff > 0
    ? `五维权重合计 ${total}，还差 ${diff} 才到 100，保存前需要补齐`
    : `五维权重合计 ${total}，超出 ${Math.abs(diff)}，保存前需要调整`
}

/**
 * 权重校验。
 *
 * 规则来自契约 §3.3：key 必须是五维之一（这里由类型保证）、值为 0–100 整数、
 * 合计必须为 100；**全 0 视为清空**（落 null，按等权），此时不要求合计。
 */
export function validateScoringWeights(
  weights: Record<ChallengeScoringDimension, string>,
): { weightOf: Partial<Record<ChallengeScoringDimension, string>>; weights?: string } {
  const weightOf: Partial<Record<ChallengeScoringDimension, string>> = {}
  for (const dimension of CHALLENGE_SCORING_DIMENSIONS) {
    const raw = weights[dimension]?.trim() ?? ''
    if (!raw) continue
    if (!/^\d+$/.test(raw)) {
      weightOf[dimension] = '权重必须是 0–100 的整数'
      continue
    }
    const value = Number(raw)
    if (value > CHALLENGE_SCORING_WEIGHT_MAX) {
      weightOf[dimension] = `权重必须在 0–${CHALLENGE_SCORING_WEIGHT_MAX} 之间`
    }
  }
  if (Object.keys(weightOf).length > 0) return { weightOf }
  if (scoringWeightsAreEmpty(weights)) return { weightOf }
  const total = scoringWeightsTotal(weights)
  if (total !== CHALLENGE_SCORING_WEIGHT_TOTAL) {
    const diff = CHALLENGE_SCORING_WEIGHT_TOTAL - total
    return {
      weightOf,
      weights:
        diff > 0
          ? `五维权重合计必须等于 100，当前 ${total}（还差 ${diff}）`
          : `五维权重合计必须等于 100，当前 ${total}（超出 ${Math.abs(diff)}）`,
    }
  }
  return { weightOf }
}

/** 编辑模式：用命题库的一行回填详情表单。缺失字段一律按「未填写」处理。 */
export function challengeDetailDraftFromRow(row: ChallengeDetailSource): ChallengeDetailValues {
  return {
    summary: row.summary ?? '',
    background: row.background ?? '',
    industry: row.industry ?? '',
    scope: row.scope ?? '',
    outOfScope: row.outOfScope ?? '',
    monthlyGoal: row.monthlyGoal ?? '',
    suggestedSkills: formatSuggestedSkills(row.suggestedSkills),
    teamCapacity: row.teamCapacity === null || row.teamCapacity === undefined
      ? ''
      : String(row.teamCapacity),
    ownerName: row.ownerName ?? '',
    responseSla: row.responseSla ?? '',
    weights: scoringWeightFormValues(row.scoringWeights),
    singleWorkCap: row.singleWorkCap === null || row.singleWorkCap === undefined
      ? ''
      : String(row.singleWorkCap),
    rightsPublicScope: row.rightsPublicScope ?? '',
    rightsConfidentiality: row.rightsConfidentiality ?? '',
    rightsIp: row.rightsIp ?? '',
    rightsEnterpriseUsage: row.rightsEnterpriseUsage ?? '',
    rightsProcurement: row.rightsProcurement ?? '',
    rightsSpecialTerms: row.rightsSpecialTerms ?? '',
    rightsExclusivity: row.rightsExclusivity ?? '',
    changeNote: '',
  }
}

/** {@link challengeDetailDraftFromRow} 的入参：只取回填要用的字段，可空。 */
export type ChallengeDetailSource = Partial<
  Pick<
    ChallengeDto,
    | 'summary'
    | 'background'
    | 'industry'
    | 'scope'
    | 'outOfScope'
    | 'monthlyGoal'
    | 'suggestedSkills'
    | 'teamCapacity'
    | 'ownerName'
    | 'responseSla'
    | 'scoringWeights'
    | 'singleWorkCap'
    | 'rightsPublicScope'
    | 'rightsConfidentiality'
    | 'rightsIp'
    | 'rightsEnterpriseUsage'
    | 'rightsProcurement'
    | 'rightsSpecialTerms'
    | 'rightsExclusivity'
  >
>

/** 文本字段的长度上限表（与后端共用 `CHALLENGE_CARD_LIMITS`）。 */
const DETAIL_TEXT_LIMITS: Array<{
  key: keyof ChallengeDetailValues
  label: string
  max: number
}> = [
  { key: 'summary', label: '简介', max: CHALLENGE_CARD_LIMITS.summary.max },
  { key: 'background', label: '背景', max: CHALLENGE_CARD_LIMITS.background.max },
  { key: 'industry', label: '目标客户 / 产业对象', max: CHALLENGE_CARD_LIMITS.industry.max },
  { key: 'scope', label: '范围', max: CHALLENGE_CARD_LIMITS.scope.max },
  { key: 'outOfScope', label: '不做什么', max: CHALLENGE_CARD_LIMITS.outOfScope.max },
  { key: 'monthlyGoal', label: '一个月最小成果', max: CHALLENGE_CARD_LIMITS.monthlyGoal.max },
  { key: 'ownerName', label: '负责人', max: CHALLENGE_CARD_LIMITS.ownerName.max },
  { key: 'responseSla', label: '响应时限', max: CHALLENGE_CARD_LIMITS.responseSla.max },
]

/** 整数范围字段的解析：空串 = 不限（null），非整数 / 越界给错误。 */
function parseOptionalInt(
  raw: string,
  limits: { min: number; max: number },
  label: string,
): { value: number | null; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: null }
  if (!/^\d+$/.test(trimmed)) return { value: null, error: `${label}必须是整数` }
  const value = Number(trimmed)
  if (value < limits.min || value > limits.max) {
    return { value: null, error: `${label}必须在 ${limits.min}–${limits.max} 之间` }
  }
  return { value }
}

/**
 * 详情表单校验。
 *
 * **没有必填项**：契约 §1.1 明确这些字段都不进发布门槛（发布仍只看五件套）。
 * 这里只校验格式与长度，避免把「先记一半」的动作堵死。
 */
export function validateChallengeDetailDraft(
  values: ChallengeDetailValues,
): ChallengeDetailErrors {
  const errors: ChallengeDetailErrors = {}

  for (const field of DETAIL_TEXT_LIMITS) {
    const raw = String(values[field.key] ?? '').trim()
    if (raw.length > field.max) {
      errors[field.key] = `${field.label}最多 ${field.max} 个字符`
    }
  }

  const skills = parseSuggestedSkills(values.suggestedSkills)
  if (skills.length > CHALLENGE_CARD_LIMITS.suggestedSkills.max) {
    errors.suggestedSkills = `建议技能最多 ${CHALLENGE_CARD_LIMITS.suggestedSkills.max} 条`
  } else if (skills.some((skill) => skill.length > CHALLENGE_CARD_LIMITS.suggestedSkills.itemMax)) {
    errors.suggestedSkills = `单条建议技能最多 ${CHALLENGE_CARD_LIMITS.suggestedSkills.itemMax} 个字符`
  }

  const teamCapacity = parseOptionalInt(
    values.teamCapacity,
    CHALLENGE_CARD_LIMITS.teamCapacity,
    '团队容量',
  )
  if (teamCapacity.error) errors.teamCapacity = teamCapacity.error

  const singleWorkCap = parseOptionalInt(
    values.singleWorkCap,
    CHALLENGE_CARD_LIMITS.singleWorkCap,
    '单次评分上限',
  )
  if (singleWorkCap.error) errors.singleWorkCap = singleWorkCap.error

  const weightErrors = validateScoringWeights(values.weights)
  if (Object.keys(weightErrors.weightOf).length > 0) errors.weightOf = weightErrors.weightOf
  if (weightErrors.weights) errors.weights = weightErrors.weights

  for (const field of CHALLENGE_RIGHTS_FIELDS) {
    const raw = values[field] ?? ''
    if (raw.trim().length > CHALLENGE_CARD_LIMITS.rights.max) {
      errors[field] = `最多 ${CHALLENGE_CARD_LIMITS.rights.max} 个字符`
    }
  }

  if (values.changeNote.trim().length > 255) {
    errors.changeNote = '变更说明最多 255 个字符'
  }

  return errors
}

/** 表单 → 请求体；调用前应先通过 {@link validateChallengeDetailDraft}。 */
export function toChallengeDetailPayload(
  values: ChallengeDetailValues,
): ChallengeDetailPayload {
  const text = (raw: string) => raw.trim() || null
  const changeNote = values.changeNote.trim()

  return {
    summary: text(values.summary),
    background: text(values.background),
    industry: text(values.industry),
    scope: text(values.scope),
    outOfScope: text(values.outOfScope),
    monthlyGoal: text(values.monthlyGoal),
    suggestedSkills: parseSuggestedSkills(values.suggestedSkills),
    teamCapacity: parseOptionalInt(
      values.teamCapacity,
      CHALLENGE_CARD_LIMITS.teamCapacity,
      '团队容量',
    ).value,
    ownerName: text(values.ownerName),
    responseSla: text(values.responseSla),
    // 全 0 / 全空 = 清空（落 null，按等权）；否则逐维转数字。
    scoringWeights: scoringWeightsAreEmpty(values.weights)
      ? null
      : CHALLENGE_SCORING_DIMENSIONS.reduce<Record<string, number>>((acc, dimension) => {
          const raw = values.weights[dimension]?.trim()
          acc[dimension] = raw ? Number(raw) : 0
          return acc
        }, {}),
    singleWorkCap: parseOptionalInt(
      values.singleWorkCap,
      CHALLENGE_CARD_LIMITS.singleWorkCap,
      '单次评分上限',
    ).value,
    rightsPublicScope: text(values.rightsPublicScope),
    rightsConfidentiality: text(values.rightsConfidentiality),
    rightsIp: text(values.rightsIp),
    rightsEnterpriseUsage: text(values.rightsEnterpriseUsage),
    rightsProcurement: text(values.rightsProcurement),
    rightsSpecialTerms: text(values.rightsSpecialTerms),
    rightsExclusivity: text(values.rightsExclusivity),
    ...(changeNote ? { changeNote } : {}),
  }
}

// ---------------------------------------------------------------------------
// 版本记录 / 选择本命题的项目（展示用）
// ---------------------------------------------------------------------------

/** 版本记录表的一行：命题 + 版本 + 说明 + 操作人 + 时间。 */
export type ChallengeVersionRow = {
  id: number
  challengeId: number
  /** 所属命题标题；表格加「命题」列后，多命题混排也能读。 */
  challengeTitle: string
  versionLabel: string
  note: string
  changedBy: string
  /** 展示用日期时间；无法解析时给「待定」。 */
  timeLabel: string
}

/**
 * 把所有命题的版本记录拍平成一张表的数据。
 *
 * 为什么加「命题」列而不是按命题分块：版本记录条数不定，分块会让页面在
 * 命题多的时候被撑得很长；一张表 + 「命题」列既能横向对比，也能按命题读。
 * 顺序：先按传入的命题顺序（= 命题库顺序），同一命题内版本号从新到旧。
 */
export function challengeVersionRows(
  challenges: readonly Pick<ChallengeDto, 'id' | 'title' | 'versions'>[],
): ChallengeVersionRow[] {
  return challenges.flatMap((challenge) => {
    const versions = [...(challenge.versions ?? [])]
    versions.sort((a, b) => b.version - a.version || b.id - a.id)
    return versions.map((version) => ({
      id: version.id,
      challengeId: challenge.id,
      challengeTitle: challengeTitleLabel(challenge.title),
      versionLabel: `v${version.version}`,
      note: version.note?.trim() || '—',
      changedBy: version.changedBy?.trim() || '—',
      timeLabel: formatDetailTimestamp(version.createdAt),
    }))
  })
}

/** 项目表的一行：命题 + 项目 + 阶段 + 负责人。 */
export type ChallengeProjectRow = {
  seasonProjectId: number
  projectId: number
  challengeId: number
  challengeTitle: string
  name: string
  stageLabel: string
  ownerName: string
}

/**
 * 把所有命题已选的项目拍平成一张表。
 *
 * 阶段用 shared 的 `seasonProjectStageLabel`（阶段只前进，本批只展示，
 * 不提供流转入口）；负责人为空时给破折号而不是空白。
 */
export function challengeProjectRows(
  challenges: readonly Pick<ChallengeDto, 'id' | 'title' | 'projects'>[],
): ChallengeProjectRow[] {
  return challenges.flatMap((challenge) =>
    (challenge.projects ?? []).map((project) => ({
      seasonProjectId: project.seasonProjectId,
      projectId: project.projectId,
      challengeId: challenge.id,
      challengeTitle: challengeTitleLabel(challenge.title),
      name: project.name?.trim() || '未命名项目',
      stageLabel: seasonProjectStageLabel(project.stage),
      ownerName: project.ownerName?.trim() || '—',
    })),
  )
}

const DETAIL_TIMESTAMP = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** `2026/11/08 20:10`；无法解析时给「待定」而不是 `Invalid Date`。 */
export function formatDetailTimestamp(value: string | null | undefined): string {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待定'
  return DETAIL_TIMESTAMP.format(date).replace(/\//g, '-')
}

/** 五维权重在展示时用的中文名（表单与表格共用，不另抄一份）。 */
export const SCORING_WEIGHT_OPTIONS = CHALLENGE_SCORING_DIMENSIONS.map((dimension) => ({
  dimension,
  label: CHALLENGE_SCORING_DIMENSION_LABELS[dimension],
}))

/** 七项权益的表单字段（顺序即展示顺序，标签取 shared）。 */
export const CHALLENGE_RIGHTS_FORM_FIELDS = CHALLENGE_RIGHTS_FIELDS.map((field) => ({
  key: field,
  label: CHALLENGE_RIGHTS_FIELD_LABELS[field],
}))

// ---------------------------------------------------------------------------
// 资源清单
// ---------------------------------------------------------------------------

export type ChallengeResourceDraft = {
  kind: string
  title: string
  quantity: string
  conditions: string
  owner: string
  status: string
}

/** 新增一行的默认值：类别默认「真实需求」，状态默认「已承诺」。 */
export function emptyResourceDraft(): ChallengeResourceDraft {
  return {
    kind: ChallengeResourceKind.RealDemand,
    title: '',
    quantity: '',
    conditions: '',
    owner: '',
    status: ChallengeResourceStatus.Committed,
  }
}

export function resourceDraftsFrom(items: readonly ChallengeResourceDto[]): ChallengeResourceDraft[] {
  return items.map((item) => ({
    kind: item.kind,
    title: item.title,
    quantity: item.quantity ?? '',
    conditions: item.conditions ?? '',
    owner: item.owner ?? '',
    status: item.status,
  }))
}

/** 资源清单的请求体（`PUT /challenges/:id/resources`，整表替换）。 */
export type ChallengeResourcePayload = {
  items: Array<{
    kind: string
    title: string
    quantity: string | null
    conditions: string | null
    owner: string | null
    status: string
  }>
}

/**
 * 资源清单校验；key 用 `行号.字段`，与表单里字段的定位口径一致。
 *
 * 上限取 `MAX_CHALLENGE_RESOURCES`（后端同样按 30 条拒），
 * 提前拦住比提交后拿到 400 更省事。
 */
export function validateResourceDrafts(
  rows: readonly ChallengeResourceDraft[],
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (rows.length > MAX_CHALLENGE_RESOURCES) {
    errors.items = `资源最多 ${MAX_CHALLENGE_RESOURCES} 条`
  }
  rows.forEach((row, index) => {
    const title = row.title.trim()
    if (!title) errors[`${index}.title`] = '请填写资源名称'
    else if (title.length > 255) errors[`${index}.title`] = '资源名称最多 255 个字符'
    if (!CHALLENGE_RESOURCE_KINDS.includes(row.kind as (typeof CHALLENGE_RESOURCE_KINDS)[number])) {
      errors[`${index}.kind`] = '请选择有效的资源类别'
    }
    if (!CHALLENGE_RESOURCE_STATUSES.includes(row.status as (typeof CHALLENGE_RESOURCE_STATUSES)[number])) {
      errors[`${index}.status`] = '请选择有效的资源状态'
    }
    if (row.quantity.trim().length > 100) errors[`${index}.quantity`] = '数量条件最多 100 个字符'
    if (row.owner.trim().length > 255) errors[`${index}.owner`] = '负责人最多 255 个字符'
    if (row.conditions.trim().length > 2000) errors[`${index}.conditions`] = '使用条件最多 2000 个字符'
  })
  return errors
}

/** 表单行 → 请求体；顺序即数组顺序（后端按 `sort_order` 落库）。 */
export function toResourcePayload(rows: readonly ChallengeResourceDraft[]): ChallengeResourcePayload {
  return {
    items: rows.map((row) => ({
      kind: row.kind,
      title: row.title.trim(),
      quantity: row.quantity.trim() || null,
      conditions: row.conditions.trim() || null,
      owner: row.owner.trim() || null,
      status: row.status,
    })),
  }
}

/**
 * 资源「数量 / 条件」单元格：优先给数量摘要，没有就退回使用条件，都没有给破折号。
 *
 * 两列（数量、条件）在卡片里合成一格展示：资源的数量与条件是同一件事的两面
 * （「3 个站点 · 需签保密协议」），拆成两列会把表格撑得很宽。
 */
export function resourceQuantityLabel(resource: {
  quantity: string | null
  conditions: string | null
}): string {
  const quantity = resource.quantity?.trim()
  if (quantity) return quantity
  const conditions = resource.conditions?.trim()
  return conditions || '—'
}

// ---------------------------------------------------------------------------
// 企业合作配置
// ---------------------------------------------------------------------------

/**
 * 企业合作配置的编辑行。
 *
 * 金额用字符串：输入框里要能保留「正在输入的中间态」（比如 `12` 打了一半），
 * 提交时再转数字；空串按 0 处理（后端三列都是 NOT NULL default 0）。
 */
export type CooperationDraft = {
  enterpriseName: string
  tier: string
  grade: string
  totalAmount: string
  managementFee: string
  prizePoolAmount: string
  dataGrant: string
  publicScope: string
  status: string
}

export function emptyCooperationDraft(): CooperationDraft {
  return {
    enterpriseName: '',
    tier: ENTERPRISE_COOPERATION_TIERS[0],
    grade: '',
    totalAmount: '',
    managementFee: '',
    prizePoolAmount: '',
    dataGrant: '',
    publicScope: EnterprisePublicScope.Anonymous,
    status: EnterpriseCooperationStatus.Intent,
  }
}

export function cooperationDraftsFrom(
  items: readonly EnterpriseCooperationDto[],
): CooperationDraft[] {
  return items.map((item) => ({
    enterpriseName: item.enterpriseName,
    tier: item.tier,
    grade: item.grade ?? '',
    totalAmount: String(item.totalAmount),
    managementFee: String(item.managementFee),
    prizePoolAmount: String(item.prizePoolAmount),
    dataGrant: item.dataGrant ?? '',
    publicScope: item.publicScope,
    status: item.status,
  }))
}

export type CooperationPayload = {
  items: Array<{
    enterpriseName: string
    tier: string
    grade: string | null
    totalAmount: number
    managementFee: number
    prizePoolAmount: number
    dataGrant: string | null
    publicScope: string
    status: string
  }>
}

/**
 * 三项金额的解析：空串 = 0，非整数 / 越界给错误。
 *
 * 这里**只做格式校验**：三项金额各自独立，互不推导。管理费不进入奖金账本
 * （CHG-006），任何「总费用 − 管理费 = 奖金池」的校验都会把合法的商务口径
 * 判成错误。
 */
function parseAmount(
  raw: string,
  label: string,
): { value: number; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: 0 }
  if (!/^\d+$/.test(trimmed)) return { value: 0, error: `${label}必须是整数（元）` }
  const value = Number(trimmed)
  const { min, max } = ENTERPRISE_COOPERATION_AMOUNT_LIMITS
  if (value < min || value > max) {
    return { value: 0, error: `${label}必须在 ${min}–${max} 元之间` }
  }
  return { value }
}

export function validateCooperationDrafts(
  rows: readonly CooperationDraft[],
): Record<string, string> {
  const errors: Record<string, string> = {}
  rows.forEach((row, index) => {
    const name = row.enterpriseName.trim()
    if (!name) errors[`${index}.enterpriseName`] = '请填写企业名称'
    else if (name.length > 255) errors[`${index}.enterpriseName`] = '企业名称最多 255 个字符'

    if (!ENTERPRISE_COOPERATION_TIERS.includes(row.tier as (typeof ENTERPRISE_COOPERATION_TIERS)[number])) {
      errors[`${index}.tier`] = '请选择有效的合作档位'
    }
    if (row.grade.trim().length > 16) errors[`${index}.grade`] = '等级最多 16 个字符'
    if (!ENTERPRISE_PUBLIC_SCOPES.includes(row.publicScope as (typeof ENTERPRISE_PUBLIC_SCOPES)[number])) {
      errors[`${index}.publicScope`] = '请选择有效的公开授权'
    }
    if (!ENTERPRISE_COOPERATION_STATUSES.includes(row.status as (typeof ENTERPRISE_COOPERATION_STATUSES)[number])) {
      errors[`${index}.status`] = '请选择有效的合作状态'
    }

    const total = parseAmount(row.totalAmount, '总费用')
    const management = parseAmount(row.managementFee, '管理费')
    const prize = parseAmount(row.prizePoolAmount, '奖金池出资')
    if (total.error) errors[`${index}.totalAmount`] = total.error
    if (management.error) errors[`${index}.managementFee`] = management.error
    if (prize.error) errors[`${index}.prizePoolAmount`] = prize.error

    if (row.dataGrant.trim().length > 2000) errors[`${index}.dataGrant`] = '数据授权最多 2000 个字符'
  })
  return errors
}

export function toCooperationPayload(rows: readonly CooperationDraft[]): CooperationPayload {
  return {
    items: rows.map((row) => ({
      enterpriseName: row.enterpriseName.trim(),
      tier: row.tier,
      grade: row.grade.trim() || null,
      totalAmount: parseAmount(row.totalAmount, '总费用').value,
      managementFee: parseAmount(row.managementFee, '管理费').value,
      prizePoolAmount: parseAmount(row.prizePoolAmount, '奖金池出资').value,
      dataGrant: row.dataGrant.trim() || null,
      publicScope: row.publicScope,
      status: row.status,
    })),
  }
}

export type CooperationDisplayRow = {
  id: number
  enterpriseName: string
  /** `档位 · 等级`（等级为空时只有档位）。 */
  tierLabel: string
  totalAmount: string
  managementFee: string
  prizePoolAmount: string
  dataGrant: string
  publicScopeLabel: string
  statusLabel: string
  /** 状态 chip 的色调：已签约是既成事实，洽谈中只是意向。 */
  statusTone: 'success' | 'warning'
}

/**
 * 表格行的展示值：金额千分位、枚举转中文。
 *
 * 三项金额各取各的字段，**不做任何换算** —— 表格里的三列是三个独立口径，
 * 换算过的数字看起来更「整齐」，但会让奖金账本对不上（CHG-006）。
 */
export function cooperationDisplayRows(
  items: readonly EnterpriseCooperationDto[],
): CooperationDisplayRow[] {
  return items.map((item) => ({
    id: item.id,
    enterpriseName: item.enterpriseName,
    tierLabel: enterpriseCooperationTierLabel(item.tier, item.grade),
    totalAmount: formatAmount(item.totalAmount),
    managementFee: formatAmount(item.managementFee),
    prizePoolAmount: formatAmount(item.prizePoolAmount),
    dataGrant: item.dataGrant?.trim() || '—',
    publicScopeLabel: enterprisePublicScopeLabel(item.publicScope),
    statusLabel: enterpriseCooperationStatusLabel(item.status),
    statusTone: item.status === EnterpriseCooperationStatus.Signed ? 'success' : 'warning',
  }))
}

// ---------------------------------------------------------------------------
// 选项
// ---------------------------------------------------------------------------

/**
 * 公开授权 / 合作状态的取值列表。
 *
 * shared 只为「档位」提供了数组常量（`ENTERPRISE_COOPERATION_TIERS`），另外两个
 * 枚举没有；这里从枚举对象派生，而不是再抄一遍字符串字面量 —— 增删取值时
 * 编译期就会跟上。
 */
export const ENTERPRISE_PUBLIC_SCOPES: readonly EnterprisePublicScope[] = Object.values(EnterprisePublicScope)
export const ENTERPRISE_COOPERATION_STATUSES: readonly EnterpriseCooperationStatus[] =
  Object.values(EnterpriseCooperationStatus)

/** 下拉选项的通用形状（与 `SelectInput` 的 `options` 对齐）。 */
export type ChoiceOption = { value: string; label: string }

/**
 * 命题类型下拉的选项；第一项是「未分类」（`type` 可空，不参与发布门槛）。
 *
 * 空串而不是 `null`：`SelectInput` 的 value 是字符串，用空串表达「没选」，
 * 提交前由 {@link toChallengePayload} 转成 `null`。
 */
export function challengeTypeOptions(): ChoiceOption[] {
  return [
    { value: '', label: '未分类' },
    ...CHALLENGE_TYPES.map((type) => ({ value: type, label: CHALLENGE_TYPE_LABELS[type] })),
  ]
}

/**
 * 类型说明文案（`CHALLENGE_TYPE_HINTS`）：目标 + 典型结果。
 * 未选择类型时返回 `undefined` —— 提示区不占位置。
 */
export function challengeTypeHint(type: string | null | undefined): string | undefined {
  if (!type) return undefined
  const hint = CHALLENGE_TYPE_HINTS[type as keyof typeof CHALLENGE_TYPE_HINTS]
  if (!hint) return undefined
  return `验证目标：${hint.goal}；典型结果：${hint.results}`
}

/** 资源类别下拉的选项（六类，顺序取 shared）。 */
export function resourceKindOptions(): ChoiceOption[] {
  return CHALLENGE_RESOURCE_KINDS.map((kind) => ({
    value: kind,
    label: CHALLENGE_RESOURCE_KIND_LABELS[kind],
  }))
}

/** 资源状态下拉的选项（六态，顺序取 shared）。 */
export function resourceStatusOptions(): ChoiceOption[] {
  return CHALLENGE_RESOURCE_STATUSES.map((status) => ({
    value: status,
    label: CHALLENGE_RESOURCE_STATUS_LABELS[status],
  }))
}

/** 合作档位下拉的选项。 */
export function cooperationTierOptions(): ChoiceOption[] {
  return ENTERPRISE_COOPERATION_TIERS.map((tier) => ({
    value: tier,
    label: ENTERPRISE_COOPERATION_TIER_LABELS[tier],
  }))
}

/** 公开授权下拉的选项；顺序取 shared 的枚举对象，不另抄一份字面量。 */
export function publicScopeOptions(): ChoiceOption[] {
  return Object.values(EnterprisePublicScope).map((scope) => ({
    value: scope,
    label: ENTERPRISE_PUBLIC_SCOPE_LABELS[scope],
  }))
}

/** 合作状态下拉的选项。 */
export function cooperationStatusOptions(): ChoiceOption[] {
  return Object.values(EnterpriseCooperationStatus).map((status) => ({
    value: status,
    label: ENTERPRISE_COOPERATION_STATUS_LABELS[status],
  }))
}
