'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { FieldError, FormField, TextArea } from '@/components/submit/form-fields'
import { cn } from '@/lib/utils'
import { ApplicationStatsRow, ApplicationTable } from '@/components/organizer/applications/applications-display'
import { ReviewActionIcon } from '@/components/organizer/applications/review-action-icon'
import {
  applicationReviewActions,
  isReviewable,
  reviewFilterDescription,
  reviewOutcomeMessage,
  reviewStatusMeta,
  submissionStamp,
  teamIntentLabel,
  type ApplicationApplicant,
  type ApplicationAuditEntry,
  type ApplicationDetail,
  type ApplicationListItem,
  type ApplicationReviewStats,
  type ApplicationReviewTarget,
  type ReviewAction,
} from '@/lib/organizer-applications'
import { getApplicationAuditTrail, getApplicationDetail, updateApplicationStatus } from '@/lib/organizer-api'

/**
 * 报名审核 tab 的客户端视图。
 *
 * 服务端页面负责取首屏队列与统计，这里只做交互：
 *   · 行内四个审核动作（通过 / 待定 / 候补 / 不通过）；
 *   · 不通过必须填原因（后端同样强制，前端提前拦）；
 *   · 点行打开详情抽屉，现取完整联系方式与审核历史。
 *
 * 一条贯穿全文的规则：**每次写操作成功后都 `router.refresh()`**，让服务端
 * 重新算「已通过 / 名额」与候补数；失败一律把后端 `error.message` 摆到
 * `role="alert"` 里，不吞错误。
 */
export function ApplicationReviewView({
  seasonId,
  items,
  stats,
  statusFilter,
  actionsLocked,
}: {
  seasonId: number
  items: ApplicationListItem[]
  stats: ApplicationReviewStats
  /** 当前筛选值（`all` 表示全部），用于提示与空状态文案。 */
  statusFilter: string
  /** 赛季已取消时整列动作禁用（后端会拒，但别让用户白点）。 */
  actionsLocked: boolean
}) {
  const router = useRouter()

  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reasonDialog, setReasonDialog] = useState<{
    application: ApplicationListItem
    target: ApplicationReviewTarget
  } | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)

  const busy = pendingAction !== null

  /**
   * 统一的审核执行器。
   *
   * `key` 只禁用被点的那一行的那一个按钮：整列一起禁用会让「刚点完通过、
   * 还想给下一条点待定」变成两次等待。
   */
  const runReview = useCallback(
    async (
      application: ApplicationListItem,
      target: ApplicationReviewTarget,
      reason?: string,
    ): Promise<boolean> => {
      setActionError(null)
      setNotice(null)
      setPendingAction(`${application.id}:${target}`)
      const { data, error } = await updateApplicationStatus(application.id, {
        status: target,
        ...(reason ? { reason } : {}),
      })
      setPendingAction(null)
      if (error || !data) {
        setActionError(error?.body.error.message || '审核失败，请稍后重试')
        return false
      }
      // 后端可能把 `accepted` 降级成 `waitlisted`（名额满），所以反馈文案
      // 必须用响应里的**实际状态**，不能拿请求的目标状态去拼。
      setNotice(reviewOutcomeMessage(target, data.status ?? target))
      router.refresh()
      return true
    },
    [router],
  )

  /** 拒绝要先填原因，其余动作直接发请求。 */
  const requestAction = useCallback(
    (application: ApplicationListItem, target: ApplicationReviewTarget) => {
      if (target === 'rejected') {
        setReasonDialog({ application, target })
        return
      }
      void runReview(application, target)
    },
    [runReview],
  )

  const detailItem = detailId === null
    ? null
    : items.find((item) => item.id === detailId) ?? null

  return (
    <div className="grid gap-6">
      <ApplicationStatsRow stats={stats} />

      <p className="ui-hint">
        个人报名，不要求项目与正式命题。人工审核通过后才获得赛季标识和项目上传权限；报名截止后仍可审核。
        {statusFilter === 'submitted'
          ? '当前只看「待处理」，切换到「全部报名」可以复查历史。'
          : null}
      </p>

      {actionsLocked ? (
        <p className="ui-note ui-note--danger">
          赛季已取消，报名不可再审核；下方保留历史记录供查阅。
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="ui-field-error">
          {actionError}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="ui-note ui-note--success">
          {notice}
        </p>
      ) : null}

      <section aria-labelledby="application-queue-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="application-queue-title" className="text-h3 font-bold text-foreground">
              报名队列
            </h2>
            <p className="mt-2 text-body-sm text-muted-foreground">
              共 {items.length} 条 · 点击任意一行查看完整报名材料与审核历史
            </p>
          </div>
          <span className="font-mono text-meta text-muted-foreground">
            当前筛选：{reviewFilterDescription(statusFilter)}
          </span>
        </div>

        <div className="ui-panel ui-panel--flush">
          <ApplicationTable
            items={items}
            onSelect={(application) => setDetailId(application.id)}
            renderActions={(application) => (
              <ReviewActions
                application={application}
                disabled={actionsLocked || busy}
                pendingAction={pendingAction}
                onAction={(target) => requestAction(application, target)}
              />
            )}
          />
        </div>
      </section>

      {reasonDialog ? (
        <ReasonDialog
          title={`不通过 · ${reasonDialog.application.applicant.name ?? reasonDialog.application.userId}`}
          description="拒绝报名必须填写原因，会写进审计并展示在报名者的「我的报名」里。"
          submitLabel="确认不通过"
          onCancel={() => setReasonDialog(null)}
          onSubmit={async (reason) => {
            const ok = await runReview(reasonDialog.application, reasonDialog.target, reason)
            if (ok) setReasonDialog(null)
            return ok
          }}
        />
      ) : null}

      {detailItem ? (
        // `key` 带上状态：切换报名时重挂载，`loading` / `error` / 已取到的明文
        // 联系方式都随之清空；审核成功后状态变了也重挂载，抽屉里重新取一遍
        // 详情与审核历史 —— 否则会停在审核前的旧状态上。
        <ApplicationDetailDrawer
          key={`${detailItem.id}:${detailItem.status}`}
          seasonId={seasonId}
          application={detailItem}
          disabled={actionsLocked || busy}
          onClose={() => setDetailId(null)}
          onAction={(target) => requestAction(detailItem, target)}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 行内动作
// ---------------------------------------------------------------------------

/**
 * 一行内的审核动作。
 *
 * 动作集合来自 `applicationReviewActions`（纯函数、可单测），这里只负责
 * 摆位置与禁用态：`accepted` / `withdrawn` 没有动作，显示终态说明。
 *
 * 入参只要「id + 状态 + 报名者」—— 列表行和详情抽屉里的报名是同一条记录
 * 的两种形状（一个有 `contactMasked`、一个有 `contact`），不该为此拆两个组件。
 *
 * **为什么是图标**：操作列是表格里最窄的一列，四个中文按钮并排至少 260px，
 * 会把「技能与经历」这类本该最宽的内容列挤到一行只放得下几个字。图标按钮
 * 每个 32px，四个一行 140px 就够，表格的 auto layout 也不会再把它压扁。
 * 语义不丢：每个按钮都有 `aria-label`（含动作名和报名者）与原生 `title`，
 * 键盘用户和读屏用户拿到的是完整文字，鼠标悬停也有 tooltip。
 */
function ReviewActions({
  application,
  disabled,
  pendingAction,
  onAction,
}: {
  application: { id: number; userId: string; status: string; applicant: ApplicationApplicant }
  disabled: boolean
  pendingAction: string | null
  onAction: (target: ApplicationReviewTarget) => void
}) {
  const actions = applicationReviewActions(application.status)
  if (actions.length === 0) {
    return <span className="text-meta text-muted-foreground">已是终态</span>
  }

  return (
    <span className="flex items-center gap-1.5">
      {actions.map((action) => {
        const pending = pendingAction === `${application.id}:${action.target}`
        const applicantName = application.applicant.name ?? application.userId
        return (
          <button
            key={action.target}
            type="button"
            className={cn('ui-icon-btn ui-icon-btn--sm', ICON_TONE[action.tone])}
            disabled={disabled}
            aria-label={`${action.label} ${applicantName}`}
            title={pending ? `${action.label}中…` : action.label}
            onClick={() => onAction(action.target)}
          >
            {pending ? <span aria-hidden className="text-meta">…</span> : <ReviewActionIcon target={action.target} />}
          </button>
        )
      })}
    </span>
  )
}

/** 动作色调 → 图标按钮变体类。 */
const ICON_TONE: Record<ReviewAction['tone'], string> = {
  'brand-solid': 'ui-icon-btn--brand-solid',
  warning: 'ui-icon-btn--warning',
  danger: 'ui-icon-btn--danger',
}

// ---------------------------------------------------------------------------
// 详情抽屉
// ---------------------------------------------------------------------------

/**
 * 详情抽屉：现取明文联系方式 + 审核历史。
 *
 * 列表里的联系方式是掩码，明文只在抽屉打开时通过 `GET /applications/:id` 取，
 * 且只活在这个组件的 state 里 —— 不进 URL、不进 localStorage、不打印。
 */
function ApplicationDetailDrawer({
  seasonId,
  application,
  disabled,
  onClose,
  onAction,
}: {
  seasonId: number
  application: ApplicationListItem
  disabled: boolean
  onClose: () => void
  onAction: (target: ApplicationReviewTarget) => void
}) {
  const uid = useId()
  const titleId = `${uid}-title`
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [detail, setDetail] = useState<ApplicationDetail | null>(null)
  const [audit, setAudit] = useState<ApplicationAuditEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 抽屉打开时把焦点移进面板，Esc 关闭。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      getApplicationDetail(application.id),
      getApplicationAuditTrail(seasonId, application.id),
    ]).then(([detailResult, auditResult]) => {
      if (cancelled) return
      setLoading(false)
      if (detailResult.error || !detailResult.data) {
        setError(detailResult.error?.body.error.message || '读取报名详情失败')
        return
      }
      setDetail(detailResult.data)
      setAudit(auditResult.data?.items ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [application.id, seasonId])

  const current = detail ?? application
  const status = reviewStatusMeta(current.status)
  const stamp = submissionStamp(current.createdAt)
  const reviewable = isReviewable(current.status)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="ui-panel my-8 w-full max-w-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-h3 font-bold text-foreground">
              {current.applicant.name ?? current.userId}
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
              <Chip tone={status.tone} dot>
                {status.label}
              </Chip>
              <span className="font-mono text-meta">
                {stamp.date} {stamp.time}
              </span>
              <span className="font-mono text-meta">{current.userId}</span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn--ghost ui-btn--small"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <FieldError>{error}</FieldError>

        {loading ? (
          <p className="ui-hint" aria-live="polite">
            正在读取完整报名材料…
          </p>
        ) : detail ? (
          <DetailBody detail={detail} audit={audit} />
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
          {reviewable && !disabled ? (
            <ReviewActions
              application={current}
              disabled={false}
              pendingAction={null}
              onAction={onAction}
            />
          ) : (
            <span className="text-meta text-muted-foreground">
              {reviewable ? '赛季已取消，不可审核。' : '该报名已是终态，不可再变更。'}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            返回队列
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 详情主体：报名材料 + 审核历史。 */
function DetailBody({
  detail,
  audit,
}: {
  detail: ApplicationDetail
  audit: ApplicationAuditEntry[]
}) {
  const contact = detail.contact
  const contactText = [
    contact?.wechat ? `微信 ${contact.wechat}` : null,
    contact?.phone ? `手机 ${contact.phone}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="grid gap-5">
      <dl className="grid gap-0">
        <DetailRow label="联系方式">
          <span className="font-mono text-meta">{contactText || '—'}</span>
        </DetailRow>
        <DetailRow label="技能">{detail.skills}</DetailRow>
        <DetailRow label="经历">
          <span className="whitespace-pre-wrap">{detail.experience}</span>
        </DetailRow>
        <DetailRow label="兴趣主题">
          {detail.themes.length > 0 ? detail.themes.join('、') : '未选择方向'}
        </DetailRow>
        <DetailRow label="组队意向">
          <span className="block font-bold">{teamIntentLabel(detail.acceptsSolo)}</span>
          <span className="mt-1 block whitespace-pre-wrap text-muted-foreground">
            {detail.teamIntent}
          </span>
        </DetailRow>
        <DetailRow label="可投入时间">{detail.availability}</DetailRow>
        <DetailRow label="城市模式">{detail.cityMode}</DetailRow>
        <DetailRow label="可见范围">
          {detail.visibility === 'public' ? '公开' : '仅主办方'}
        </DetailRow>
        <DetailRow label="协议版本">
          <span className="font-mono text-meta">{detail.agreementVersion}</span>
        </DetailRow>
        {detail.reviewReason ? <DetailRow label="审核备注">{detail.reviewReason}</DetailRow> : null}
      </dl>

      <section aria-labelledby="application-audit-title">
        <h3 id="application-audit-title" className="text-body-sm font-bold text-foreground">
          审核历史
        </h3>
        {audit.length === 0 ? (
          <p className="ui-hint mt-2">还没有审核记录。</p>
        ) : (
          <ol className="mt-3 grid gap-2">
            {audit.map((entry) => {
              const stamp = submissionStamp(entry.createdAt)
              const note = auditDetailNote(entry.detail)
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-2 border-b border-border-soft pb-2 text-body-sm last:border-b-0"
                >
                  <span className="font-mono text-meta text-muted-foreground">
                    {stamp.date} {stamp.time}
                  </span>
                  <span className="font-bold text-foreground">
                    {entry.actorName ?? entry.actorUserId}
                  </span>
                  <span className="text-muted-foreground">{auditActionLabel(entry.action)}</span>
                  {note ? <span className="text-meta text-muted-foreground">{note}</span> : null}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 border-b border-border-soft py-3 last:border-b-0">
      <dt className="text-body-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body-sm text-foreground">{children}</dd>
    </div>
  )
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'application.submitted': '提交报名',
  'application.withdrawn': '撤回报名',
  'application.status_changed': '审核变更',
  'application.promoted': '候补递补',
}

function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

/** 从审计 detail 里抽出「A → B（原因）」这种一句话摘要。 */
function auditDetailNote(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object') return null
  const record = detail as { from?: unknown; to?: unknown; reason?: unknown }
  const parts: string[] = []
  if (typeof record.from === 'string' && typeof record.to === 'string') {
    parts.push(`${reviewStatusMeta(record.from).label} → ${reviewStatusMeta(record.to).label}`)
  }
  if (typeof record.reason === 'string' && record.reason.trim()) {
    parts.push(`原因：${record.reason}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

// ---------------------------------------------------------------------------
// 填原因弹窗
// ---------------------------------------------------------------------------

/** 与赛季设置 tab 同款的弹窗外壳：遮罩 + ui-panel + Esc 关闭。 */
function ReasonDialog({
  title,
  description,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  title: string
  description: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (reason: string) => Promise<boolean>
}) {
  const uid = useId()
  const titleId = `${uid}-title`
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  async function onSubmitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const trimmed = reason.trim()
    if (trimmed.length < 2) {
      setError('请填写至少 2 个字符的原因')
      return
    }
    setPending(true)
    const ok = await onSubmit(trimmed)
    setPending(false)
    if (!ok) setError('操作失败，请查看页面上的错误提示')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="ui-panel my-8 w-full max-w-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-h3 font-bold text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-body-sm text-muted-foreground">{description}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            className="ui-btn ui-btn--ghost ui-btn--small"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <form onSubmit={onSubmitForm} className="grid gap-4" noValidate aria-label={title}>
          <FormField
            label="原因"
            htmlFor={`${uid}-reason`}
            required
            hint="至少 2 个字符，会写进审计并展示给报名者"
            error={error ?? undefined}
          >
            <TextArea
              id={`${uid}-reason`}
              name="reason"
              value={reason}
              onChange={setReason}
              rows={3}
              maxLength={2000}
            />
          </FormField>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? '处理中…' : submitLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
