'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ProposalStatus } from '@shenicest/shared'
import { projectIdLabel } from '@/lib/utils'
import { PROPOSAL_STATUS_LABELS } from '@/lib/operator-filters'
import {
  approveProposal,
  rejectProposal,
  requireProposalRevision,
} from '@/lib/operator-api'
import { Button } from '@/components/ui/button'
import { Chip, type ChipTone } from '@/components/ui/chip'
import { Card } from '@/components/ui/surface'
import type { OperatorProposal, OperatorProject } from '@/server/operator'

/** 提案状态 → 标签色调（只映射语义，不写颜色）。 */
const PROPOSAL_STATUS_TONES: Record<number, ChipTone> = {
  [ProposalStatus.Pending]: 'warning',
  [ProposalStatus.Approved]: 'success',
  [ProposalStatus.Rejected]: 'neutral',
  [ProposalStatus.RevisionRequired]: 'warning',
}

/** 危险动作按钮的公共样式：ghost 骨架 + 危险语义色。 */
const DANGER_BTN = 'border-danger text-danger-text hover:border-danger hover:text-danger'

function ReviewDialog({
  title,
  confirmLabel,
  requiresReason,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string
  confirmLabel: string
  requiresReason: boolean
  onConfirm: (reason?: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6"
      >
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        {requiresReason ? (
          <div className="ui-field mt-4">
            <label htmlFor="review-reason" className="ui-label">
              REASON
            </label>
            <textarea
              id="review-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="请填写原因（将展示给创始人）"
              className="ui-textarea"
            />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConfirm(requiresReason ? reason : undefined)}
            disabled={loading || (requiresReason && !reason.trim())}
          >
            {loading ? '处理中...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DiffViewer({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes)
  if (entries.length === 0) {
    return <p className="mono">此提案没有变更内容</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([field, value]) => (
        <Card key={field} static className="p-4">
          <h4 className="eyebrow eyebrow--accent mb-2">{field.toUpperCase()}</h4>
          {typeof value === 'string' ? (
            <p className="text-body-sm leading-[1.7] whitespace-pre-wrap text-muted-foreground">
              {value}
            </p>
          ) : (
            <pre className="overflow-x-auto rounded-sm bg-muted p-3 font-mono text-meta text-muted-foreground">
              {JSON.stringify(value, null, 2)}
            </pre>
          )}
        </Card>
      ))}
    </div>
  )
}

export function OperatorProposalDetail({
  proposal,
  project,
}: {
  proposal: OperatorProposal
  project: OperatorProject | null
}) {
  const [dialog, setDialog] = useState<{
    type: 'approve' | 'reject' | 'revision'
  } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isPendingReview = proposal.status === ProposalStatus.Pending

  function handleAction(action: string, reason?: string) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      let result
      switch (action) {
        case 'approve':
          result = await approveProposal(proposal.id)
          break
        case 'reject':
          result = await rejectProposal(proposal.id, reason ?? '')
          break
        case 'revision':
          result = await requireProposalRevision(proposal.id, reason ?? '')
          break
      }
      if (result?.error) {
        setError(result.error.body.error.message)
      } else {
        setSuccess('操作成功')
        setDialog(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? <div className="ui-note ui-note--danger">{error}</div> : null}
      {success ? <div className="ui-note ui-note--success">{success}</div> : null}

      <Card static className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={PROPOSAL_STATUS_TONES[proposal.status] ?? 'neutral'} dot>
            {PROPOSAL_STATUS_LABELS[proposal.status] ?? '未知'}
          </Chip>
          {project ? (
            <Link
              href={`/operator/projects/${project.id}`}
              className="mono text-brand-text transition-colors hover:text-brand"
            >
              {projectIdLabel(project.id)} — {project.name}
            </Link>
          ) : (
            <span className="mono">{projectIdLabel(proposal.projectId)}</span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-2">
          <div>
            <dt className="mono">创建时间</dt>
            <dd className="mt-1">{new Date(proposal.createdAt).toLocaleString('zh-CN')}</dd>
          </div>
          {proposal.reviewedAt ? (
            <div>
              <dt className="mono">审核时间</dt>
              <dd className="mt-1">{new Date(proposal.reviewedAt).toLocaleString('zh-CN')}</dd>
            </div>
          ) : null}
        </dl>

        {proposal.reason ? (
          <div className="mt-4">
            <dt className="mono">创始人说明</dt>
            <dd className="mt-1 text-body-sm leading-[1.7] whitespace-pre-line text-muted-foreground">
              {proposal.reason}
            </dd>
          </div>
        ) : null}
      </Card>

      <section>
        <h3 className="mb-4 text-h3 font-bold">变更内容</h3>
        <DiffViewer changes={proposal.changes} />
      </section>

      {isPendingReview ? (
        <section className="rounded-xl border border-brand-line bg-brand-wash p-5">
          <h3 className="eyebrow eyebrow--accent mb-4">REVIEW ACTIONS</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setDialog({ type: 'approve' })}>通过</Button>
            <Button variant="ghost" onClick={() => setDialog({ type: 'revision' })}>
              要求修改
            </Button>
            <Button
              variant="ghost"
              className={DANGER_BTN}
              onClick={() => setDialog({ type: 'reject' })}
            >
              驳回
            </Button>
          </div>
        </section>
      ) : null}

      {dialog ? (
        <ReviewDialog
          title={
            dialog.type === 'approve' ? '确认通过此提案？'
            : dialog.type === 'revision' ? '要求修改提案'
            : '确认驳回此提案？'
          }
          confirmLabel={
            dialog.type === 'approve' ? '通过'
            : dialog.type === 'revision' ? '要求修改'
            : '驳回'
          }
          requiresReason={dialog.type === 'revision' || dialog.type === 'reject'}
          onConfirm={(reason) => handleAction(dialog.type, reason)}
          onCancel={() => setDialog(null)}
          loading={isPending}
        />
      ) : null}
    </div>
  )
}
