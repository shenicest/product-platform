'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ProposalStatus } from '@shenicest/shared'
import { cn, projectIdLabel } from '@/lib/utils'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '@/lib/operator-filters'
import {
  approveProposal,
  rejectProposal,
  requireProposalRevision,
} from '@/lib/operator-api'
import type { OperatorProposal, OperatorProject } from '@/server/operator'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md border-2 border-primary bg-card p-6">
        <h3 className="text-lg font-bold">{title}</h3>
        {requiresReason ? (
          <div className="mt-4">
            <label className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
              REASON
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="请填写原因（将展示给创始人）"
              className="mt-2 w-full border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-hard btn-ghost px-4 py-2 text-xs"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(requiresReason ? reason : undefined)}
            disabled={loading || (requiresReason && !reason.trim())}
            className="btn-hard btn-primary px-4 py-2 text-xs"
          >
            {loading ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function DiffViewer({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes)
  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        此提案没有变更内容
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {entries.map(([field, value]) => (
        <div key={field} className="border border-border bg-card p-4">
          <h4 className="mb-2 font-mono text-[10px] tracking-[0.12em] text-primary">
            {field.toUpperCase()}
          </h4>
          {typeof value === 'string' ? (
            <p className="whitespace-pre-wrap text-sm leading-[1.7] text-muted-foreground">
              {value}
            </p>
          ) : Array.isArray(value) ? (
            <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">
              {JSON.stringify(value, null, 2)}
            </pre>
          )}
        </div>
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
    <div className="space-y-8">
      {error ? (
        <div className="border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-600">
          {success}
        </div>
      ) : null}

      <section className="border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center px-3 py-1.5 font-mono text-xs tracking-[0.08em]',
              PROPOSAL_STATUS_COLORS[proposal.status] ?? 'bg-muted text-muted-foreground'
            )}
          >
            {PROPOSAL_STATUS_LABELS[proposal.status] ?? '未知'}
          </span>
          {project ? (
            <Link
              href={`/operator/projects/${project.id}`}
              className="font-mono text-xs text-primary transition-colors hover:text-primary/80"
            >
              {projectIdLabel(project.id)} — {project.name}
            </Link>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">
              {projectIdLabel(proposal.projectId)}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">创建时间</dt>
            <dd className="mt-1">{new Date(proposal.createdAt).toLocaleString('zh-CN')}</dd>
          </div>
          {proposal.reviewedAt ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">审核时间</dt>
              <dd className="mt-1">{new Date(proposal.reviewedAt).toLocaleString('zh-CN')}</dd>
            </div>
          ) : null}
        </div>

        {proposal.reason ? (
          <div className="mt-4">
            <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">创始人说明</dt>
            <dd className="mt-1 text-sm leading-[1.7] text-muted-foreground whitespace-pre-line">
              {proposal.reason}
            </dd>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-4 text-xl font-bold">变更内容</h3>
        <DiffViewer changes={proposal.changes} />
      </section>

      {isPendingReview ? (
        <section className="border-2 border-primary p-5">
          <h3 className="mb-4 font-mono text-xs tracking-[0.12em] text-primary">
            REVIEW ACTIONS
          </h3>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDialog({ type: 'approve' })}
              className="btn-hard btn-primary px-4 py-2 text-xs"
            >
              通过
            </button>
            <button
              type="button"
              onClick={() => setDialog({ type: 'revision' })}
              className="btn-hard btn-ghost px-4 py-2 text-xs"
            >
              要求修改
            </button>
            <button
              type="button"
              onClick={() => setDialog({ type: 'reject' })}
              className="btn-hard px-4 py-2 text-xs"
              style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
            >
              驳回
            </button>
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
