import Link from 'next/link'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { ButtonLink } from '@/components/ui/button'
import { publicSeasonCards } from '@/lib/me-applications'
import type { SeasonSummary } from '@/lib/boomland'

/**
 * 「公开的赛季」卡片列表。
 *
 * 纯展示的 Server Component：卡片需要展示什么、每段文案怎么说，
 * 全部由 `publicSeasonCards()` 算好（可单测），这里只负责排版。
 *
 * 卡片用 `<article>`：每一张都是一个可以独立阅读的单元（编号、类型、
 * 状态、名称、时间窗、名额、截止提示），读屏可以按 article 逐张跳读。
 *
 * 网格用现有的 `.card-grid`（1 / 2 / 3 列响应式），不新写断点。
 */
export function PublicSeasonGrid({ seasons }: { seasons: SeasonSummary[] }) {
  const cards = publicSeasonCards(seasons)

  if (cards.length === 0) {
    return (
      <EmptyState
        title="NO OPEN SEASON"
        description="现在没有公开可报名的赛季。新赛季开赛后会自动出现在这里。"
        action={
          <ButtonLink href="/seasons" variant="secondary">
            查看火热赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div className="card-grid">
      {cards.map((card) => (
        <article key={card.id} className="ui-card" aria-labelledby={`season-card-${card.id}`}>
          <div className="card-body">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="accent" className="font-mono">
                {card.code}
              </Chip>
              <Chip tone="neutral">{card.typeLabel}</Chip>
              <Chip tone={card.seasonStatusTone} dot>
                {card.seasonStatusLabel}
              </Chip>
              <Chip tone={card.windowTone}>{card.windowLabel}</Chip>
              {card.pinned ? <Chip tone="warning">置顶</Chip> : null}
            </div>

            <h3 id={`season-card-${card.id}`} className="card-title mt-2">
              <Link
                href={card.href}
                className="transition-colors hover:text-brand-text"
              >
                {card.name}
              </Link>
            </h3>

            <p className="card-text">{card.applyWindow}</p>
            <p className="card-meta font-mono">{card.participants}</p>
          </div>

          <footer className="card-footer">
            <p className="m-0 text-meta text-muted-foreground">
              <span aria-hidden>{card.deadline.closed ? '🔒 ' : '🗓 '}</span>
              {card.deadline.text}
            </p>
            <ButtonLink href={card.href} variant="ghost" size="sm">
              查看赛季
            </ButtonLink>
          </footer>
        </article>
      ))}
    </div>
  )
}
