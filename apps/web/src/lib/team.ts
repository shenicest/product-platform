import {
  CATEGORIES,
  ChallengeStatus,
  RecruitmentApplicationStatus,
  RecruitmentCardStatus,
  SEASON_PROJECT_LIMITS,
  SEASON_RULE_DEFAULTS,
  SeasonProjectSource,
  SeasonProjectStatus,
  SeasonStatus,
  recruitmentApplicationStatusLabel,
  seasonProjectSourceLabel,
} from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import type { SeasonChallenge, SeasonSummary } from '@/lib/boomland'

/**
 * 个人中心「组队」tab 的纯函数与类型。
 *
 * 这里**只有**计算：没有 React、没有 fetch，方便直接单测。页面（Server Component）
 * 只负责取数，客户端组件只负责把这里的结果摆进 DOM。
 *
 * 权威契约：`docs/boomland/team-and-recruitment-api.md`。
 * 枚举一律从 `@shenicest/shared` 引入，这里只做「展示口径」的映射。
 */

// ---------------------------------------------------------------------------
// 后端响应形状（与契约 §3 的 DTO 一一对应）
// ---------------------------------------------------------------------------

/** 组队规则卡要展示的条目（`GET /seasons/:id/team/me` 的 `rules`）。 */
export type TeamRulesDto = {
  maxCoreMembers: number
  maxProjectsPerParticipant: number
  /**
   * 每个项目可选的平行命题数上限。
   *
   * 契约 §2.1 的 `rules` 示例里没有这一项，但规则卡第 5 条必须用到它；
   * 后端补上之前用 `SEASON_RULE_DEFAULTS` 兜底（见 {@link resolveMaxChallenges}）。
   */
  maxChallengesPerProject?: number | null
  teamDeadline: string | null
  deadlinePassed: boolean
}

export type SeasonProjectChallengeDto = {
  id: number
  title: string
  type: string | null
  capacity: number | null
  selectedCount: number
}

export type SeasonProjectMemberDto = {
  userId: string
  name: string | null
  avatarUrl: string | null
  role: string
  status: string
}

/** 赛季项目（契约 §3 `SeasonProject`）。 */
export type SeasonProjectDto = {
  id: number
  seasonId: number
  projectId: number
  ownerUserId: string
  source: string
  name: string
  tagline: string | null
  themes: string[]
  challengeIds: number[]
  challenges: SeasonProjectChallengeDto[]
  status: string
  members: SeasonProjectMemberDto[]
  createdAt: string
  updatedAt: string
}

/** 招募卡（契约 §3 `RecruitmentCard`）。 */
export type RecruitmentCardDto = {
  id: number
  seasonId: number
  seasonProjectId: number
  projectName: string
  creatorUserId: string
  creator: { userId: string; name: string | null; avatarUrl: string | null }
  roles: string[]
  skills: string[]
  description: string
  deadline: string
  status: string
  applicationCount: number
  createdAt: string
  updatedAt: string
}

/** 招募申请（契约 §3 `RecruitmentApplication`）。 */
export type RecruitmentApplicationDto = {
  id: number
  cardId: number
  applicantUserId: string
  applicant: { userId: string; name: string | null; avatarUrl: string | null }
  message: string
  status: string
  decidedAt: string | null
  createdAt: string
  card: {
    id: number
    projectName: string
    roles: string[]
    deadline: string
    status: string
  }
}

/** 选手行（未通过报名时为 null）。 */
export type TeamParticipantDto = {
  userId: string
  status: string
  wechatStatus: string | null
  /** 组队截止前且 `status=active` 才为 true —— 退出按钮的可用性以此为准。 */
  canWithdraw: boolean
}

/** `GET /seasons/:id/team/me` —— 组队 tab 首屏聚合。 */
export type TeamWorkbenchDto = {
  season: SeasonSummary
  participant: TeamParticipantDto | null
  application: { id: number; status: string } | null
  project: SeasonProjectDto | null
  recruitmentCard: RecruitmentCardDto | null
  myApplications: RecruitmentApplicationDto[]
  stats: {
    unassignedParticipantCount: number
    openRecruitmentCardCount: number
  }
  rules: TeamRulesDto
}

/**
 * 赛季命题的展示形状。
 *
 * 复用 `SeasonChallenge`（`GET /seasons/:id/challenges`），并补上项目选择命题
 * 需要的三个字段（后端命题 DTO 已有，只是 `lib/boomland.ts` 的类型没跟上）。
 */
export type TeamChallengeDto = SeasonChallenge & {
  type?: string | null
  capacity?: number | null
  selectedCount?: number | null
}

/**
 * 下拉 / 带入用的「我的项目」最小形状。
 *
 * `id` 是**被选中的那个 id**（带入时是长期项目 id，发布招募卡时是赛季项目 id），
 * `code` 是展示用的项目编号（`P-011` 里的 11）—— 两者在赛季项目上不相等，
 * 所以不能拿 `id` 去拼编号。
 */
export type ProjectOption = { id: number; name: string; code?: number }

// ---------------------------------------------------------------------------
// 状态与文案映射
// ---------------------------------------------------------------------------

const PROJECT_STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  [SeasonProjectStatus.Draft]: { label: '草稿', tone: 'neutral' },
  [SeasonProjectStatus.Published]: { label: '已发布', tone: 'success' },
  [SeasonProjectStatus.Archived]: { label: '已归档', tone: 'neutral' },
}

export function seasonProjectStatusMeta(status: string) {
  return PROJECT_STATUS_META[status] ?? { label: status, tone: 'neutral' as const }
}

const RECRUITMENT_CARD_STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  [RecruitmentCardStatus.Open]: { label: '招募中', tone: 'success' },
  [RecruitmentCardStatus.Closed]: { label: '已关闭', tone: 'neutral' },
}

export function recruitmentCardStatusMeta(status: string) {
  return RECRUITMENT_CARD_STATUS_META[status] ?? { label: status, tone: 'neutral' as const }
}

const APPLICATION_TONE: Record<string, ChipTone> = {
  [RecruitmentApplicationStatus.Pending]: 'warning',
  [RecruitmentApplicationStatus.Accepted]: 'success',
  [RecruitmentApplicationStatus.Declined]: 'neutral',
}

/** 申请状态的中文名来自 shared，这里只补色阶。 */
export function recruitmentApplicationMeta(status: string) {
  return {
    label: recruitmentApplicationStatusLabel(status),
    tone: APPLICATION_TONE[status] ?? ('neutral' as const),
  }
}

/** 项目来源（赛季内新建 / 带入已有）—— 文案来自 shared，这里只补色阶。 */
export function seasonProjectSourceMeta(source: string) {
  return {
    label: seasonProjectSourceLabel(source),
    tone: (source === SeasonProjectSource.BroughtIn ? 'sky' : 'accent') as ChipTone,
  }
}

/** 成员在项目里的角色文案。 */
export function seasonProjectMemberRoleLabel(role: string): string {
  return role === 'owner' ? '发起人' : '核心成员'
}

// ---------------------------------------------------------------------------
// 时间
// ---------------------------------------------------------------------------

const DEADLINE_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

/**
 * 组队截止时间的展示：`11月12日 23:59`。
 *
 * 单独写而不是复用 `formatDateTime`（`2026.11.12 23:59`）：规则卡是一条自然语言
 * 句子，「截止 11月12日 23:59」比「截止 2026.11.12 23:59」更像话。
 * 时间恒按北京时间渲染，与赛季页的赛程口径一致。
 */
export function formatDeadlineLabel(value: string | null | undefined): string {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待定'
  const parts = DEADLINE_FORMAT.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const month = pick('month')
  const day = pick('day')
  const hour = pick('hour').padStart(2, '0')
  const minute = pick('minute').padStart(2, '0')
  if (!month || !day) return '待定'
  return `${month}月${day}日 ${hour}:${minute}`
}

/**
 * 相对时间：`刚刚` / `14 分钟前` / `14 小时前` / `3 天前` / `2 个月前`。
 *
 * 分档口径：< 1 分钟 → 刚刚；< 60 分钟 → 分钟；< 24 小时 → 小时；
 * < 30 天 → 天；再往上按月（30 天）折算。未来时间按「刚刚」处理 ——
 * 客户端时钟比服务端慢时不该出现「-3 分钟前」。
 */
export function relativeTime(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = now.getTime() - date.getTime()
  if (diff <= 0) return '刚刚'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return `${Math.floor(days / 30)} 个月前`
}

/**
 * `<input type="date">` 的值（`YYYY-MM-DD`）→ ISO 时间戳。
 *
 * 截止日期是「那一天结束前有效」，所以按北京时间当天 23:59:59 落库；
 * 直接 `new Date('2026-11-19')` 会得到 UTC 零点，等于把截止时间提前了 8 小时。
 */
export function dateInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null
  const date = new Date(`${value.trim()}T23:59:59+08:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** `<input type="date">` 的 `min`：北京时间今天。 */
export function dateInputMin(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return parts
}

// ---------------------------------------------------------------------------
// 组队规则卡
// ---------------------------------------------------------------------------

/**
 * 规则卡的 bullet 列表。
 *
 * 第 1 / 4 / 5 条来自赛季配置（`rules`），其余三条是赛季级固定规则 ——
 * 它们不随赛季变化，但**必须**出现在这一屏：选手在组队时真正会问的就是
 * 「能不能一个人做」「成员退出会不会丢作品」。
 *
 * 截止时间缺失时降级成「截止时间待定」，不编造一个日期。
 */
export function teamRuleBullets(input: { rules: TeamRulesDto }): string[] {
  const { rules } = input
  const maxCore = rules.maxCoreMembers
  const maxProjects = rules.maxProjectsPerParticipant
  const maxChallenges = resolveMaxChallenges(rules)
  const deadline = formatDeadlineLabel(rules.teamDeadline)
  const deadlineClause =
    rules.teamDeadline === null
      ? '组队与命题变更截止时间待定'
      : `组队与命题变更截止 ${deadline}`

  return [
    `核心团队 1—${maxCore} 人，允许单人项目`,
    '核心成员必须是本赛季已通过报名的选手',
    '外部共建者可以留痕，不计入核心人数',
    `本赛季每人原则上 ${maxProjects} 个项目；${deadlineClause}`,
    `每个项目可选 1—${maxChallenges} 个平行命题，截止后改命题需主办方审批`,
    '成员退出不删除作品、积分与 Track Record',
  ]
}

/** `maxChallengesPerProject` 缺失时回落到赛季规则默认值（不猜成 1）。 */
export function resolveMaxChallenges(rules: TeamRulesDto): number {
  const value = rules.maxChallengesPerProject
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  return SEASON_RULE_DEFAULTS.maxChallengesPerProject
}

// ---------------------------------------------------------------------------
// 赛季选择
// ---------------------------------------------------------------------------

function parseSeasonId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * 决定这一屏该看哪个赛季。
 *
 * 顺序：URL 里的合法 id（且确实是我参加的赛季）→ 第一个进行中的赛季 →
 * 第一个即将开始的赛季 → 列表第一个。都没有时返回 null，调用方渲染空态。
 *
 * 只认「我参加的赛季」：组队数据按赛季取，随便给一个别人的赛季 id 只会拿到
 * 403/404，不如直接回落到我自己的赛季。
 */
export function resolveTeamSeasonId(
  raw: string | null | undefined,
  seasons: ReadonlyArray<{ id: number; status?: string }>,
): number | null {
  const parsed = parseSeasonId(raw)
  if (parsed !== null && seasons.some((season) => season.id === parsed)) return parsed
  const active = seasons.find((season) => season.status === SeasonStatus.Active)
  if (active) return active.id
  const upcoming = seasons.find((season) => season.status === SeasonStatus.Upcoming)
  if (upcoming) return upcoming.id
  return seasons[0]?.id ?? null
}

// ---------------------------------------------------------------------------
// 命题选择
// ---------------------------------------------------------------------------

/** 只有**已发布**的命题可以被项目正式选择（参考资料 / 草稿不行）。 */
export function challengeSelectable(challenge: TeamChallengeDto): boolean {
  return challenge.status === ChallengeStatus.Published
}

/** 不可选的那些命题 —— 弹窗底部的提示要用它们的标题。 */
export function unselectableChallenges(
  challenges: readonly TeamChallengeDto[],
): TeamChallengeDto[] {
  return challenges.filter((challenge) => !challengeSelectable(challenge))
}

/**
 * 「「AI 基建用电地图」是参考资料，不能正式选择。」这类提示。
 * 没有不可选命题时返回 null（不占位置）。
 */
export function unselectableChallengeHint(
  challenges: readonly TeamChallengeDto[],
): string | null {
  const blocked = unselectableChallenges(challenges)
  if (blocked.length === 0) return null
  const names = blocked.map((challenge) => `「${challenge.title}」`).join('、')
  return `${names}是参考资料，不能正式选择。`
}

/** 命题的副标题：`类型 · v版本 · 已选 N / 容量`。 */
export function challengeMetaLabel(challenge: TeamChallengeDto): string {
  const type = challenge.type?.trim() || '未分类'
  const version = `v${challenge.version}`
  const capacity =
    challenge.capacity === null || challenge.capacity === undefined
      ? '不限'
      : String(challenge.capacity)
  const selected = challenge.selectedCount ?? 0
  return `${type} · ${version} · 已选 ${selected} / ${capacity}`
}

/**
 * 方向（多选）的可选项：赛季 `themes`，为空时回落到平台品类 `CATEGORIES`。
 *
 * 截图里列的是平台品类，但契约要求「必须是 `seasons.themes` 子集」，
 * 所以优先用赛季配置；赛季没配方向时品类至少让表单能用（后端会按子集校验）。
 */
export function projectThemeOptions(themes: readonly string[] | null | undefined): string[] {
  const normalized = (themes ?? []).map((theme) => theme.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized : [...CATEGORIES]
}

// ---------------------------------------------------------------------------
// 逗号分隔的角色 / 技能
// ---------------------------------------------------------------------------

/**
 * 逗号分隔输入 → 字符串数组。
 *
 * 中英文逗号都认（中文输入法下打出「，」是常态），顺带 trim、去空、去重。
 * 不去重的话「前端，前端」会被后端当成两条角色，列表里就出现两个一模一样的胶囊。
 */
export function parseCommaList(raw: string): string[] {
  const seen = new Set<string>()
  const items: string[] = []
  for (const piece of raw.split(/[,，]/)) {
    const value = piece.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    items.push(value)
  }
  return items
}

/** 项目下拉 / 带入列表的展示：`P-011 峰谷电价计算器`。 */
export function projectOptionLabel(project: ProjectOption): string {
  const code = project.code ?? project.id
  return `P-${String(code).padStart(3, '0')} ${project.name}`
}

// ---------------------------------------------------------------------------
// 发起项目表单
// ---------------------------------------------------------------------------

export type ProjectDraftMode = 'create' | 'bring'

export type ProjectDraftValues = {
  mode: ProjectDraftMode
  /** 新建模式：项目名称。 */
  name: string
  /** 新建模式：一句话介绍（为谁解决什么问题）。 */
  tagline: string
  themes: string[]
  challengeIds: number[]
  /** 带入模式：要带入的长期项目 id。 */
  projectId: number | null
}

export type ProjectDraftErrors = Partial<
  Record<'name' | 'tagline' | 'themes' | 'challengeIds' | 'projectId', string>
>

export function emptyProjectDraft(mode: ProjectDraftMode = 'create'): ProjectDraftValues {
  return { mode, name: '', tagline: '', themes: [], challengeIds: [], projectId: null }
}

/**
 * 发起项目 / 带入已有项目的表单校验。
 *
 * 与契约 §2.2 同口径：命题必须取自本赛季**已发布**命题、数量 1—上限；
 * 方向数量 0—5；名称与介绍长度取 `SEASON_PROJECT_LIMITS`。
 * 带入模式不需要名称与介绍（内容已经在长期项目上）。
 */
export function validateProjectDraft(
  values: ProjectDraftValues,
  options: {
    maxChallengesPerProject: number
    /** 本赛季已发布命题的 id —— 只有这些能被正式选择。 */
    selectableChallengeIds: readonly number[]
  },
): ProjectDraftErrors {
  const errors: ProjectDraftErrors = {}

  if (values.mode === 'bring') {
    if (values.projectId === null) errors.projectId = '请选择要带入的项目'
  } else {
    const name = values.name.trim()
    if (name.length < SEASON_PROJECT_LIMITS.name.min) errors.name = '请填写项目名称'
    else if (name.length > SEASON_PROJECT_LIMITS.name.max) {
      errors.name = `项目名称最多 ${SEASON_PROJECT_LIMITS.name.max} 个字符`
    }
    if (values.tagline.trim().length > SEASON_PROJECT_LIMITS.tagline.max) {
      errors.tagline = `一句话介绍最多 ${SEASON_PROJECT_LIMITS.tagline.max} 个字符`
    }
  }

  if (values.themes.length > SEASON_PROJECT_LIMITS.themes.max) {
    errors.themes = `方向最多 ${SEASON_PROJECT_LIMITS.themes.max} 个`
  }

  if (values.challengeIds.length === 0) {
    errors.challengeIds = '请至少选择 1 个命题'
  } else if (values.challengeIds.length > options.maxChallengesPerProject) {
    errors.challengeIds = `每个项目最多选择 ${options.maxChallengesPerProject} 个命题`
  } else if (
    values.challengeIds.some((id) => !options.selectableChallengeIds.includes(id))
  ) {
    errors.challengeIds = '只能选择已发布的命题'
  }

  return errors
}

export type CreateSeasonProjectBody =
  | {
      mode: 'create'
      name: string
      tagline: string | null
      themes: string[]
      challengeIds: number[]
    }
  | {
      mode: 'bring'
      projectId: number
      themes: string[]
      challengeIds: number[]
    }

/** 表单 → 请求体；调用前应先通过 {@link validateProjectDraft}。 */
export function toSeasonProjectPayload(values: ProjectDraftValues): CreateSeasonProjectBody {
  const themes = values.themes
  const challengeIds = values.challengeIds
  if (values.mode === 'bring') {
    return { mode: 'bring', projectId: values.projectId ?? 0, themes, challengeIds }
  }
  return {
    mode: 'create',
    name: values.name.trim(),
    tagline: values.tagline.trim() || null,
    themes,
    challengeIds,
  }
}

// ---------------------------------------------------------------------------
// 发布招募卡表单
// ---------------------------------------------------------------------------

export type RecruitmentDraftValues = {
  seasonProjectId: string
  /** 逗号分隔的角色，如「前端，数据分析」。 */
  roles: string
  /** 逗号分隔的技能关键词（可空）。 */
  skills: string
  description: string
  /** `<input type="date">` 的值。 */
  deadline: string
}

export type RecruitmentDraftErrors = Partial<
  Record<'seasonProjectId' | 'roles' | 'skills' | 'description' | 'deadline', string>
>

export function emptyRecruitmentDraft(seasonProjectId: number | null = null): RecruitmentDraftValues {
  return {
    seasonProjectId: seasonProjectId === null ? '' : String(seasonProjectId),
    roles: '',
    skills: '',
    description: '',
    deadline: '',
  }
}

/**
 * 发布招募卡的校验。
 *
 * 角色 / 技能都是「逗号分隔的自由文本」，但落库是数组，所以按条校验
 * （1—10 条、每条 ≤ 50 字），而不是只看整串长度 —— 否则一个 500 字的角色
 * 描述能过前端、被后端 422 挡回来。
 */
export function validateRecruitmentDraft(
  values: RecruitmentDraftValues,
  options: { now?: Date } = {},
): RecruitmentDraftErrors {
  const errors: RecruitmentDraftErrors = {}
  const now = options.now ?? new Date()

  if (!values.seasonProjectId.trim()) {
    errors.seasonProjectId = '请选择要招募的项目'
  } else if (!/^\d+$/.test(values.seasonProjectId.trim())) {
    errors.seasonProjectId = '项目无效，请重新选择'
  }

  const roles = parseCommaList(values.roles)
  if (roles.length < SEASON_PROJECT_LIMITS.roles.min) {
    errors.roles = '请至少填写 1 个需要的角色'
  } else if (roles.length > SEASON_PROJECT_LIMITS.roles.max) {
    errors.roles = `角色最多 ${SEASON_PROJECT_LIMITS.roles.max} 个`
  } else if (roles.some((role) => role.length > SEASON_PROJECT_LIMITS.roles.itemMax)) {
    errors.roles = `每个角色最多 ${SEASON_PROJECT_LIMITS.roles.itemMax} 个字符`
  }

  const skills = parseCommaList(values.skills)
  if (skills.length > SEASON_PROJECT_LIMITS.skills.max) {
    errors.skills = `技能关键词最多 ${SEASON_PROJECT_LIMITS.skills.max} 个`
  } else if (skills.some((skill) => skill.length > SEASON_PROJECT_LIMITS.skills.itemMax)) {
    errors.skills = `每个技能关键词最多 ${SEASON_PROJECT_LIMITS.skills.itemMax} 个字符`
  }

  const description = values.description.trim()
  if (description.length < SEASON_PROJECT_LIMITS.description.min) {
    errors.description = '请填写说明：要做什么、每周需要投入多少'
  } else if (description.length > SEASON_PROJECT_LIMITS.description.max) {
    errors.description = `说明最多 ${SEASON_PROJECT_LIMITS.description.max} 个字符`
  }

  const deadline = dateInputToIso(values.deadline)
  if (!deadline) errors.deadline = '请选择截止日期'
  else if (new Date(deadline).getTime() <= now.getTime()) {
    errors.deadline = '截止日期必须晚于今天'
  }

  return errors
}

export type PublishRecruitmentCardBody = {
  seasonProjectId: number
  roles: string[]
  skills: string[]
  description: string
  deadline: string
}

/** 表单 → 请求体；调用前应先通过 {@link validateRecruitmentDraft}。 */
export function toRecruitmentCardPayload(
  values: RecruitmentDraftValues,
): PublishRecruitmentCardBody {
  return {
    seasonProjectId: Number(values.seasonProjectId.trim()),
    roles: parseCommaList(values.roles),
    skills: parseCommaList(values.skills),
    description: values.description.trim(),
    deadline: dateInputToIso(values.deadline) ?? '',
  }
}

// ---------------------------------------------------------------------------
// 申请
// ---------------------------------------------------------------------------

/** 申请说明的上限。契约没规定长度，前端按「一段话」的合理长度先拦一道。 */
export const APPLICATION_MESSAGE_MAX = 500

/** 返回错误文案，`null` 表示通过。 */
export function validateApplicationMessage(message: string): string | null {
  const value = message.trim()
  if (!value) return '请填写申请说明：你是谁、能做什么'
  if (value.length > APPLICATION_MESSAGE_MAX) {
    return `申请说明最多 ${APPLICATION_MESSAGE_MAX} 个字符`
  }
  return null
}
