import { SeasonStatus, type SeasonSchedule } from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import {
  formatMilestoneDate,
  myApplicationMeta,
  myApplicationState,
} from '@/lib/boomland'

/**
 * 「赛季报名状态」与「我能不能报 / 下一步点哪里」的唯一推导层。
 *
 * 为什么单独一层：
 *   1. 赛季卡片拿到的是 `SeasonSummary`（只有 `schedule`），详情页拿到的是
 *      `SeasonDetail`（后端算好的 `applicationWindow`），两者必须给出同一个
 *      报名状态文案，否则同一场赛季在列表和详情会自相矛盾；
 *   2. 报名状态（未开放 / 报名中 / 报名已截止）与用户报名状态
 *      （未报名 / 审核中 / 候补中 / 已报名 / 已撤回 / 未通过）共同决定卡片与
 *      海报上那枚 CTA 的文案，放到组件里会各写一遍。
 *
 * 所有函数都是纯函数：`now` 显式传入（默认取当前时间），可以单测。
 */

/** 赛季报名状态：只关心「报名窗口」本身，不混入赛季生命周期。 */
export type SeasonRegistrationState = 'not-open' | 'open' | 'closed'

export const SEASON_REGISTRATION_META: Record<
  SeasonRegistrationState,
  { label: string; tone: ChipTone }
> = {
  'not-open': { label: '未开放', tone: 'sky' },
  open: { label: '报名中', tone: 'success' },
  closed: { label: '报名已截止', tone: 'neutral' },
}

/**
 * 求报名状态时需要的字段。
 *
 * 详情接口给了 `applicationWindow`（后端按同一套赛程算出），列表接口只有
 * `schedule`；两种入参都接，内部只认一对时间点。
 */
export type SeasonRegistrationInput = {
  status?: string
  schedule?: SeasonSchedule | null
  applicationWindow?: {
    opensAt: string | null
    closesAt: string | null
    isOpen?: boolean
  } | null
}

export type SeasonRegistration = {
  state: SeasonRegistrationState
  /** 未开放 / 报名中 / 报名已截止 */
  label: string
  tone: ChipTone
  opensAt: string | null
  closesAt: string | null
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function pickWindow(season: SeasonRegistrationInput): {
  opensAt: string | null
  closesAt: string | null
  isOpen: boolean | undefined
} {
  const window = season.applicationWindow
  if (window) {
    return {
      opensAt: window.opensAt ?? null,
      closesAt: window.closesAt ?? null,
      isOpen: window.isOpen,
    }
  }
  return {
    opensAt: season.schedule?.applyOpen ?? null,
    closesAt: season.schedule?.applyClose ?? null,
    isOpen: undefined,
  }
}

/**
 * 报名状态：报名开放时间之前是「未开放」，报名截止之后是「报名已截止」，
 * 中间是「报名中」。
 *
 * 赛程还没有一对时间点时按「未开放」处理 —— 对用户来说「还没开始」与
 * 「时间没排」的下一步动作相同：等通知。赛季被暂停 / 取消**不**改写这里
 * 的结果：报名窗口本身没变，暂停是赛季状态，由 CTA 与提示文案单独表达，
 * 否则「报名中」会在一场被暂停的赛季上凭空变成「已截止」，恢复后又变回来。
 */
export function seasonRegistration(
  season: SeasonRegistrationInput,
  now: Date = new Date(),
): SeasonRegistration {
  const { opensAt, closesAt, isOpen } = pickWindow(season)
  const opensTime = toTime(opensAt)
  const closesTime = toTime(closesAt)
  const nowTime = now.getTime()

  let state: SeasonRegistrationState
  if (closesTime !== null && closesTime <= nowTime) {
    state = 'closed'
  } else if (opensTime !== null && opensTime > nowTime) {
    state = 'not-open'
  } else if (opensTime === null && closesTime === null) {
    state = isOpen ? 'open' : 'not-open'
  } else {
    // 已经过了开放时间（或本来就缺开放时间），且还没到截止时间。
    state = 'open'
  }

  const meta = SEASON_REGISTRATION_META[state]
  return { state, label: meta.label, tone: meta.tone, opensAt, closesAt }
}

/** 报名没开放 / 已截止时，票券 CTA 上那句「为什么点不了」。 */
export function registrationBlockedLabel(registration: SeasonRegistration): string {
  if (registration.state === 'closed') return '报名已截止'
  if (registration.opensAt) {
    return `报名 ${formatMilestoneDate(registration.opensAt)} 开放`
  }
  return '报名时间待公布'
}

export type SeasonApplicationCta = {
  /** 立即报名 / 报名审核中 / 候补中 / 查看我的报名 / 重新报名 / 查看未通过原因 */
  label: string
  /** 可点时的目标地址；不可点时为空。 */
  href: string | null
  disabled: boolean
}

/** 我的报名落在这些状态时，「下一步」永远是去个人中心看进度或结果。 */
const MY_APPLICATIONS_HREF = '/me/applications'

/**
 * 卡片 / 海报上的报名 CTA。
 *
 * 文案严格按用户报名状态区分：
 *   未报名 → 立即报名 · 审核中 → 报名审核中 · 候补中 → 候补中 ·
 *   已报名 → 查看我的报名 · 已撤回 → 重新报名 · 未通过 → 查看未通过原因。
 *
 * 「未报名」还受三件事约束：登录态、赛季是否暂停/取消、报名窗口是否开放。
 * 其余状态不受窗口影响 —— 报名已经提交过，窗口关了也还能看进度。
 */
export function seasonApplicationCta(input: {
  seasonId: number
  seasonStatus?: string
  isLoggedIn: boolean
  registration: SeasonRegistration
  applicationStatus?: string | null
}): SeasonApplicationCta {
  const state = myApplicationState(input.applicationStatus)
  const meta = myApplicationMeta(input.applicationStatus)
  const applyHref = `/seasons/${input.seasonId}/apply`

  if (
    state === 'reviewing' ||
    state === 'waitlisted' ||
    state === 'accepted' ||
    state === 'rejected'
  ) {
    return { label: meta.ctaLabel, href: MY_APPLICATIONS_HREF, disabled: false }
  }

  const seasonBlocked =
    input.seasonStatus === SeasonStatus.Suspended
      ? '报名已暂停'
      : input.seasonStatus === SeasonStatus.Cancelled
        ? '赛季已取消'
        : null
  if (seasonBlocked) return { label: seasonBlocked, href: null, disabled: true }

  if (input.registration.state !== 'open') {
    return {
      label: registrationBlockedLabel(input.registration),
      href: null,
      disabled: true,
    }
  }

  if (!input.isLoggedIn) {
    return {
      label: state === 'withdrawn' ? '重新报名' : '登录后报名',
      href: `/login?returnTo=${applyHref}`,
      disabled: false,
    }
  }

  return {
    label: state === 'withdrawn' ? '重新报名' : '立即报名',
    href: applyHref,
    disabled: false,
  }
}
