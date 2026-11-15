import Link from 'next/link'
import { SeasonStatus } from '@shenicest/shared'
import {
  applicationWindowReason,
  myApplicationMeta,
  nextMilestone,
  type MySeasonApplication,
  type SeasonDetail,
} from '@/lib/boomland'
import { dateRangeLabel, isoDate, seasonOrganizerLabel, seasonStatusView } from '@/lib/season-landing'
import {
  seasonApplicationCta,
  seasonRegistration,
} from '@/lib/season-registration'

function CalendarIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/season-calendar.svg" alt="" aria-hidden width={24} height={24} />
  )
}

function countdown(season: SeasonDetail): { label: string; at: string; value: string } | null {
  const milestone = nextMilestone(season.schedule)
  if (!milestone) return null
  const at = new Date(milestone.at).getTime()
  if (Number.isNaN(at)) return null
  const ms = at - Date.now()
  if (ms <= 0) return null
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return {
    label: milestone.label,
    at: isoDate(milestone.at),
    value: `${days} 天 ${hours} 小时`,
  }
}

/**
 * 赛季详情页海报（设计稿 `.season-state-hero`）。
 *
 * 徽章区同时表达三件事，缺一个用户就会误判自己能不能报名：
 *   · 赛季状态（即将开始 / 进行中 / 已暂停 / 已取消）；
 *   · 报名状态（未开放 / 报名中 / 报名已截止）—— 只看报名窗口；
 *   · 我的报名状态（审核中 / 候补中 / 已报名 / 已撤回 / 未通过）—— 只看我的记录。
 *
 * 右下角票券 CTA 的文案由 `seasonApplicationCta()` 统一给出：
 * 未报名 → 立即报名；审核中 → 报名审核中；候补中 → 候补中；
 * 已报名 → 查看我的报名；已撤回 → 重新报名；未通过 → 查看未通过原因。
 * 窗口没开 / 已截止 / 赛季暂停时，同一个位置渲染禁用票券。
 */
export function SeasonPoster({
  season,
  myApplication,
  isLoggedIn,
}: {
  season: SeasonDetail
  myApplication: MySeasonApplication | null
  isLoggedIn: boolean
}) {
  const status = seasonStatusView(season.status)
  const registration = seasonRegistration(season)
  const applicationStatus = myApplication?.application.status ?? null
  const application = applicationStatus ? myApplicationMeta(applicationStatus) : null
  const cta = seasonApplicationCta({
    seasonId: season.id,
    seasonStatus: season.status,
    isLoggedIn,
    registration,
    applicationStatus,
  })
  const reason = applicationWindowReason(season)
  // 报名状态胶囊已经说了「未开放 / 报名中 / 报名已截止」，这里只补赛季层面的
  // 例外情况（暂停 / 取消），否则同一句话会在徽章区出现两次。
  const seasonReason =
    season.status === SeasonStatus.Suspended || season.status === SeasonStatus.Cancelled
      ? reason
      : null
  const displayName = season.name.replace(/^boomland\s*/i, '').trim() || season.name
  const organizer = seasonOrganizerLabel(season)
  const count = countdown(season)

  return (
    <section className="v26-season-hero" aria-labelledby={`season-title-${season.id}`}>
      <div className="v26-season-hero__copy">
        <div className="v26-season-hero__badges">
          <span className="ui-chip ui-chip--accent">{status.label}</span>
          <span className="ui-chip">{registration.label}</span>
          {application ? <span className="ui-chip">{application.label}</span> : null}
          {seasonReason ? <span className="ui-chip">{seasonReason}</span> : null}
          <span className="ui-chip">{organizer}</span>
          {season.city ? <span className="ui-chip">{season.city}</span> : null}
        </div>

        <h1 id={`season-title-${season.id}`}>
          <span>BoomLand</span>
          <br />
          <span>{displayName}</span>
        </h1>

        <p className="v26-season-hero__theme">
          {season.intro?.trim() ||
            (season.themes.length > 0
              ? season.themes.join(' / ')
              : '把真实问题做成可购买、可交付、可核验的服务')}
        </p>

        <p className="v26-season-hero__dates">
          <CalendarIcon />
          <span>报名</span>
          <span>{dateRangeLabel(season.applicationWindow.opensAt, season.applicationWindow.closesAt)}</span>
        </p>
        <p className="v26-season-hero__dates">
          <CalendarIcon />
          <span>活动</span>
          <span>{dateRangeLabel(season.schedule?.startAt, season.schedule?.workDeadline)}</span>
        </p>

        {count ? (
          <p className="v26-season-hero__countdown">
            <span>
              距{count.label} {count.at}
            </span>
            <b>{count.value}</b>
          </p>
        ) : null}
      </div>

      <div className="v26-season-hero__actions">
        {cta.href ? (
          <Link href={cta.href} className="v26-ticket-cta">
            {cta.label} <span aria-hidden>→</span>
          </Link>
        ) : (
          <span className="v26-ticket-cta" aria-disabled="true">
            {cta.label}
          </span>
        )}
      </div>
    </section>
  )
}
