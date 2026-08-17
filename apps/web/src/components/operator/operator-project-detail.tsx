'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ProjectStatus } from '@shenicest/shared'
import { cn } from '@/lib/utils'
import { ProjectBadges } from '@/components/project-badges'
import { OPERATOR_STATUS_LABELS, OPERATOR_STATUS_COLORS, PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '@/lib/operator-filters'
import {
  approveProject,
  requireProjectRevision,
  rejectProject,
  delistProject,
  restoreProject,
} from '@/lib/operator-api'
import type { OperatorProject, OperatorProposal } from '@/server/operator'

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

export function OperatorProjectDetail({
  project,
  proposals,
}: {
  project: OperatorProject
  proposals: OperatorProposal[]
}) {
  const [dialog, setDialog] = useState<{
    type: 'approve' | 'revision' | 'reject' | 'delist' | 'restore'
  } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleAction(action: string, reason?: string) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      let result
      switch (action) {
        case 'approve':
          result = await approveProject(project.id)
          break
        case 'revision':
          result = await requireProjectRevision(project.id, reason ?? '')
          break
        case 'reject':
          result = await rejectProject(project.id, reason ?? '')
          break
        case 'delist':
          result = await delistProject(project.id, reason ?? '')
          break
        case 'restore':
          result = await restoreProject(project.id)
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

  const isPendingReview = project.status === ProjectStatus.PendingReview
  const isLive = project.status === ProjectStatus.Live
  const isDelisted = project.status === ProjectStatus.Delisted
  const demoImages = (project.demoImages ?? []).filter((src) => typeof src === 'string' && src.trim())

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
              OPERATOR_STATUS_COLORS[project.status] ?? 'bg-muted text-muted-foreground'
            )}
          >
            {OPERATOR_STATUS_LABELS[project.status] ?? '未知'}
          </span>
          <ProjectBadges stage={project.stage} categories={project.categories} />
        </div>

        {project.coverUrl ? (
          <div className="mt-5 overflow-hidden border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.coverUrl}
              alt={`${project.name}封面`}
              className="aspect-video w-full object-cover"
            />
          </div>
        ) : null}

        {project.tagline ? (
          <p className="mt-4 text-lg text-muted-foreground">{project.tagline}</p>
        ) : null}

        {project.description ? (
          <div className="mt-4">
            <h3 className="font-mono text-[10px] tracking-[0.12em] text-primary">DESCRIPTION</h3>
            <p className="mt-2 max-w-[65ch] text-sm leading-[1.7] text-muted-foreground whitespace-pre-line">
              {project.description}
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {project.targetUsers ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">目标用户</dt>
              <dd className="mt-1">{project.targetUsers}</dd>
            </div>
          ) : null}
          {project.userProblem ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">解决的问题</dt>
              <dd className="mt-1">{project.userProblem}</dd>
            </div>
          ) : null}
          {project.progress ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">当前进展</dt>
              <dd className="mt-1">{project.progress}</dd>
            </div>
          ) : null}
          {project.nextSteps ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">下一步计划</dt>
              <dd className="mt-1">{project.nextSteps}</dd>
            </div>
          ) : null}
          {project.messageToUsers ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">想对用户说的话</dt>
              <dd className="mt-1 whitespace-pre-line">{project.messageToUsers}</dd>
            </div>
          ) : null}
          {project.isOpenForBeta !== null ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">内测状态</dt>
              <dd className="mt-1">{project.isOpenForBeta ? '正在开放内测' : '暂未开放内测'}</dd>
            </div>
          ) : null}
          {project.betaDescription ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">内测说明</dt>
              <dd className="mt-1 whitespace-pre-line">{project.betaDescription}</dd>
            </div>
          ) : null}
        </div>

        {project.demoLink || project.demoVideoUrl || demoImages.length > 0 ? (
          <section className="mt-6 border border-border p-4">
            <h3 className="font-mono text-[10px] tracking-[0.12em] text-primary">DEMO MATERIALS</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.demoLink ? (
                <a href={project.demoLink} target="_blank" rel="noopener noreferrer" className="btn-hard btn-secondary px-3 py-2 text-xs">
                  访问产品链接
                </a>
              ) : null}
              {project.demoVideoUrl ? (
                <a href={project.demoVideoUrl} target="_blank" rel="noopener noreferrer" className="btn-hard btn-secondary px-3 py-2 text-xs">
                  观看演示视频
                </a>
              ) : null}
            </div>
            {demoImages.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {demoImages.map((src, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt={`${project.name}演示图 ${index + 1}`}
                    className="aspect-video w-full border border-border bg-muted object-cover"
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {project.contactName ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">联系人</dt>
              <dd className="mt-1">{project.contactName}</dd>
            </div>
          ) : null}
          {project.contactEmail ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">邮箱</dt>
              <dd className="mt-1">{project.contactEmail}</dd>
            </div>
          ) : null}
          {project.contactPhone ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">电话</dt>
              <dd className="mt-1">{project.contactPhone}</dd>
            </div>
          ) : null}
          {project.contactWechat ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">微信</dt>
              <dd className="mt-1">{project.contactWechat}</dd>
            </div>
          ) : null}
          {project.teamName ? (
            <div>
              <dt className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">团队</dt>
              <dd className="mt-1">{project.teamName}</dd>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="btn-hard btn-secondary px-4 py-2 text-xs"
          >
            查看公开页面
          </Link>
        </div>
      </section>

      {(isPendingReview || isLive || isDelisted) ? (
        <section className="border-2 border-primary p-5">
          <h3 className="mb-4 font-mono text-xs tracking-[0.12em] text-primary">
            REVIEW ACTIONS
          </h3>
          <div className="flex flex-wrap gap-3">
            {isPendingReview ? (
              <>
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
              </>
            ) : null}
            {isLive ? (
              <button
                type="button"
                onClick={() => setDialog({ type: 'delist' })}
                className="btn-hard px-4 py-2 text-xs"
                style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
              >
                下架
              </button>
            ) : null}
            {isDelisted ? (
              <button
                type="button"
                onClick={() => setDialog({ type: 'restore' })}
                className="btn-hard btn-primary px-4 py-2 text-xs"
              >
                恢复上架
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {proposals.length > 0 ? (
        <section>
          <h3 className="mb-4 text-xl font-bold">编辑提案记录</h3>
          <div className="space-y-3">
            {proposals.map((proposal) => (
              <Link
                key={proposal.id}
                href={`/operator/proposals/${proposal.id}`}
                className="block border border-border bg-card p-4 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-primary">
                    #{proposal.id}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-1 font-mono text-[10px] tracking-[0.08em]',
                      PROPOSAL_STATUS_COLORS[proposal.status] ?? 'bg-muted text-muted-foreground'
                    )}
                  >
                    {PROPOSAL_STATUS_LABELS[proposal.status] ?? '未知'}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {new Date(proposal.createdAt).toLocaleString('zh-CN')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {dialog ? (
        <ReviewDialog
          title={
            dialog.type === 'approve' ? '确认通过此项目？'
            : dialog.type === 'revision' ? '要求修改'
            : dialog.type === 'reject' ? '确认驳回此项目？'
            : dialog.type === 'delist' ? '确认下架此项目？'
            : '确认恢复上架？'
          }
          confirmLabel={
            dialog.type === 'approve' ? '通过'
            : dialog.type === 'revision' ? '要求修改'
            : dialog.type === 'reject' ? '驳回'
            : dialog.type === 'delist' ? '下架'
            : '恢复上架'
          }
          requiresReason={dialog.type === 'revision' || dialog.type === 'reject' || dialog.type === 'delist'}
          onConfirm={(reason) => handleAction(dialog.type, reason)}
          onCancel={() => setDialog(null)}
          loading={isPending}
        />
      ) : null}
    </div>
  )
}
