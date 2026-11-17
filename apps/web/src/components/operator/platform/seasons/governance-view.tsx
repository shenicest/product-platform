import Link from 'next/link'
import { Chip } from '@/components/ui/chip'
import { ButtonLink } from '@/components/ui/button'
import type { OrganizerOrg } from '@/lib/organizer'
import {
  formatScheduleRange,
  isPendingApproval,
  pendingApprovalRows,
  platformSeasonStatusMeta,
  readinessRatio,
  type PlatformSeasonRow,
} from '@/lib/platform-console'
import { SeasonDraftActions } from './season-draft-actions'
import { SeasonReviewActions } from './season-review-actions'

/**
 * 「赛季治理」tab。
 *
 * 两段结构对应设计稿：
 *   1. 待批准 —— 主办方提交后停在这里，批准前公开列表看不到；
 *   2. 全部赛季 —— 全平台赛季一览，带状态、组织、发奖主体、发布门槛与赛程。
 *
 * 每一行都能点进预览（`/operator/boomland/seasons/:id`）：预览用的是**管理视图**
 * 数据渲染公开页的样子，因为待批赛季的公开接口本来就 404 —— 「批准前看不到」
 * 这条规则在预览里也一样成立，只是管理员多了批准 / 驳回两个动作。
 */
export function SeasonGovernanceView({
  seasons,
  organizerOrgs,
  isOperator,
  failed,
}: {
  seasons: PlatformSeasonRow[]
  organizerOrgs: OrganizerOrg[]
  isOperator: boolean
  failed: boolean
}) {
  const pending = pendingApprovalRows(seasons)

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="mono">
          {seasons.length} 个赛季 · 待批准 {pending.length}
        </p>
        {/* 发起草稿 / 复制上季都只会新增一份草稿（`POST /seasons` 固定落 draft），
            不会顺带把任何赛季推进到发布状态，所以管理员与主办方成员都能用。
            非管理员在预览页与组织 tab 上是只读的，但建草稿本来就是主办方权限。 */}
        <SeasonDraftActions organizerOrgs={organizerOrgs} seasons={seasons} />
      </div>

      {failed ? (
        <p className="ui-note ui-note--danger" role="alert">
          赛季列表读取失败，请刷新重试。页面其余入口不受影响。
        </p>
      ) : null}

      <section aria-labelledby="platform-pending-title">
        <div className="mb-2 flex items-baseline gap-3">
          <h2 id="platform-pending-title" className="text-[clamp(22px,2.6vw,28px)] font-bold">
            待批准
          </h2>
          <span className="font-digits text-2xl leading-none text-brand-text">{pending.length}</span>
        </div>
        <p className="page-lead max-w-3xl">
          主办方提交后进入「即将开始 · 待批准」，大厅与火热赛季都看不到；批准后才公开、才可开赛。驳回退回草稿并附原因。
        </p>

        {pending.length === 0 ? (
          <p className="ui-hint mt-6">没有待批准的赛季。</p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {pending.map((season) => (
              <PendingSeasonCard key={season.id} season={season} isOperator={isOperator} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="platform-all-seasons-title">
        <div className="mb-2 flex items-baseline gap-3">
          <h2 id="platform-all-seasons-title" className="text-[clamp(22px,2.6vw,28px)] font-bold">
            全部赛季
          </h2>
          <span className="font-digits text-2xl leading-none text-muted-foreground">
            {seasons.length}
          </span>
        </div>
        <p className="page-lead max-w-3xl">
          全平台同时只允许 1 个置顶赛季：设置新置顶时自动取消旧置顶；已开赛的赛季只能由平台管理员取消。发布门槛按 9 项检查计算，不计分赛季会免除预算、积分池与评委分配三项。
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="console-table">
            <caption className="sr-only">全平台赛季列表</caption>
            <thead>
              <tr>
                <th scope="col">赛季</th>
                <th scope="col">状态</th>
                <th scope="col">主办方组织</th>
                <th scope="col">发奖主体</th>
                <th scope="col">发布门槛</th>
                <th scope="col">赛程</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {seasons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted-foreground">
                    还没有任何赛季。
                  </td>
                </tr>
              ) : (
                seasons.map((season) => (
                  <SeasonRow key={season.id} season={season} isOperator={isOperator} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function SeasonRow({
  season,
  isOperator,
}: {
  season: PlatformSeasonRow
  isOperator: boolean
}) {
  const status = platformSeasonStatusMeta(season)
  const readiness = readinessRatio(season)
  const pending = isPendingApproval(season)
  const previewHref = `/operator/boomland/seasons/${season.id}`

  return (
    <tr>
      <td>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Chip tone="accent" className="font-mono">
            {season.code}
          </Chip>
          <Link href={previewHref} className="font-bold text-foreground hover:text-brand-text">
            {season.name}
          </Link>
          {season.pinned ? <Chip tone="warning">置顶</Chip> : null}
        </div>
        <p className="mono mt-1">
          {season.organizerOrgs.map((org) => org.name).join(' · ') || '未指定主办方'}
          {season.city ? ` · ${season.city}` : ''}
        </p>
      </td>
      <td>
        <Chip tone={status.tone} dot>
          {status.label}
        </Chip>
      </td>
      <td>
        {season.organizerOrgs.length === 0
          ? <span className="text-muted-foreground">—</span>
          : season.organizerOrgs.map((org) => org.name).join('、')}
      </td>
      <td>{season.awardingEntity?.trim() || <span className="text-muted-foreground">—</span>}</td>
      <td>
        <span
          className={`font-digits ${readiness.ready ? 'text-success-text' : 'text-warning-text'}`}
          title={readiness.ready ? '发布门槛已全部通过' : '发布门槛尚未全部通过'}
        >
          {readiness.label}
        </span>
      </td>
      <td className="whitespace-nowrap">{formatScheduleRange(season.schedule)}</td>
      <td>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={previewHref} variant="ghost" size="sm">
            预览
          </ButtonLink>
          {pending ? (
            <SeasonReviewActions season={season} isOperator={isOperator} compact />
          ) : null}
        </div>
      </td>
    </tr>
  )
}

/**
 * 待批赛季的卡片：除了「去预览」，把审核需要的上下文（谁提交的、门槛差几项）
 * 直接摊在卡片上，审批人不必为了一个数字再点进去。
 */
function PendingSeasonCard({
  season,
  isOperator,
}: {
  season: PlatformSeasonRow
  isOperator: boolean
}) {
  const readiness = readinessRatio(season)
  return (
    <li className="ui-card ui-card--static p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="accent" className="font-mono">
              {season.code}
            </Chip>
            <Link
              href={`/operator/boomland/seasons/${season.id}`}
              className="text-body-lg font-bold text-foreground hover:text-brand-text"
            >
              {season.name}
            </Link>
            <Chip tone="warning" dot>
              待批准
            </Chip>
          </div>
          <p className="mono mt-2">
            {season.organizerOrgs.map((org) => org.name).join(' · ') || '未指定主办方'}
            {' · '}
            发布门槛 <span className={readiness.ready ? 'text-success-text' : 'text-warning-text'}>
              {readiness.label}
            </span>
            {' · '}
            {formatScheduleRange(season.schedule)}
          </p>
        </div>
        <SeasonReviewActions season={season} isOperator={isOperator} />
      </div>
    </li>
  )
}
