'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { approveSeason, rejectSeason } from '@/lib/platform-console-api'
import { approveBlocker } from '@/lib/platform-console'
import { PlatformDialog } from '../dialog'

type ReviewableSeason = {
  id: number
  name: string
  status: string
  approvedAt: string | null
  readinessReady: boolean
}

/**
 * 待批赛季的「批准 / 驳回」动作（仅平台管理员渲染）。
 *
 * 交互约定：
 *   · 批准是不可逆的公开动作 —— 点下即生效，成功后刷新列表（该赛季从待批队列消失）；
 *   · 驳回必须填原因（≥2 字）—— 原因会写进赛季记录，主办方据此修改后重新提交；
 *   · 按钮禁用时把原因放在 `title` 与 `aria-describedby` 上，而不是让人点一下
 *     再吃一个 409。
 *
 * 错误文案一律原样展示后端 `error.message`：`SEASON_NOT_READY` 会带出具体缺哪几项，
 * 改写成「操作失败」等于把最有用的信息丢掉。
 */
export function SeasonReviewActions({
  season,
  isOperator,
  compact = false,
}: {
  season: ReviewableSeason
  isOperator: boolean
  compact?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)

  // 非管理员不渲染任何写操作：他们进得来，但批准 / 驳回不在主办方权限里。
  if (!isOperator) return null

  const blocker = approveBlocker(season, isOperator)
  const size = compact ? 'sm' : 'md'

  async function handleApprove() {
    setBusy('approve')
    setError(null)
    setNotice(null)
    const { error: apiError } = await approveSeason(season.id)
    setBusy(null)
    if (apiError) {
      setError(apiError.body.error.message || '批准失败，请稍后重试')
      return
    }
    setNotice('已批准，该赛季现在对公开列表可见。')
    router.refresh()
  }

  async function handleReject() {
    const trimmed = reason.trim()
    if (trimmed.length < 2) {
      setReasonError('驳回原因至少 2 个字')
      return
    }
    setBusy('reject')
    setReasonError(null)
    const { error: apiError } = await rejectSeason(season.id, trimmed)
    setBusy(null)
    if (apiError) {
      setReasonError(apiError.body.error.message || '驳回失败，请稍后重试')
      return
    }
    setRejectOpen(false)
    setReason('')
    setNotice('已驳回并退回草稿，原因已记录。')
    router.refresh()
  }

  const hintId = `approve-blocker-${season.id}`

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size={size}
          onClick={handleApprove}
          disabled={Boolean(blocker) || busy !== null}
          title={blocker ?? undefined}
          aria-describedby={blocker ? hintId : undefined}
        >
          {busy === 'approve' ? '批准中…' : '批准'}
        </Button>
        <Button
          size={size}
          variant="secondary"
          onClick={() => {
            setRejectOpen(true)
            setReasonError(null)
          }}
          disabled={busy !== null}
        >
          驳回
        </Button>
      </div>

      {blocker ? (
        <p id={hintId} className="ui-hint">
          {blocker}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="ui-field-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="ui-hint text-success-text">
          {notice}
        </p>
      ) : null}

      {rejectOpen ? (
        <PlatformDialog
          title="驳回待批赛季"
          description={`「${season.name}」会被退回草稿，并清空批准记录。原因会写进赛季记录，主办方据此修改后重新提交。`}
          onCancel={() => {
            if (busy === 'reject') return
            setRejectOpen(false)
            setReasonError(null)
          }}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setRejectOpen(false)
                  setReasonError(null)
                }}
                disabled={busy === 'reject'}
              >
                取消
              </Button>
              <Button onClick={handleReject} disabled={busy === 'reject'}>
                {busy === 'reject' ? '驳回中…' : '确认驳回'}
              </Button>
            </>
          }
        >
          <label className="ui-label" htmlFor={`reject-reason-${season.id}`}>
            驳回原因
          </label>
          <textarea
            id={`reject-reason-${season.id}`}
            className="ui-textarea mt-2"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="写清需要主办方改什么，例如：赛程的报名截止晚于开赛时间，请调整后重新提交。"
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? `reject-reason-error-${season.id}` : undefined}
          />
          {reasonError ? (
            <p id={`reject-reason-error-${season.id}`} role="alert" className="ui-field-error mt-2">
              {reasonError}
            </p>
          ) : (
            <p className="ui-hint mt-2">至少 2 个字。驳回不会删除赛季，只把它退回草稿。</p>
          )}
        </PlatformDialog>
      ) : null}
    </div>
  )
}
