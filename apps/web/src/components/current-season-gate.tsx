import Link from 'next/link'
import { SeasonStatus } from '@shenicest/shared'
import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { SeasonCountdown } from '@/components/season-countdown'
import type { SeasonSpotlight } from '@/lib/season-spotlight'

function remainingMs(iso: string | null): number {
  if (!iso) return 0
  const target = new Date(iso).getTime()
  return Number.isFinite(target) ? Math.max(0, target - Date.now()) : 0
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

/**
 * 首页「当前赛季」票根。
 *
 * 放在首屏之后、精选项目之前：首页的主线仍然是「看项目」，但赛季是
 * 有时效的 —— 报名窗口一过，入口再显眼也没有意义。所以它需要一块
 * 独立的、比普通分区更重的版面，而不是塞进导航里的一行链接。
 *
 * 视觉上是一张门票：热粉齿孔边 + 蜜桃纸抬头 + 暖白票身；抬头印赛季编号
 * 与状态，票身讲「这是什么、什么时候、往哪走」。两侧的半圆缺口由 CSS
 * 叠出来，不占内容空间。没有赛季时仍渲染同一张票根，入口不会中断。
 */
function TicketHead({ season, live }: { season: SeasonSpotlight; live: boolean }) {
  return (
    <header className="season-ticket__head">
      <span className="season-ticket__code">{season.code}</span>

      <div className="season-ticket__status-group">
        {season.dayIndex > 0 && season.dayTotal > 0 ? (
          <span className="season-ticket__day">
            DAY <b>{season.dayIndex}</b> / {season.dayTotal}
          </span>
        ) : null}
        <Chip tone={season.statusTone} dot className="season-ticket__status">
          {live ? '进行中' : season.statusLabel}
        </Chip>
      </div>

      <span className="season-ticket__brush" aria-hidden />
      <span className="season-ticket__checker" aria-hidden />
    </header>
  )
}

export function CurrentSeasonGate({ season }: { season: SeasonSpotlight | null }) {
  if (!season) {
    return (
      <section className="season-gate" aria-labelledby="season-gate-title">
        <div className="shell">
          <article className="season-ticket season-ticket--empty">
            <span className="season-ticket__notch season-ticket__notch--left" aria-hidden />
            <span className="season-ticket__notch season-ticket__notch--right" aria-hidden />
            <div className="season-ticket__inner">
              <header className="season-ticket__head">
                <span className="season-ticket__code">--</span>
                <div className="season-ticket__status-group">
                  <Chip className="season-ticket__status">NO ACTIVE SEASON</Chip>
                </div>
                <span className="season-ticket__brush" aria-hidden />
              </header>

              <div className="season-ticket__body">
                <h2 className="season-ticket__title" id="season-gate-title">
                  新一季正在筹备
                </h2>
                <p className="season-ticket__desc">
                  当前没有进行中的赛季。下一季开放报名后，会第一时间出现在这里。
                </p>
                <div className="season-ticket__actions">
                  <ButtonLink href="/seasons" variant="primary">
                    查看火热赛季{' '}
                    <span className="ui-btn__arrow" aria-hidden>
                      →
                    </span>
                  </ButtonLink>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    )
  }

  const live = season.status === SeasonStatus.Active

  return (
    <section className="season-gate" aria-labelledby="season-gate-title">
      <div className="shell">
        <article className="season-ticket">
          <span className="season-ticket__notch season-ticket__notch--left" aria-hidden />
          <span className="season-ticket__notch season-ticket__notch--right" aria-hidden />

          <div className="season-ticket__inner">
            <TicketHead season={season} live={live} />

            <div className="season-ticket__body">
              <div className="season-ticket__title-row">
                <h2 className="season-ticket__title" id="season-gate-title">
                  {season.displayName}
                </h2>
                <span className="season-ticket__organizer">{season.organizer}</span>
              </div>

              <p className="season-ticket__desc">{season.intro}</p>

              <p className="season-ticket__meta">
                {season.typeLabel} · {season.challengeCount} 个命题 ·{' '}
                {season.participantLabel}
              </p>

              <p className="season-ticket__date">
                <CalendarIcon />
                <span>{season.activityRange}</span>
              </p>

              {season.themes.length > 0 ? (
                <div className="season-ticket__themes" aria-label="赛季主题">
                  {season.themes.map((theme) => (
                    <Chip key={theme} className="season-ticket__theme">
                      {theme}
                    </Chip>
                  ))}
                </div>
              ) : null}

              {season.workDeadline ? (
                <div className="season-ticket__countdown">
                  <span className="season-ticket__countdown-label">
                    距作品截止
                    <span className="season-ticket__countdown-tz">（北京时间）</span>
                  </span>
                  <SeasonCountdown
                    target={season.workDeadline}
                    initialRemainingMs={remainingMs(season.workDeadline)}
                  />
                </div>
              ) : null}

              <div className="season-ticket__actions">
                <ButtonLink
                  href={season.href}
                  variant="primary"
                  aria-label={`进入当前赛季：${season.name}`}
                >
                  进入火热赛季{' '}
                  <span className="ui-btn__arrow" aria-hidden>
                    →
                  </span>
                </ButtonLink>
                <ButtonLink href={`${season.href}#challenges`} variant="secondary">
                  本企业命题 · 实时数据
                </ButtonLink>
              </div>

              {season.parallelSeasons.length > 0 ? (
                <div className="season-ticket__parallel">
                  <span className="season-ticket__parallel-label">
                    并行 {season.parallelSeasons.length} 个赛季
                  </span>
                  {season.parallelSeasons.slice(0, 1).map((parallel) => (
                    <Link
                      key={parallel.id}
                      href={parallel.href}
                      className="season-ticket__parallel-link"
                    >
                      <b>{parallel.name}</b>
                      <span>{parallel.statusLabel}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
