import Link from 'next/link'
import type { SeasonAnnouncement } from '@/lib/boomland'
import {
  announcementCategoryLabel,
  formatDateTime,
  seasonStatusMeta,
  seasonTypeLabel,
} from '@/lib/boomland'
import type { SeasonManageDetail, SeasonReadiness } from '@/lib/organizer'
import {
  readinessCheckHref,
  readinessCheckLinkLabel,
  ruleCardStatusLabel,
  ruleSummaryRows,
  scheduleMilestoneRows,
  summarizeReadiness,
  type ReadinessSummary,
} from '@/lib/organizer-settings'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

/**
 * 赛季设置 tab 的纯展示件。
 *
 * 全部**无状态、无副作用**：只吃 props、只吐 DOM。所有按钮由调用方以
 * `actions` 传入 —— 这样这些组件既能被 Server Component 直接渲染，
 * 也能被客户端视图复用，而不用背 `'use client'` 的包袱。
 *
 * 视觉沿用现有体系：`ui-panel` 作卡片外壳、`console-table` 作表格、
 * `ui-chip` 作状态标记、`eyebrow` / `mono` 作小标与元信息。
 */

// ---------------------------------------------------------------------------
// 通用小件
// ---------------------------------------------------------------------------

/** 一行「标签 — 值」；`wide` 用于值可能很长、需要换行的行。 */
export function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 border-b border-border-soft py-3 last:border-b-0">
      <dt className="text-body-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body-sm text-foreground">{children}</dd>
    </div>
  )
}

/** 空值的统一写法：一个低调的破折号，读屏念「无」。 */
export function EmptyValue({ label = '—' }: { label?: string }) {
  return (
    <span className="text-muted-foreground" aria-label="无">
      {label}
    </span>
  )
}

/**
 * 时间戳展示：有值走 `formatDateTime`（北京时间），空值给「—」。
 *
 * 为什么不直接用 `formatDateTime`：它对空值返回「待定」，那是赛程节点的
 * 语义（还没排期）；「发起 / 提交 / 批准」这三个时间戳空着只是**还没发生**，
 * 写「待定」会被误读成排期未定。
 */
function timeOrDash(value: string | null | undefined): string {
  return value ? formatDateTime(value) : '—'
}

/** 区块头：标题 + 右侧计数/操作。 */
function SectionHead({
  title,
  meta,
  lead,
  actions,
}: {
  title: string
  meta?: React.ReactNode
  lead?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-baseline gap-3 text-h3 font-bold text-foreground">
          {title}
          {meta ? <span className="font-mono text-meta text-muted-foreground">{meta}</span> : null}
        </h2>
        {lead ? (
          <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted-foreground">{lead}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 赛季概要卡
// ---------------------------------------------------------------------------

/**
 * 左侧「赛季概要卡」：编号 + 名称 + 状态，下面逐行列出主办方、发奖主体、
 * 类型形式、负责人、三个时间戳、选手名额；底部是状态操作按钮（由父级传入）。
 *
 * 负责人只显示 `detail.createdBy`；后端管理视图没暴露这个字段时显示「—」，
 * 不猜、不伪造。
 */
export function SeasonSummaryCard({
  detail,
  actions,
}: {
  detail: SeasonManageDetail
  actions?: React.ReactNode
}) {
  const status = seasonStatusMeta(detail.status)
  const pending = detail.pendingApproval
  const organizerNames = detail.organizerOrgs.map((org) => org.name)
  const createdBy = (detail as SeasonManageDetail & { createdBy?: string | null }).createdBy ?? null

  return (
    <section className="ui-panel" aria-labelledby="season-summary-title">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent" className="font-mono">
          {detail.code}
        </Chip>
        {pending ? <Chip tone="warning">待批准</Chip> : <Chip tone={status.tone}>{status.label}</Chip>}
        {detail.type === 'hackathon' && detail.city ? <Chip tone="sky">{detail.city}</Chip> : null}
      </div>

      <h2 id="season-summary-title" className="mt-3 text-h3 font-bold text-foreground">
        {detail.name}
      </h2>

      <dl className="mt-4">
        <InfoRow label="主办方组织">
          {organizerNames.length > 0 ? organizerNames.join('、') : <EmptyValue />}
        </InfoRow>
        <InfoRow label="发奖主体">
          {detail.awardingEntity ? detail.awardingEntity : <EmptyValue label="未指定" />}
        </InfoRow>
        <InfoRow label="类型 · 形式">
          <span className="flex flex-wrap items-center gap-2">
            <span>{seasonTypeLabel(detail.type)}</span>
            {detail.themes.length > 0 ? (
              detail.themes.map((theme) => (
                <Chip key={theme} tone="neutral" className="text-meta">
                  {theme}
                </Chip>
              ))
            ) : (
              <span className="text-muted-foreground">主题未设置</span>
            )}
          </span>
        </InfoRow>
        <InfoRow label="负责人">{createdBy ? createdBy : <EmptyValue />}</InfoRow>
        <InfoRow label="发起 · 提交 · 批准">
          <span className="font-mono text-meta">
            {timeOrDash(detail.createdAt)} · {timeOrDash(detail.timestamps.submittedAt)} ·{' '}
            {timeOrDash(detail.timestamps.approvedAt)}
          </span>
        </InfoRow>
        <InfoRow label="选手名额">
          {detail.participantCapacity === null ? '不限' : detail.participantCapacity}
        </InfoRow>
      </dl>

      {actions ? <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 规则摘要卡
// ---------------------------------------------------------------------------

/**
 * 右侧「规则」卡：`v{n}` 版本 + 状态（草稿 / 已生效）+ 九行摘要。
 * 「修改规则」按钮由父级传入（只有 draft / upcoming 可点）。
 */
export function RulesSummaryCard({
  detail,
  actions,
}: {
  detail: SeasonManageDetail
  actions?: React.ReactNode
}) {
  const rows = ruleSummaryRows({
    rules: detail.rules,
    participantCapacity: detail.participantCapacity,
    agreementVersion: detail.agreementVersion,
  })

  return (
    <section className="ui-panel" aria-labelledby="season-rules-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="season-rules-title" className="flex items-baseline gap-2 text-h3 font-bold text-foreground">
            规则
            <span className="font-mono text-meta text-muted-foreground">v{detail.rulesVersion}</span>
            <span className="font-mono text-meta text-brand-text">
              {ruleCardStatusLabel(detail.status)}
            </span>
          </h2>
        </div>
        {actions}
      </div>

      <dl className="mt-4">
        {rows.map((row) => (
          <InfoRow key={row.key} label={row.label}>
            <span className="font-mono text-meta">{row.value}</span>
          </InfoRow>
        ))}
      </dl>

      <p className="ui-hint mt-4">
        开赛后兑换比例、单次评分上限、复核阈值与命题上限不能改；已批准的赛季改这几项或积分池需重新批准。
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 发布门槛
// ---------------------------------------------------------------------------

/**
 * 门槛卡的通过 / 未通过图标。
 *
 * 项目没有引入图标库，沿用 `components/boomland/season-rules-grid.tsx` 的
 * 手写 inline SVG（24 网格、`currentColor` 描边）。`aria-hidden` 保留：
 * 「通过 / 缺失」的语义由右侧 chip 与文字承担，图标只是加速扫读。
 */
function ReadinessCheckIcon({ passed }: { passed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      focusable="false"
      className="block size-4 shrink-0"
    >
      {passed ? (
        <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
      )}
    </svg>
  )
}

/** 一张门槛卡的内容（图标 + 名称 + chip + 缺失说明）；点击与否由外层决定。 */
function ReadinessCheckBody({ check }: { check: SeasonReadiness['checks'][number] }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className={check.passed ? 'mt-0.5 text-success-text' : 'mt-0.5 text-danger-text'}>
          <ReadinessCheckIcon passed={check.passed} />
        </span>
        <p className="text-body-sm font-bold text-foreground">{check.label}</p>
        <span className="ml-auto">
          {check.passed ? (
            <Chip tone="success" className="text-meta">
              通过
            </Chip>
          ) : (
            <Chip tone="danger" className="text-meta">
              缺失
            </Chip>
          )}
        </span>
      </div>
      {check.detail ? (
        <p
          className={
            check.passed ? 'text-meta text-muted-foreground' : 'text-meta text-danger-text'
          }
        >
          {check.detail}
        </p>
      ) : null}
    </>
  )
}

/**
 * 九项发布门槛。
 *
 * 通过项给绿色 chip；未通过项整卡染成危险色并列出「缺什么」（后端 `detail`）。
 * `readiness` 为 null 时说明这一块读不到，给出降级提示而不是假装全缺。
 *
 * 传了 `seasonId` 时，能映射到某个 tab 的门槛卡整张变成 `<Link>`，点一下
 * 直接去补那一项（`?season=` 跟着走，不会退回「全部赛季」）；映射不到、
 * 或没传 `seasonId` 时保持不可点击 —— 不猜去处，也不给死链。
 */
export function ReadinessSection({
  readiness,
  summary,
  seasonId,
}: {
  readiness: SeasonReadiness | null
  /** 可复用父级已算好的汇总；不传则内部算。 */
  summary?: ReadinessSummary
  /** 当前赛季 id；不传时门槛卡不可点击（调用方还没接上时的安全降级）。 */
  seasonId?: number | null
}) {
  const stats = summary ?? summarizeReadiness(readiness)

  return (
    <section aria-labelledby="season-readiness-title" className="mt-10">
      <SectionHead
        title="发布门槛"
        meta={stats.total > 0 ? `${stats.passed}/${stats.total}` : undefined}
        lead="发布前一次检查全部九项，缺失时逐项列出。不计分赛季免除预算、积分池、评委三项。主办方提交后需平台管理员批准；平台管理员提交即生效。点击门槛卡可直接前往对应设置。"
      />

      {!readiness ? (
        <p className="ui-note ui-note--warning">
          发布门槛暂时读不到（后端未返回），请刷新页面重试；这不会影响其它设置。
        </p>
      ) : stats.total === 0 ? (
        <p className="ui-note">这个赛季还没有可检查的门槛项。</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {readiness.checks.map((check) => {
            const href = readinessCheckHref(check.key, seasonId)
            const linkLabel = href ? readinessCheckLinkLabel(check.key) : null
            const cardClass = cn(
              // `h-full`：卡片从 `<li>` 挪进 `<Link>`/`<div>` 后仍撑满整格，
              // 同一行里长短不一的说明文字不会把卡片撑成不同高度。
              'ui-card h-full gap-2 p-4',
              !check.passed && 'border-danger-line bg-danger-soft',
              // 可点击时保留悬停上浮（可点的视觉提示）；不可点击时保持静止。
              !href && 'ui-card--static',
            )
            return (
              <li key={check.key}>
                {href ? (
                  <Link
                    href={href}
                    // 可访问名带上门槛本身（「赛程完整：前往修改赛程」）：
                    // 只写目的地会丢掉这张卡在讲哪一项。
                    aria-label={linkLabel ? `${check.label}：${linkLabel}` : undefined}
                    className={cardClass}
                  >
                    <ReadinessCheckBody check={check} />
                  </Link>
                ) : (
                  <div className={cardClass}>
                    <ReadinessCheckBody check={check} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 赛程
// ---------------------------------------------------------------------------

/**
 * 「赛程（北京时间）」：八个节点三列（时间点 / 时间 / 到点后的行为）。
 * 未排期的节点时间列显示「待定」。改赛程按钮由父级传入。
 */
export function ScheduleSection({
  schedule,
  actions,
}: {
  schedule: SeasonManageDetail['schedule']
  actions?: React.ReactNode
}) {
  const rows = scheduleMilestoneRows(schedule)

  return (
    <section aria-labelledby="season-schedule-title" className="mt-10">
      <SectionHead
        title="赛程（北京时间）"
        lead="主办方可直接修改本人赛季的赛程（含延长截止），不需要平台管理员批准；每次修改自动生成公告、审计与规则版本。已过去的截止不能再改；缩短的截止至少在公告发出 48 小时之后。"
        actions={actions}
      />

      <div className="overflow-x-auto">
        <table className="console-table">
          <caption className="sr-only">赛季赛程八个节点及到点后的行为</caption>
          <thead>
            <tr>
              <th scope="col">时间点</th>
              <th scope="col">时间</th>
              <th scope="col">到点后的行为</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                {/* 列头已声明三列语义，行首用 td + 加粗即可；不用 th，
                    因为 `.console-table th` 自带等宽大写小标样式，覆盖它需要
                    提高优先级，不值得为一张展示表加特例。 */}
                <td className="font-bold whitespace-nowrap text-foreground">{row.label}</td>
                <td className="font-mono text-meta whitespace-nowrap">
                  {row.at ? formatDateTime(row.at) : <span className="text-muted-foreground">待定</span>}
                </td>
                <td className="text-muted-foreground">{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 公告
// ---------------------------------------------------------------------------

/**
 * 「公告」：已发布公告的只读列表。发公告按钮由父级传入
 * （只有已批准且未取消的赛季才显示）。
 */
export function AnnouncementsSection({
  announcements,
  actions,
}: {
  announcements: SeasonAnnouncement[]
  actions?: React.ReactNode
}) {
  return (
    <section aria-labelledby="season-announcements-title" className="mt-10">
      <SectionHead
        title="公告"
        meta={`${announcements.length} 条`}
        actions={actions}
      />

      {announcements.length === 0 ? (
        <EmptyState title="还没有公告。" description="赛季批准后，赛程与规则的每次修改都会自动生成公告。" />
      ) : (
        <ul className="grid gap-3">
          {announcements.map((item) => (
            <li key={item.id} className="ui-card ui-card--static gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="sky" className="text-meta">
                  {announcementCategoryLabel(item.category)}
                </Chip>
                <h3 className="text-body-sm font-bold text-foreground">{item.title}</h3>
                <span className="ml-auto font-mono text-meta text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </span>
              </div>
              <p className="text-body-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {item.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// 页面级提示
// ---------------------------------------------------------------------------

/** 未选中具体赛季时的空态。 */
export function NoSeasonSelected() {
  return (
    <EmptyState
      title="SELECT A SEASON"
      description="在顶部的赛季选择器里选一个赛季，才能编辑它的设置。"
    />
  )
}

/** 无权限（403）：说明为什么看不到，并给出退回总览的入口。 */
export function SeasonForbidden({ action }: { action?: React.ReactNode }) {
  return (
    <EmptyState
      title="FORBIDDEN"
      description="你不是这个赛季的主办方，无法查看或修改它的设置。切换赛季或联系平台管理员。"
      action={action}
    />
  )
}

/** 读取失败（非 403）。 */
export function SeasonLoadFailed({ message }: { message?: string }) {
  return (
    <EmptyState
      title="LOAD FAILED"
      description={message || '读取赛季设置失败，请稍后刷新重试。'}
    />
  )
}

/** 页面顶部 eyebrow：本 tab 的身份说明。 */
export function SeasonSettingsHeader({ code }: { code: string }) {
  return (
    <div className="mb-6">
      <Eyebrow tone="accent">SEASON SETTINGS</Eyebrow>
      <p className="mt-2 font-mono text-meta text-muted-foreground">{code}</p>
    </div>
  )
}
