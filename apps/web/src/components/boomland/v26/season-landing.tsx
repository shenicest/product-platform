'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  SEASON_COVER_ACTIVE,
  SEASON_COVER_UPCOMING,
  SEASON_GROUPS,
  featuredIndex,
  sortCardsByStage,
  type SeasonCardView,
  type SeasonGroup,
} from '@/lib/season-landing'

/**
 * 火热赛季落地页（设计稿 `.hero` + `.event-ticket-grid`）。
 *
 * 为什么整页是一个 Client Component：设计稿的首屏是「一场推荐赛季 + 底部
 * 切换器」，列表又有「全部 / 即将开始 / 报名中 / 进行中」四个筛选 tab。
 * 这两块都是纯展示状态（不请求接口、不改数据），放客户端最省事，也不会
 * 让服务端为每次切换重渲染。
 *
 * 卡片本身仍然只链到一个地方：`/seasons/:id`。设计稿里的「立即报名」是
 * 在票券内部直接跳报名页，但本项目把报名表放在独立路由且需要登录态，
 * 统一先进入赛季详情再点海报上的票券 CTA，入口更少、状态也更一致。
 */

function CalendarIcon() {
  // 24px 的静态图标用原生 img：走 next/image 的优化器反而多一次请求。
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/season-calendar.svg" alt="" aria-hidden width={24} height={24} />
  )
}

function UsersIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/season-users.svg" alt="" aria-hidden width={24} height={24} />
  )
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === 'left' ? (
        <path d="M15 5l-7 7 7 7" />
      ) : (
        <path d="M9 5l7 7-7 7" />
      )}
    </svg>
  )
}

function seasonTitle(name: string): { eyebrow: string; title: string } {
  const cleaned = name.replace(/^boomland\s*/i, '').trim() || name
  return { eyebrow: 'BoomLand', title: cleaned }
}

function TicketCard({ card }: { card: SeasonCardView }) {
  const capacityLabel =
    card.participantCapacity === null ? '不限' : String(card.participantCapacity)
  const percent =
    card.participantCapacity && card.participantCapacity > 0
      ? Math.min(100, Math.round((card.participantCount / card.participantCapacity) * 100))
      : 0

  // 未开始的赛季直接给报名入口；其余状态进详情页。
  const cta = card.upcoming
    ? { label: '立即报名', href: `/seasons/${card.id}/apply` }
    : { label: '查看赛季', href: card.href }

  return (
    <article className="v26-ticket">
      {/* 通栏详情链接铺在卡片上，CTA 以更高层级浮在右下角，避免嵌套 <a>。 */}
      <Link
        href={card.href}
        className="v26-ticket__detail"
        aria-label={`查看 ${card.name} 详情`}
      />

      <span className="v26-ticket__shadow">
        <span className="v26-ticket__shape">
          <span className="v26-ticket__cover">
            {/* 未开始的赛季用 cover2，其余用 cover1（设计稿提供的两张封面）。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.upcoming ? SEASON_COVER_UPCOMING : SEASON_COVER_ACTIVE}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
            />
            <span className="v26-ticket__code">{card.code}</span>
            <span className="v26-ticket__statuses">
              <span className={`v26-ticket__status is-${card.statusTone}`}>
                {card.ticketStatusLabel}
              </span>
            </span>
          </span>

          <span className="v26-ticket__body">
            <span className="v26-ticket__heading">
              <span className="v26-ticket__title">{card.name}</span>
              <span className="v26-ticket__org">
                {card.organizer} · {card.typeLabel} · {card.challengeCount} 个命题
              </span>
            </span>

            <span className="v26-ticket__desc">{card.description}</span>

            <span className="v26-ticket__date">
              <CalendarIcon />
              {card.dateRange}
            </span>

            <span className="v26-ticket__foot">
              <span className="v26-ticket__quota">
                <span className="v26-ticket__quota-label">
                  <span>已通过 {card.participantCount}</span>
                  <span>
                    {card.participantCapacity === null
                      ? '不限名额'
                      : `共 ${capacityLabel} 个名额`}
                  </span>
                </span>
                <span className="v26-ticket__track" aria-hidden>
                  <i style={{ width: `${percent}%` }} />
                </span>
              </span>
            </span>
          </span>
        </span>
      </span>

      <span className="v26-ticket__frame" aria-hidden />

      <Link
        href={cta.href}
        className="v26-ticket__cta"
        aria-label={`${cta.label}：${card.name}`}
      >
        {cta.label} <span aria-hidden>→</span>
      </Link>
    </article>
  )
}

export function SeasonLanding({ cards }: { cards: SeasonCardView[] }) {
  const [featured, setFeatured] = useState(() => featuredIndex(cards))
  const [group, setGroup] = useState<'全部' | SeasonGroup>('全部')

  const event = cards[featured]
  const filtered = useMemo(
    () =>
      sortCardsByStage(
        group === '全部' ? cards : cards.filter((card) => card.group === group),
      ),
    [cards, group],
  )

  if (!event) return null

  const title = seasonTitle(event.name)
  const capacity =
    event.participantCapacity === null ? '不限' : String(event.participantCapacity)

  function move(step: number) {
    setFeatured((current) => {
      const next = current + step
      if (next < 0) return cards.length - 1
      if (next >= cards.length) return 0
      return next
    })
  }

  return (
    <div className="v26 v26-seasons">
      <section className="v26-hero" aria-label="本季推荐">
        <div className="v26-hero__body">
          <div className="v26-hero__badges">
            <span className="ui-chip is-status">{event.statusLabel}</span>
            {event.registrationLabel ? (
              <span className="ui-chip is-reg">{event.registrationLabel}</span>
            ) : null}
            <span className="ui-chip is-type">{event.typeLabel}</span>
            <span className="v26-hero__org">{event.organizer}</span>
          </div>

          <h1>
            <span>{title.eyebrow}</span>
            <span>{title.title}</span>
          </h1>

          <p className="v26-hero__tagline">{event.description}</p>

          <p className="v26-hero__meta">
            <CalendarIcon />
            活动 {event.dateRange}
          </p>
          <p className="v26-hero__meta">
            <UsersIcon />
            已通过 {event.participantCount} / {capacity} · {event.challengeCount} 个命题
          </p>
        </div>

        <Link href={event.href} className="v26-hero__cta">
          探索本季 <span aria-hidden>→</span>
        </Link>

        <div className="v26-hero__bottom" role="group" aria-label="切换推荐赛季">
          <button
            type="button"
            className="v26-hero__arrow"
            aria-label="上一场赛季"
            onClick={() => move(-1)}
          >
            <ArrowIcon direction="left" />
          </button>

          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className="v26-hero__switch"
              aria-pressed={index === featured}
              onClick={() => setFeatured(index)}
            >
              {card.name.replace(/^boomland\s*/i, '')}
              <small>{card.statusLabel}</small>
            </button>
          ))}

          <button
            type="button"
            className="v26-hero__arrow"
            aria-label="下一场赛季"
            onClick={() => move(1)}
          >
            <ArrowIcon direction="right" />
          </button>
        </div>
      </section>

      <div className="v26-shell v26-shell--wide">
        <div className="v26-filter">
          <div className="v26-filter__tabs" role="group" aria-label="筛选赛季">
            {(['全部', ...SEASON_GROUPS] as const).map((item) => (
              <button
                key={item}
                type="button"
                className="v26-filter__tab"
                aria-pressed={group === item}
                onClick={() => setGroup(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="v26-filter__links">
            <span>共 {cards.length} 个赛季</span>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="v26-ticket-grid">
            {filtered.map((card) => (
              <TicketCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="ui-empty">
            <strong>没有符合条件的赛季</strong>
            <p className="mt-2 text-body-sm">换一个筛选条件，或稍后再来看看。</p>
          </div>
        )}
      </div>
    </div>
  )
}
