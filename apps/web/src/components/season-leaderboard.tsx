import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { SectionHead } from '@/components/ui/typography'
import {
  LEADERBOARD_RECENT_ACTIVITY,
  LEADERBOARD_RECENT_EVOLUTIONS,
  LEADERBOARD_RECENT_SCORES,
  WORKSPACE_LEADERBOARD,
  formatReward,
  type LeaderboardFeedItem,
  type LeaderboardRow,
} from '@/lib/season-workspace'

function rLevelTone(level: LeaderboardRow['rLevel']) {
  if (level === 'R5') return 'warning' as const
  if (level === 'R4') return 'sky' as const
  if (level === 'R3') return 'success' as const
  return 'neutral' as const
}

function LeaderboardFeed({
  eyebrow,
  title,
  items,
  tone,
}: {
  eyebrow: string
  title: string
  items: readonly LeaderboardFeedItem[]
  tone: 'score' | 'evolve' | 'active'
}) {
  return (
    <section className="ui-panel leaderboard-feed">
      <header className="leaderboard-feed__head">
        <span className="eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
      </header>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="leaderboard-feed__item">
            <span className={`leaderboard-feed__dot is-${tone}`} aria-hidden />
            <p>
              <b>{item.actor}</b> {item.action}
            </p>
            <time>{item.time}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 首页赛季排行榜。
 *
 * 布局参考「左边榜单 + 右边最近动态」，但视觉完全走当前项目的浅色体系：
 * `console-table` 做榜单、`ui-panel` 做侧栏，R 等级用现有 Chip 色调。
 */
export function SeasonLeaderboard() {
  return (
    <section className="section section--flush">
      <div className="shell">
        <SectionHead
          className="leaderboard-head"
          eyebrow="LEADERBOARD / 赛季排行榜"
          title="贡献积分 Top 10"
          lead="积分归项目，不按命题或作品拆分；预计奖金按 1 积分 = ¥1 计算，结算前只是预计。"
          aside={
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="accent" dot>
                AI4BBS · 进行中
              </Chip>
              <ButtonLink href="/seasons/1" variant="ghost" size="sm">
                查看赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
              </ButtonLink>
            </div>
          }
        />

        <div className="leaderboard-layout">
          <div className="ui-panel leaderboard-panel">
            <div className="overflow-x-auto">
              <table className="console-table leaderboard-table" aria-label="赛季贡献积分排行榜">
                <thead>
                  <tr>
                    <th scope="col">名次</th>
                    <th scope="col">项目 · 命题 · 阶段</th>
                    <th scope="col">R 等级</th>
                    <th scope="col" className="text-right">贡献积分</th>
                    <th scope="col" className="text-right">预计奖金</th>
                  </tr>
                </thead>
                <tbody>
                  {WORKSPACE_LEADERBOARD.map((row) => (
                    <tr key={row.rank} data-top={row.rank <= 3 ? 'true' : undefined}>
                      <td>
                        <span className="leaderboard-rank">
                          {String(row.rank).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="min-w-64">
                        <span className="leaderboard-project">{row.projectName}</span>
                        <span className="leaderboard-sub">{row.subtitle}</span>
                        <span className="leaderboard-mobile-meta">
                          {row.rLevel ?? '—'} · {row.points} 分 · {formatReward(row.reward)}
                        </span>
                      </td>
                      <td>
                        {row.rLevel ? (
                          <Chip tone={rLevelTone(row.rLevel)}>{row.rLevel}</Chip>
                        ) : (
                          <span className="workspace-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="leaderboard-points">{row.points}</span>
                      </td>
                      <td className="text-right">
                        <span className="leaderboard-reward">
                          {formatReward(row.reward)}
                        </span>
                        <span className="leaderboard-reward-note">预计</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="leaderboard-foot">
              收入金额不进榜；榜单只展示贡献积分、预计奖金与已核验的 R 等级。
            </p>
          </div>

          <aside className="leaderboard-side">
            <LeaderboardFeed
              eyebrow="RECENT SCORES / 最近评分"
              title="最近评分"
              items={LEADERBOARD_RECENT_SCORES}
              tone="score"
            />
            <LeaderboardFeed
              eyebrow="RECENT EVOLUTION / 最近进化"
              title="最近进化"
              items={LEADERBOARD_RECENT_EVOLUTIONS}
              tone="evolve"
            />
            <LeaderboardFeed
              eyebrow="RECENT ACTIVITY / 最近活跃"
              title="最近活跃"
              items={LEADERBOARD_RECENT_ACTIVITY}
              tone="active"
            />
          </aside>
        </div>
      </div>
    </section>
  )
}
