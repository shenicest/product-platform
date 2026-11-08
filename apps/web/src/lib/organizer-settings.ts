import {
  SeasonStatus,
  isScorelessValue,
  SEASON_RULE_CARD_SCORELESS,
  SEASON_RULE_LIMITS,
  type SeasonRules,
  type SeasonSchedule,
} from '@shenicest/shared'
import { SCHEDULE_MILESTONES, type RuleCardItem } from '@/lib/boomland'
import {
  SCHEDULE_FIELDS,
  type SeasonManageDetail,
  type SeasonReadiness,
} from '@/lib/organizer'

/**
 * 北京时间 ↔ `datetime-local` 的互转实现搬到了 `lib/organizer.ts`：
 * `draftFromPreviousSeason` / `draftFromCurrentSeason` 回填表单时也要用它，
 * 留在本文件会形成 `organizer ↔ organizer-settings` 的循环 import。
 * 这里原样再导出，调用方（赛程弹窗、测试）不用改 import 路径。
 */
export {
  beijingInputToIso,
  isoToBeijingInput,
  toScheduleDraft,
  toSchedulePayload,
} from '@/lib/organizer'

/**
 * 赛季设置 tab 的纯函数与常量。
 *
 * 这里**只有**计算：没有 React、没有 fetch，方便直接单测。页面（Server Component）
 * 只负责取数，客户端视图只负责把这里的结果摆进 DOM。
 *
 * 三类内容：
 *   1. 赛程节点的「到点后的行为」文案（`SCHEDULE_MILESTONE_EFFECTS`）；
 *   2. 状态谓词：某个赛季此刻能不能改规则 / 改赛程 / 提交 / 批准 / 取消……；
 *   3. 展示用的派生数据：发布门槛汇总、规则摘要行、赛程表行，
 *      以及赛程草稿（`datetime-local` 字符串）↔ ISO 的互转。
 *
 * 时间口径：赛程表标题写的是「北京时间」，所以这里的互转**固定按 UTC+8**，
 * 不跟浏览器本地时区走 —— 否则同一份数据在伦敦和上海会显示成不同时刻。
 */

// ---------------------------------------------------------------------------
// 管理视图的类型补全
// ---------------------------------------------------------------------------

/**
 * `GET /seasons/:id/manage` 实际还会返回 `ruleCard`，但 `lib/organizer.ts` 的
 * `SeasonManageDetail` 没有声明它（那个文件不在本批改动范围内）。
 *
 * 这里补一层**类型收窄 + 运行时兜底**：拿到 detail 后过一遍
 * {@link toSeasonSettingsDetail}，页面就能安全地读 `ruleCard`，
 * 后端哪天不返回也不会崩。
 */
export type SeasonSettingsDetail = SeasonManageDetail & { ruleCard: RuleCardItem[] }

export function toSeasonSettingsDetail(detail: SeasonManageDetail): SeasonSettingsDetail {
  const ruleCard = (detail as SeasonManageDetail & { ruleCard?: RuleCardItem[] }).ruleCard
  return { ...detail, ruleCard: Array.isArray(ruleCard) ? ruleCard : [] }
}

// ---------------------------------------------------------------------------
// 赛程节点行为
// ---------------------------------------------------------------------------

/**
 * 八个赛程节点「到点之后会发生什么」。
 *
 * 这份文案是页面上给主办方看的契约说明，与后端 `docs/boomland/pre-start-season-api.md`
 * 的状态机一一对应；`Record<keyof SeasonSchedule, string>` 保证新增节点时漏写会编译报错。
 */
export const SCHEDULE_MILESTONE_EFFECTS: Record<keyof SeasonSchedule, string> = {
  applyOpen: '开始接受报名',
  applyClose: '拒绝新报名；人工补报需留痕',
  startAt: '已批准的赛季可以开赛（手动）',
  teamDeadline: '发起人不能再自助改团队与项目命题，需主办方审批',
  challengeFreezeAt: '不能新增或下线命题，只能生成新版本',
  workDeadline: '不能再发布作品或新版本，只能评分与复核',
  scoreDeadline: '停止新增评分，可以进入结算中',
  settleDate: '完成复核后定格',
}

export type ScheduleMilestoneRow = {
  key: keyof SeasonSchedule
  label: string
  /** 原始 ISO 时间；未排期时为 null（展示层负责转成「待定」）。 */
  at: string | null
  effect: string
}

/** 赛程表：固定八行，顺序与公开页 `SCHEDULE_MILESTONES` 一致。 */
export function scheduleMilestoneRows(
  schedule: SeasonSchedule | null | undefined,
): ScheduleMilestoneRow[] {
  return SCHEDULE_MILESTONES.map((milestone) => ({
    key: milestone.key,
    label: milestone.label,
    at: schedule?.[milestone.key] ?? null,
    effect: SCHEDULE_MILESTONE_EFFECTS[milestone.key],
  }))
}

// ---------------------------------------------------------------------------
// 赛程改动的额外约束
// ---------------------------------------------------------------------------

/** 缩短截止的最短提前量：48 小时（页面上给主办方的承诺）。 */
export const SCHEDULE_MIN_LEAD_MS = 48 * 60 * 60 * 1000

/**
 * 「已过去的截止不能再改」与「缩短的截止至少提前 48 小时」。
 *
 * 这两条是页面对主办方的承诺，后端 `updateSchedule` 目前只校验先后顺序，
 * 所以在前端拦住 —— 与其让人提交成功后才发现被别处拒绝，不如当场说清楚。
 *
 * 口径：
 *   · 已经过去的节点是历史事实：新值必须与旧值一致，往前挪或往后挪都不行；
 *   · 首次排期（没有旧值）时，任何节点都不能早于现在；
 *   · 任何节点被**提前**时，新时间必须至少距现在 48 小时。
 *
 * 返回 `{ '<key>': '错误文案' }`，与 `validateScheduleDraft` 的 key 口径一致。
 */
export function validateScheduleChange(
  previous: SeasonSchedule | null | undefined,
  next: SeasonSchedule,
  now: Date = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {}
  const nowMs = now.getTime()

  for (const field of SCHEDULE_FIELDS) {
    const nextMs = Date.parse(next[field.key])
    if (!Number.isFinite(nextMs)) continue
    const previousMs = previous ? Date.parse(previous[field.key]) : Number.NaN

    if (Number.isFinite(previousMs)) {
      // 已经过去的节点：只允许原样保留。
      if (previousMs < nowMs) {
        if (nextMs !== previousMs) {
          errors[`schedule.${field.key}`] = `${field.label}已经过去，不能再改`
        }
        continue
      }
      // 提前的节点：至少留 48 小时。
      if (nextMs < previousMs && nextMs - nowMs < SCHEDULE_MIN_LEAD_MS) {
        errors[`schedule.${field.key}`] = `${field.label}缩短后至少要在 48 小时之后`
      }
      continue
    }

    // 首次排期：不能排到过去。
    if (nextMs < nowMs) {
      errors[`schedule.${field.key}`] = `${field.label}不能早于当前时间`
    }
  }
  return errors
}

// ---------------------------------------------------------------------------
// 发布门槛
// ---------------------------------------------------------------------------

export type ReadinessSummary = {
  passed: number
  total: number
  ready: boolean
  /** 未通过项；`detail` 是后端给的「缺什么」说明。 */
  missing: Array<{ key: string; label: string; detail?: string }>
}

/**
 * 主办方后台的 tab slug（与 `components/organizer/organizer-tabs.tsx` 的
 * `ORGANIZER_TABS` 一一对应）。
 *
 * 这里单独声明一份而不是从 `organizer-tabs.tsx` 导入：那个文件是
 * `'use client'` 组件（还依赖 `next/navigation`），把它的常量拖进纯函数模块
 * 会让单测与 Server Component 都被迫跨客户端边界。
 *
 * 两边的一致性由两道保险守住：`ORGANIZER_TAB_LABELS` 是
 * `Record<OrganizerTabSlug, string>`（漏写新 tab 会编译报错），
 * `test/lib/organizer-settings.test.ts` 钉住 slug 列表的顺序。
 * 真出现拼错的 slug，表现是链接 404，不会静默指错地方。
 */
export type OrganizerTabSlug =
  | 'overview'
  | 'season-settings'
  | 'applications'
  | 'manual-group'
  | 'challenges'
  | 'scoring'
  | 'milestones'
  | 'verification'
  | 'budget'
  | 'audit'

/** 全部 tab slug，顺序与 `ORGANIZER_TABS` 一致（单测据此守一致性）。 */
export const ORGANIZER_TAB_SLUGS = [
  'overview',
  'season-settings',
  'applications',
  'manual-group',
  'challenges',
  'scoring',
  'milestones',
  'verification',
  'budget',
  'audit',
] as const satisfies readonly OrganizerTabSlug[]

/** tab slug → 中文名（用于门槛卡的「前往 XX 设置」可访问名）。 */
export const ORGANIZER_TAB_LABELS: Record<OrganizerTabSlug, string> = {
  overview: '总览',
  'season-settings': '赛季设置',
  applications: '报名审核',
  'manual-group': '人工拉群',
  challenges: '命题与资源',
  scoring: '评委与积分池',
  milestones: '里程碑',
  verification: '核验与异议',
  budget: '预算与结算',
  audit: '审计',
}

/**
 * 九项发布门槛 → 「到哪一屏去补」的 tab slug；映射不到时返回 null（不可点击）。
 *
 * 口径按「这一项在哪里配置」：
 *   · 赛程 / 规则 / 主办方组织 / 授奖主体都在**赛季设置**这一屏（本页）；
 *   · 命题在「命题与资源」，预算在「预算与结算」；
 *   · 积分池与评委积分分配都在「评委与积分池」；
 *   · 核验员在「核验与异议」。
 *
 * 未知 key（后端以后新增第十项）一律返回 null：宁可卡片不可点，也不要
 * 猜一个错误的去处。
 */
export function readinessCheckTab(checkKey: string): OrganizerTabSlug | null {
  const mapping: Record<string, OrganizerTabSlug> = {
    schedule: 'season-settings',
    challenges: 'challenges',
    budget: 'budget',
    point_pool: 'scoring',
    scorers: 'scoring',
    verifiers: 'verification',
    rules: 'season-settings',
    organizers: 'season-settings',
    awarding_entity: 'season-settings',
  }
  return mapping[checkKey] ?? null
}

/** 门槛卡点击后的目标地址；`seasonId` 为空时返回 null（卡片不可点击）。 */
export function readinessCheckHref(
  checkKey: string,
  seasonId: number | null | undefined,
): string | null {
  if (typeof seasonId !== 'number' || !Number.isFinite(seasonId)) return null
  const tab = readinessCheckTab(checkKey)
  if (!tab) return null
  return `/organizer/${tab}?season=${seasonId}`
}

/** 门槛卡的可访问名：说清「点下去能补什么」，而不是笼统的「前往某 tab」。 */
export function readinessCheckLinkLabel(checkKey: string): string | null {
  const labels: Record<string, string> = {
    schedule: '前往修改赛程',
    challenges: '前往「命题与资源」',
    budget: '前往「预算与结算」',
    point_pool: '前往「评委与积分池」充值积分池',
    scorers: '前往「评委与积分池」分配评委',
    verifiers: '前往「核验与异议」授权核验员',
    rules: '前往修改规则',
    organizers: '前往设置主办方组织',
    awarding_entity: '前往填写发奖主体',
  }
  return labels[checkKey] ?? null
}

/**
 * 九项发布门槛的汇总。
 *
 * `readiness` 为 null 表示这一块数据没取到（后端报错被降级），此时返回
 * `total: 0`，页面据此渲染「门槛暂时读不到」而不是假装 0/9 全缺。
 */
export function summarizeReadiness(
  readiness: SeasonReadiness | null | undefined,
): ReadinessSummary {
  if (!readiness) return { passed: 0, total: 0, ready: false, missing: [] }
  const checks = readiness.checks ?? []
  const missing = checks
    .filter((check) => !check.passed)
    .map((check) => ({ key: check.key, label: check.label, detail: check.detail }))
  return {
    passed: checks.filter((check) => check.passed).length,
    total: checks.length,
    ready: readiness.ready,
    missing,
  }
}

// ---------------------------------------------------------------------------
// 规则摘要
// ---------------------------------------------------------------------------

export type RuleSummaryRow = { key: string; label: string; value: string }

/**
 * 计分口径三项的展示值：`null` / `0` 都是「本季不计分」。
 *
 * 口径与后端一致（`isScorelessValue` 由 shared 提供），文案也直接取
 * `SEASON_RULE_CARD_SCORELESS` —— 规则卡、预览、摘要卡说的是同一句话。
 */
function scorelessRuleValue(value: number | null | undefined): string {
  return isScorelessValue(value) ? SEASON_RULE_CARD_SCORELESS : String(value)
}

/**
 * 「规则」卡的九行摘要。
 *
 * 数值全部来自 `detail.rules`（类型化规则），名额与协议版本来自赛季行；
 * 范围提示直接取 `SEASON_RULE_LIMITS`，不重复写字面量。
 */
export function ruleSummaryRows(input: {
  rules: SeasonRules
  participantCapacity: number | null
  agreementVersion: string
}): RuleSummaryRow[] {
  const { rules } = input
  const challengeLimit = SEASON_RULE_LIMITS.maxChallengesPerProject
  const memberLimit = SEASON_RULE_LIMITS.maxCoreMembers
  return [
    {
      key: 'maxChallengesPerProject',
      label: '每个项目的命题上限',
      value: `${rules.maxChallengesPerProject}（${challengeLimit.min}—${challengeLimit.max}）`,
    },
    {
      key: 'maxProjectsPerParticipant',
      label: '每人项目数',
      value: String(rules.maxProjectsPerParticipant),
    },
    {
      key: 'maxCoreMembers',
      label: '团队人数',
      value: `${memberLimit.min}—${rules.maxCoreMembers}`,
    },
    {
      key: 'participantCapacity',
      label: '选手名额',
      value: input.participantCapacity === null ? '不限' : String(input.participantCapacity),
    },
    { key: 'singleWorkCap', label: '单次评分上限', value: scorelessRuleValue(rules.singleWorkCap) },
    { key: 'exchangeRatio', label: '兑换比例', value: scorelessRuleValue(rules.exchangeRatio) },
    { key: 'reviewThreshold', label: '大额复核阈值', value: scorelessRuleValue(rules.reviewThreshold) },
    {
      key: 'dailyQuotaEnabled',
      label: '每日额度',
      value: rules.dailyQuotaEnabled ? '开启' : '关闭（默认）',
    },
    {
      key: 'agreementVersion',
      label: '协议版本',
      value: input.agreementVersion.trim() || '未定',
    },
  ]
}

/** 「规则」卡右上角的状态词：草稿 / 已生效 / 已取消。 */
export function ruleCardStatusLabel(status: string): string {
  if (status === SeasonStatus.Draft) return '草稿'
  if (status === SeasonStatus.Cancelled) return '已取消'
  return '已生效'
}

// ---------------------------------------------------------------------------
// 状态谓词
// ---------------------------------------------------------------------------

/** 类型化规则：只有草稿与「即将开始」可改，开赛后冻结（后端同样口径）。 */
export function canEditSeasonRules(status: string): boolean {
  return status === SeasonStatus.Draft || status === SeasonStatus.Upcoming
}

/** 赛程：开赛后仍可微调，取消后彻底锁定。 */
export function canEditSeasonSchedule(status: string): boolean {
  return (
    status === SeasonStatus.Draft
    || status === SeasonStatus.Upcoming
    || status === SeasonStatus.Active
    || status === SeasonStatus.Suspended
  )
}

/** 规则卡：与赛程同口径（后端 `updateRuleCard` 允许这四个状态）。 */
export function canEditSeasonRuleCard(status: string): boolean {
  return canEditSeasonSchedule(status)
}

/** 核心字段（名称 / 类型 / 主题 / 名额……）只有草稿能改。 */
export function canEditSeasonCore(status: string): boolean {
  return status === SeasonStatus.Draft
}

/** 主办方组织：草稿可改；提交后只有平台管理员能改。 */
export function canEditSeasonOrganizers(status: string, isOperator: boolean): boolean {
  if (status === SeasonStatus.Cancelled) return false
  return status === SeasonStatus.Draft || isOperator
}

/** 待批：`upcoming` 且还没批准。 */
export function isPendingApproval(status: string, approvedAt: string | null): boolean {
  return status === SeasonStatus.Upcoming && approvedAt === null
}

/** 提交按钮：只有草稿能提交。 */
export function canSubmitSeason(status: string): boolean {
  return status === SeasonStatus.Draft
}

/**
 * 提交按钮的文案。
 *
 * 平台管理员提交会**直接批准**（后端 `submit` 里 operator 分支），
 * 所以按钮不能写成「提交待批」，否则等于骗人。
 */
export function submitActionLabel(isOperator: boolean): string {
  return isOperator ? '发布（管理员直接生效）' : '提交待批'
}

/** 批准 / 驳回：待批状态 + 仅平台管理员。 */
export function canApproveSeason(status: string, approvedAt: string | null, isOperator: boolean): boolean {
  return isOperator && isPendingApproval(status, approvedAt)
}

/** 开赛：已批准、还没开赛。 */
export function canStartSeason(status: string, approvedAt: string | null): boolean {
  return status === SeasonStatus.Upcoming && approvedAt !== null
}

/** 暂停：即将开始 / 进行中。 */
export function canSuspendSeason(status: string): boolean {
  return status === SeasonStatus.Upcoming || status === SeasonStatus.Active
}

/** 恢复：暂停中。 */
export function canResumeSeason(status: string): boolean {
  return status === SeasonStatus.Suspended
}

/**
 * 取消：草稿 / 即将开始 / 暂停中。
 *
 * 「暂停中」要再看暂停前是不是已经开赛 —— 开赛后的赛季不能取消，
 * 后端会返回 `SEASON_ALREADY_STARTED`，前端提前把按钮藏掉。
 */
export function canCancelSeason(status: string, statusBeforeSuspend?: string | null): boolean {
  if (status === SeasonStatus.Draft || status === SeasonStatus.Upcoming) return true
  if (status !== SeasonStatus.Suspended) return false
  return statusBeforeSuspend !== SeasonStatus.Active
}

/** 发公告：已批准且未取消（后端 `createAnnouncement` 同口径）。 */
export function canCreateAnnouncement(status: string, approvedAt: string | null): boolean {
  return approvedAt !== null && status !== SeasonStatus.Cancelled
}
