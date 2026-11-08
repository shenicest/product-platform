import {
  CHALLENGE_CAPACITY_LIMITS,
  CHALLENGE_RESOURCE_KINDS,
  CHALLENGE_RESOURCE_KIND_LABELS,
  CHALLENGE_RESOURCE_STATUSES,
  CHALLENGE_RESOURCE_STATUS_LABELS,
  CHALLENGE_TYPES,
  CHALLENGE_TYPE_HINTS,
  CHALLENGE_TYPE_LABELS,
  ChallengeResourceKind,
  ChallengeResourceStatus,
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

/**
 * `GET /seasons/:id/challenges?includeDrafts=true` 的一行。
 *
 * 在既有五件套字段上新增 `type` / `theme` / `enterpriseName` / `capacity`
 * 与三个派生字段（`selectedCount` / `fivePieceComplete` / `missingFields`）。
 * 派生字段以后端为准，前端不重算 —— 发布按钮的可用性必须与后端判定一致。
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
