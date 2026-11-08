import type { Metadata } from 'next'
import Link from 'next/link'
import { SeasonApplicationStatus } from '@shenicest/shared'
import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { TeamNoSeasonState } from '@/components/me/team-project-card'
import { TeamWorkbench } from '@/components/me/team-workbench'
import { seasonStatusMeta } from '@/lib/boomland'
import { resolveTeamSeasonId } from '@/lib/team'
import {
  getMyProjectOptions,
  getMyTeamSeasons,
  getTeamChallenges,
  getTeamWorkbench,
} from '@/server/team'

export const metadata: Metadata = {
  title: '组队 · 个人中心',
  description: 'BoomLand 个人中心：赛季项目、招募卡与组队规则。',
}

export const dynamic = 'force-dynamic'

/**
 * 组队 tab。
 *
 * 取数顺序：
 *   1. 我参加的赛季（复用页头那份 `/me/applications`，`cache()` 去重）；
 *   2. 按 `?season=` 选中当前赛季，没传就取第一个进行中的；
 *   3. 首屏聚合 `GET /seasons/:id/team/me` 一次拿齐 5 张卡的数据，
 *      同时并行取命题（发起项目弹窗）与我的长期项目（带入）。
 *
 * 三态：没有赛季 → 空态；聚合接口报错 → 错误卡片（带后端原文）；
 * 正常 → 5 张卡。加载态由 Next 的 Suspense 边界承担（整页是 RSC，
 * 没有客户端二次请求，所以不需要骨架屏）。
 */
export default async function TeamPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const rawSeason = searchParams.season
  const seasonParam = Array.isArray(rawSeason) ? rawSeason[0] : rawSeason

  const seasons = await getMyTeamSeasons()
  const seasonId = resolveTeamSeasonId(seasonParam, seasons)

  if (seasonId === null) {
    return (
      <section className="section section--flush">
        <TeamNoSeasonState />
      </section>
    )
  }

  const [workbench, challenges, projects] = await Promise.all([
    getTeamWorkbench(seasonId),
    getTeamChallenges(seasonId),
    getMyProjectOptions(),
  ])

  if (workbench.kind === 'error') {
    return (
      <section className="section section--flush">
        <div className="ui-panel grid gap-3">
          <h2 className="text-h3 font-bold text-foreground">组队数据读取失败</h2>
          <p role="alert" className="ui-field-error">
            {workbench.message}
          </p>
          <p className="ui-hint m-0">
            这通常是赛季刚刚变更或后端暂时不可用。刷新页面重试，或回到赛季列表重新进入。
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/seasons" variant="secondary">
              去看看火热赛季
            </ButtonLink>
            <ButtonLink href="/me/team" variant="ghost">
              刷新
            </ButtonLink>
          </div>
        </div>
      </section>
    )
  }

  if (workbench.kind === 'empty') {
    return (
      <section className="section section--flush">
        <EmptyState
          title="NO TEAM"
          description="这个赛季还没有组队数据：你可能还没通过报名，或赛季已结束。"
          action={
            <ButtonLink href="/seasons" variant="secondary">
              去看看火热赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
            </ButtonLink>
          }
        />
      </section>
    )
  }

  const data = workbench.data

  return (
    <section className="section section--flush">
      {seasons.length > 1 ? (
        <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label="切换赛季">
          <span className="font-mono text-meta text-muted-foreground">赛季</span>
          {seasons.map((season) => {
            const active = season.id === seasonId
            const meta = seasonStatusMeta(season.status)
            return (
              <Link
                key={season.id}
                href={`/me/team?season=${season.id}`}
                aria-current={active ? 'page' : undefined}
                className={[
                  'ui-btn ui-btn--ghost ui-btn--small ui-btn--flat',
                  active ? 'border-brand bg-brand-wash text-brand-text' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {season.code} · {meta.label}
              </Link>
            )
          })}
        </nav>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Chip tone="accent" dot>
          {data.season.code}
        </Chip>
        <h1 className="m-0 text-h3 font-bold text-foreground">{data.season.name}</h1>
        {data.application ? (
          <Chip>
            {data.application.status === SeasonApplicationStatus.Accepted
              ? '报名已通过'
              : '报名处理中'}
          </Chip>
        ) : null}
        {data.participant ? null : <Chip tone="warning">你还没有通过报名</Chip>}
      </div>

      <TeamWorkbench data={data} challenges={challenges} bringableProjects={projects} />
    </section>
  )
}
