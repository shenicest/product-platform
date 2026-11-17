import Link from 'next/link'
import { Chip } from '@/components/ui/chip'
import { SeasonDetailPage } from '@/components/boomland/season-detail'
import { formatDateTime } from '@/lib/boomland'
import {
  isPendingApproval,
  platformSeasonStatusMeta,
  readinessRatioFromChecks,
} from '@/lib/platform-console'
import type { PlatformSeasonPreviewData } from '@/server/platform-console'
import { SeasonReviewActions } from './season-review-actions'

/**
 * 赛季预览页。
 *
 * 布局：顶部是审批条（状态 / 门槛 / 批准 / 驳回），下面是**公开页的渲染结果**。
 * 预览直接复用公开页组件（`SeasonDetailPage`），而不是另做一套「简化预览」——
 * 两套渲染必然漂移，而审批人批的正是那一套公开页。
 *
 * 数据源是**管理视图**（`GET /seasons/:id/manage`）：待批赛季的公开接口本来就会
 * 404（`approvedAt` 为空即不公开），这也正好是「批准前公开列表看不到」这条规则的
 * 另一种证明 —— 预览能看见，是因为你有管理权限，不是因为它已经公开了。
 */
export function PlatformSeasonPreviewView({
  data,
  isOperator,
}: {
  data: PlatformSeasonPreviewData
  isOperator: boolean
}) {
  const { season, readiness, challenges, announcements } = data
  const status = platformSeasonStatusMeta(season)
  const ratio = readinessRatioFromChecks(readiness?.checks, readiness?.ready)
  const pending = isPendingApproval(season)
  const failed = readiness?.checks.filter((check) => !check.passed) ?? []

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="preview-title" className="flex flex-col gap-4">
        <nav className="mono" aria-label="返回">
          <Link href="/operator/boomland/seasons" className="hover:text-brand-text">
            ← 赛季治理
          </Link>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="accent" className="font-mono">
                {season.code}
              </Chip>
              <h2 id="preview-title" className="text-[clamp(24px,3vw,34px)] leading-tight font-bold">
                {season.name}
              </h2>
              <Chip tone={status.tone} dot>
                {status.label}
              </Chip>
              {season.pinned ? <Chip tone="warning">置顶</Chip> : null}
            </div>
            <p className="mono mt-2">
              {season.organizerOrgs.map((org) => org.name).join(' · ') || '未指定主办方'}
              {' · '}
              发布门槛{' '}
              <span className={ratio.ready ? 'text-success-text' : 'text-warning-text'}>
                {ratio.label}
              </span>
              {season.approvedAt ? ` · 批准于 ${formatDateTime(season.approvedAt)}` : ''}
            </p>
          </div>

          <SeasonReviewActions
            season={{
              id: season.id,
              name: season.name,
              status: season.status,
              approvedAt: season.approvedAt,
              readinessReady: readiness?.ready ?? false,
            }}
            isOperator={isOperator}
          />
        </div>

        {pending ? (
          <p className="ui-note ui-note--warning" role="note">
            该赛季仍待批准：批准前它不会出现在火热赛季、大厅与搜索结果里，公开页对其他人是 404。批准后才公开、才可开赛。
          </p>
        ) : null}

        {season.rejection ? (
          <p className="ui-note ui-note--danger" role="note">
            上次被驳回（{formatDateTime(season.rejection.at)}）：{season.rejection.reason}
          </p>
        ) : null}

        {failed.length > 0 ? (
          <div className="ui-panel" aria-labelledby="preview-failed-title">
            <p className="ui-panel__label" id="preview-failed-title">
              还没通过的门槛（{failed.length} / {ratio.total}）
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {failed.map((check) => (
                <li key={check.key} className="flex flex-wrap items-baseline gap-2 text-body-sm">
                  <span aria-hidden className="text-warning-text">✗</span>
                  <span className="font-bold text-foreground">{check.label}</span>
                  {check.detail ? <span className="text-muted-foreground">{check.detail}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="preview-public-title" className="border-t border-border pt-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="preview-public-title" className="text-h3 font-bold">
            公开页预览
          </h3>
          <p className="mono">按访客视角渲染 · 报名入口不会真的提交</p>
        </div>
        <SeasonDetailPage
          season={season}
          challenges={challenges}
          announcements={announcements}
          myApplication={null}
          isLoggedIn={false}
          breadcrumb={
            <>
              <Link href="/operator/boomland/seasons">← 赛季治理</Link>
              <span aria-hidden>/</span>
              <span>{season.name}（预览）</span>
            </>
          }
        />
      </section>
    </div>
  )
}
