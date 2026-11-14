import Link from 'next/link'
import {
  applicationWindowReason,
  formatMilestoneDate,
  nextMilestone,
  type MySeasonApplication,
  type SeasonDetail,
} from '@/lib/boomland'
import { dateRangeLabel, isoDate, seasonOrganizerLabel, seasonStatusView } from '@/lib/season-landing'

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
 * 左边是「状态 / 报名 / 主办方 / 城市」徽章 + 双行字标 + 主题 + 报名/活动时间窗，
 * 右边是拼贴画；右下角一枚票券 CTA。CTA 的四种状态（报名 / 已报名 / 未开放 /
 * 已截止）沿用原来的判定，不新增业务逻辑。
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
  const reason = applicationWindowReason(season)
  const applied = Boolean(myApplication && myApplication.application.status !== 'withdrawn')
  const opensLater = Boolean(reason?.startsWith('报名将于'))
  const displayName = season.name.replace(/^boomland\s*/i, '').trim() || season.name
  const organizer = seasonOrganizerLabel(season)
  const count = countdown(season)

  let cta:
    | { label: string; href: string; disabled?: false }
    | { label: string; href?: undefined; disabled: true }

  if (applied) {
    cta = { label: '查看我的报名', href: '/me/applications' }
  } else if (season.applicationWindow.isOpen) {
    cta = {
      label: isLoggedIn ? '立即报名' : '登录后报名',
      href: isLoggedIn
        ? `/seasons/${season.id}/apply`
        : `/login?returnTo=/seasons/${season.id}/apply`,
    }
  } else if (opensLater || season.status === 'upcoming' || season.status === 'draft') {
    cta = {
      label: season.applicationWindow.opensAt
        ? `报名 ${formatMilestoneDate(season.applicationWindow.opensAt)} 开放`
        : '报名时间待公布',
      disabled: true,
    }
  } else {
    cta = { label: '报名已截止', disabled: true }
  }

  return (
    <section className="v26-season-hero" aria-labelledby={`season-title-${season.id}`}>
      <div className="v26-season-hero__copy">
        <div className="v26-season-hero__badges">
          <span className="ui-chip ui-chip--accent">{status.label}</span>
          {reason ? <span className="ui-chip">{reason}</span> : null}
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
        {'href' in cta && cta.href ? (
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
