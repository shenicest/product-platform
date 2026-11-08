import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import type { ApplicationListItem, ApplicationReviewStats } from '@/lib/organizer-applications'
import {
  reviewStatusMeta,
  submissionStamp,
  teamIntentLabel,
} from '@/lib/organizer-applications'

/**
 * 报名审核 tab 的纯展示件。
 *
 * 全部无状态、无副作用：只吃 props、只吐 DOM。所有会写数据的按钮由调用方
 * 以 `actions` 传入 —— 这样这些组件既能被 Server Component 直接渲染，
 * 也能被客户端视图复用，不用背 `'use client'` 的包袱。
 *
 * 视觉沿用现有体系：`ui-metric` 作统计卡、`ui-panel` 作卡片外壳、
 * `console-table` 作表格、`ui-chip` 作状态标记。
 */

// ---------------------------------------------------------------------------
// 顶部统计
// ---------------------------------------------------------------------------

/**
 * 三块统计：已通过选手 / 名额、候补数、报名窗口。
 *
 * 数字用 `ui-metric__value` 的大字号，说明用 `ui-metric__hint` —— 与运营后台
 * 的数据指标卡同一套排版，不新造一种卡片。
 */
export function ApplicationStatsRow({ stats }: { stats: ApplicationReviewStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3" data-testid="application-stats">
      <article className="ui-metric" aria-label="已通过选手与名额">
        <span className="ui-metric__label">{stats.approvedLabel}</span>
        <strong className="ui-metric__value font-mono">{stats.approved}</strong>
        <p className="ui-metric__hint">以在场选手计，退出后名额自动释放</p>
      </article>

      <article className="ui-metric" aria-label="候补人数">
        <span className="ui-metric__label">候补</span>
        <strong className="ui-metric__value font-mono">{stats.waitlisted}</strong>
        <p className="ui-metric__hint">名额满时通过会自动转入候补</p>
      </article>

      <article className="ui-metric" aria-label="报名窗口">
        <span className="ui-metric__label">报名窗口</span>
        <strong className="ui-metric__value text-h3">{stats.window.label}</strong>
        <p className="ui-metric__hint font-mono">{stats.window.range ?? '赛程未排期'}</p>
      </article>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 表格
// ---------------------------------------------------------------------------

/** 表头：与截图一致的八列。 */
const COLUMNS = [
  { key: 'applicant', label: '报名人' },
  { key: 'submittedAt', label: '提交时间' },
  { key: 'skills', label: '技能与经历' },
  { key: 'themes', label: '兴趣主题' },
  { key: 'team', label: '组队' },
  { key: 'contact', label: '拉群联系方式' },
  { key: 'status', label: '状态' },
  { key: 'actions', label: '操作' },
] as const

/** 报名者头像：有图用图，没图用昵称首字；都没有就是一枚占位。 */
function ApplicantAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <span className="ui-avatar">
        {/* 头像是外部 URL，next/image 需要额外域名配置，这里用原生 img。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" loading="lazy" />
      </span>
    )
  }
  return (
    <span className="ui-avatar" aria-hidden>
      {name?.trim().slice(0, 1) || '?'}
    </span>
  )
}

/** 兴趣主题：0–3 个胶囊，没有时给一个低调的占位。 */
function ThemeChips({ themes }: { themes: string[] }) {
  if (themes.length === 0) {
    return <span className="text-muted-foreground">未选择方向</span>
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {themes.map((theme) => (
        <Chip key={theme} tone="neutral" className="text-meta">
          {theme}
        </Chip>
      ))}
    </span>
  )
}

/** 联系方式：列表只有掩码，永远不出现明文。 */
function ContactCell({ masked }: { masked: string | null }) {
  if (!masked) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className="font-mono text-meta break-all text-foreground">
      {masked}
    </span>
  )
}

/**
 * 报名列表。
 *
 * 行是可点的：点报名人/任意单元格打开详情（完整联系方式、经历、组队意向、
 * 审核历史）。操作列单独拦住点击，避免「想点通过却先弹了详情」。
 */
export function ApplicationTable({
  items,
  onSelect,
  renderActions,
}: {
  items: ApplicationListItem[]
  onSelect?: (application: ApplicationListItem) => void
  renderActions?: (application: ApplicationListItem) => React.ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      {/* 八列在窄屏必然横向溢出；`console-table--sticky-actions` 把操作列
          冻结在右侧，滚动找内容时「通过 / 不通过」始终点得到。 */}
      <table className="console-table console-table--sticky-actions" aria-label="报名审核队列">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((application) => {
            const stamp = submissionStamp(application.createdAt)
            const status = reviewStatusMeta(application.status)
            const selectable = Boolean(onSelect)
            return (
              <tr
                key={application.id}
                data-application-id={application.id}
                data-status={application.status}
                className={selectable ? 'cursor-pointer' : undefined}
                onClick={selectable ? () => onSelect?.(application) : undefined}
              >
                <td className="min-w-40">
                  {selectable ? (
                    <button
                      type="button"
                      className="flex items-center gap-3 text-left"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelect?.(application)
                      }}
                      aria-label={`查看 ${application.applicant.name ?? application.userId} 的报名详情`}
                    >
                      <ApplicantAvatar
                        name={application.applicant.name}
                        avatarUrl={application.applicant.avatarUrl}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-foreground">
                          {application.applicant.name ?? application.userId}
                        </span>
                        <span className="block font-mono text-meta text-muted-foreground">
                          {application.userId}
                        </span>
                      </span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-3">
                      <ApplicantAvatar
                        name={application.applicant.name}
                        avatarUrl={application.applicant.avatarUrl}
                      />
                      <span className="font-bold text-foreground">
                        {application.applicant.name ?? application.userId}
                      </span>
                    </span>
                  )}
                </td>

                <td className="whitespace-nowrap font-mono text-meta">
                  <span className="block text-foreground">{stamp.date}</span>
                  <span className="block text-muted-foreground">{stamp.time}</span>
                </td>

                <td className="min-w-56 max-w-72">
                  <span className="block font-bold text-foreground">{application.skills}</span>
                  <span className="mt-1 block line-clamp-2 text-meta text-muted-foreground">
                    {application.experience}
                  </span>
                </td>

                <td className="min-w-40">
                  <ThemeChips themes={application.themes} />
                </td>

                <td className="min-w-44">
                  <span className="block font-bold text-foreground">
                    {teamIntentLabel(application.acceptsSolo)}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-meta text-muted-foreground">
                    {application.teamIntent}
                  </span>
                </td>

                <td className="min-w-36">
                  <ContactCell masked={application.contactMasked} />
                </td>

                <td>
                  <span className="flex flex-col items-start gap-1">
                    <Chip tone={status.tone} dot>
                      {status.label}
                    </Chip>
                    {application.reviewReason ? (
                      <span className="text-meta text-muted-foreground">
                        {application.reviewReason}
                      </span>
                    ) : null}
                  </span>
                </td>

                {/* 操作列：图标按钮，四个并排约 140px。
                    用 `w-px whitespace-nowrap` 让这一列「按内容收缩、不参与
                    表格的等分拉伸」—— 否则 auto layout 会把富余宽度分给所有列，
                    操作列白白变宽，而真正需要宽度的技能/组队列反而更窄。 */}
                <td
                  className="w-px whitespace-nowrap"
                  onClick={(event) => event.stopPropagation()}
                >
                  {renderActions ? (
                    renderActions(application)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 页面级提示
// ---------------------------------------------------------------------------

/** 没选中具体赛季：审核队列是按赛季的，没有赛季就没有队列。 */
export function NoSeasonSelectedForReview() {
  return (
    <EmptyState
      title="SELECT A SEASON"
      description="报名审核按赛季进行：先在顶部的赛季选择器里选一个赛季。"
    />
  )
}

/** 无权限（403）。 */
export function ReviewForbidden({ action }: { action?: React.ReactNode }) {
  return (
    <EmptyState
      title="FORBIDDEN"
      description="你不是这个赛季的主办方，无法查看它的报名。切换赛季或联系平台管理员。"
      action={action}
    />
  )
}

/** 读取失败（非 403）。 */
export function ReviewLoadFailed({ message }: { message?: string }) {
  return (
    <EmptyState
      title="LOAD FAILED"
      description={message || '读取报名队列失败，请稍后刷新重试。'}
    />
  )
}

/** 筛选后没有结果。 */
export function ReviewEmpty({ description }: { description?: string }) {
  return (
    <EmptyState
      title="NO APPLICATIONS"
      description={description ?? '这个筛选下还没有报名。'}
    />
  )
}

/** 页面顶部 eyebrow：本 tab 的身份说明 + 当前赛季编号。 */
export function ApplicationsHeader({ code, name }: { code: string; name: string }) {
  return (
    <div className="mb-6">
      <Eyebrow tone="accent">APPLICATION REVIEW</Eyebrow>
      <p className="mt-2 font-mono text-meta text-muted-foreground">
        {code} · {name}
      </p>
    </div>
  )
}
