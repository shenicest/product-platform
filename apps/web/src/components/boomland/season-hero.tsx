import Link from 'next/link'
import {
  applicationWindowReason,
  formatDotDate,
  type MySeasonApplication,
  type SeasonDetail,
} from '@/lib/boomland'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" strokeLinecap="round" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" strokeLinecap="round" />
      <circle cx="17.5" cy="9.5" r="2.4" />
      <path d="M15.8 14.4c2.3.2 4 1.7 4.7 4.1" strokeLinecap="round" />
    </svg>
  )
}

function maxCoreMembers(season: SeasonDetail): string {
  const value = season.ruleCard.find((item) => item.key === 'max_core_members')?.value
  return value?.match(/\d+/)?.[0] ?? '3'
}

/** 把「AI4BBS 产业商业赛季」拆成两行，和拼贴首屏的双行字标节奏一致。 */
function titleLines(name: string): string[] {
  const match = name.trim().match(/^([A-Za-z0-9][A-Za-z0-9-]*)\s+(.+)$/)
  if (match) return [match[1], match[2]]
  return [name]
}

export function SeasonHero({
  season,
  isLoggedIn,
  myApplication,
}: {
  season: SeasonDetail
  isLoggedIn: boolean
  myApplication: MySeasonApplication | null
}) {
  const displayName = season.name.replace(/^boomland\s*/i, '') || season.name
  const lines = titleLines(displayName)
  const reason = applicationWindowReason(season)
  const applied = Boolean(myApplication && myApplication.application.status !== 'withdrawn')
  const opensLater = Boolean(reason?.startsWith('报名将于'))

  let cta: { label: string; href?: string }
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
    cta = { label: '敬请期待' }
  } else {
    cta = { label: '报名已截止' }
  }

  const titleId = `season-title-${season.id}`

  return (
    <section className="season-hero" aria-labelledby={titleId}>
      <div className="season-hero__inner">
        <div className="season-hero__content">
          <p className="season-hero__brand">BoomLand</p>
          <h1 id={titleId} className="season-hero__title">
            {lines.map((line, index) => (
              <span key={line}>
                {line}
                {index < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </h1>
          <p className="season-hero__lead">
            {season.intro ?? '把真实问题做成可购买、可交付、可核验的服务'}
          </p>

          <div className="season-hero__meta">
            <span className="season-hero__meta-item">
              <CalendarIcon />
              报名 {formatDotDate(season.applicationWindow.opensAt)} -{' '}
              {formatDotDate(season.applicationWindow.closesAt)}
            </span>
            <span className="season-hero__meta-item">
              <CalendarIcon />
              赛季 {formatDotDate(season.schedule?.startAt)} -{' '}
              {formatDotDate(season.schedule?.workDeadline)}
            </span>
            <span className="season-hero__meta-item">
              <UsersIcon />
              {season.participantCount} / {season.participantCapacity ?? '不限'} 人
              <span aria-hidden> | </span>
              组队: 1-{maxCoreMembers(season)} 人
            </span>
          </div>

          <div className="season-hero__actions">
            {cta.href ? (
              <Link href={cta.href} className="season-hero__cta">
                {cta.label}
                <span aria-hidden>→</span>
              </Link>
            ) : (
              <span className="season-hero__cta" aria-disabled="true">
                {cta.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
