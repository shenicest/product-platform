'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ProjectStatus, ProposalStatus, skillLabel } from '@shenicest/shared'
import { tractionMetrics } from '@/lib/traction'
import { ProjectBadges } from '@/components/project-badges'
import { Button, ButtonAnchor, ButtonLink } from '@/components/ui/button'
import { Chip, type ChipTone } from '@/components/ui/chip'
import { Card } from '@/components/ui/surface'
import {
  OPERATOR_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
} from '@/lib/operator-filters'
import {
  approveProject,
  requireProjectRevision,
  rejectProject,
  delistProject,
  restoreProject,
} from '@/lib/operator-api'
import type { OperatorProject, OperatorProposal } from '@/server/operator'

/** 项目状态 → 标签色调（只映射语义，不写颜色）。 */
const PROJECT_STATUS_TONES: Record<number, ChipTone> = {
  [ProjectStatus.Draft]: 'neutral',
  [ProjectStatus.PendingReview]: 'warning',
  [ProjectStatus.RevisionRequired]: 'warning',
  [ProjectStatus.Live]: 'success',
  [ProjectStatus.Delisted]: 'danger',
  [ProjectStatus.Rejected]: 'neutral',
}

/** 提案状态 → 标签色调。 */
const PROPOSAL_STATUS_TONES: Record<number, ChipTone> = {
  [ProposalStatus.Pending]: 'warning',
  [ProposalStatus.Approved]: 'success',
  [ProposalStatus.Rejected]: 'neutral',
  [ProposalStatus.RevisionRequired]: 'warning',
}

/** 危险动作按钮：在 ghost 骨架上覆盖危险语义色（utilities 层高于 components 层）。 */
const DANGER_BTN =
  'border-danger text-danger-text hover:border-danger hover:text-danger-text'
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
  const traction = tractionMetrics(project)

  return (
    <div className="flex flex-col gap-8">
      {error ? <div className="ui-note ui-note--danger">{error}</div> : null}
      {success ? <div className="ui-note ui-note--success">{success}</div> : null}

      <Card static className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={PROJECT_STATUS_TONES[project.status] ?? 'neutral'} dot>
            {OPERATOR_STATUS_LABELS[project.status] ?? '未知'}
          </Chip>
          <ProjectBadges stage={project.stage} categories={project.categories} />
        </div>

        {project.coverUrl ? (
          <div className="card-cover card-cover--wide mt-5 rounded-md border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.coverUrl}
              alt={`${project.name}封面`}
              className="aspect-video w-full object-cover"
            />
          </div>
        ) : null}

        {project.tagline ? (
          <p className="mt-4 text-body-lg text-muted-foreground">{project.tagline}</p>
        ) : null}

        {project.problemStatement ? (
          <div className="mt-4">
            <h3 className="eyebrow eyebrow--accent">PROBLEM STATEMENT</h3>
            <p className="mt-2 max-w-[65ch] text-body-sm leading-[1.7] whitespace-pre-line text-muted-foreground">
              {project.problemStatement}
            </p>
          </div>
        ) : null}

        {traction.length ? (
          <div className="detail-metrics mt-6">
            {traction.map((metric) => (
              <div key={metric.label}>
                <div className="detail-metric__label">{metric.label}</div>
                <div className="detail-metric__value">{metric.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        <dl className="mt-6 grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-2">
          {project.progress ? (
            <div>
              <dt className="mono">当前进展</dt>
              <dd className="mt-1">{project.progress}</dd>
            </div>
          ) : null}
          {project.nextSteps ? (
            <div>
              <dt className="mono">下一步计划</dt>
              <dd className="mt-1">{project.nextSteps}</dd>
            </div>
          ) : null}
          {project.differentiation ? (
            <div>
              <dt className="mono">差异化优势</dt>
              <dd className="mt-1">{project.differentiation}</dd>
            </div>
          ) : null}
          {project.businessModel ? (
            <div>
              <dt className="mono">商业模式</dt>
              <dd className="mt-1">{project.businessModel}</dd>
            </div>
          ) : null}
          {project.seekingSkills?.length ? (
            <div>
              <dt className="mono">寻求帮助</dt>
              <dd className="mt-1">
                {project.seekingSkills.map((skill) => skillLabel(skill)).join('、')}
              </dd>
            </div>
          ) : null}
          {project.isOpenForBeta !== null ? (
            <div>
              <dt className="mono">内测状态</dt>
              <dd className="mt-1">{project.isOpenForBeta ? '正在开放内测' : '暂未开放内测'}</dd>
            </div>
          ) : null}
          {project.betaDescription ? (
            <div>
              <dt className="mono">内测说明</dt>
              <dd className="mt-1 whitespace-pre-line">{project.betaDescription}</dd>
            </div>
          ) : null}
        </dl>

        {project.demoLink || project.demoVideoUrl || demoImages.length > 0 ? (
          <section className="mt-6 rounded-md border border-border p-4">
            <h3 className="eyebrow eyebrow--accent">DEMO MATERIALS</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.demoLink ? (
                <ButtonAnchor
                  href={project.demoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                >
                  访问产品链接
                </ButtonAnchor>
              ) : null}
              {project.demoVideoUrl ? (
                <ButtonAnchor
                  href={project.demoVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                >
                  观看演示视频
                </ButtonAnchor>
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
                    className="aspect-video w-full rounded-md border border-border bg-muted object-cover"
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <dl className="mt-6 grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-2">
          {project.contactName ? (
            <div>
              <dt className="mono">联系人</dt>
              <dd className="mt-1">{project.contactName}</dd>
            </div>
          ) : null}
          {project.contactEmail ? (
            <div>
              <dt className="mono">邮箱</dt>
              <dd className="mt-1">{project.contactEmail}</dd>
            </div>
          ) : null}
          {project.contactPhone ? (
            <div>
              <dt className="mono">电话</dt>
              <dd className="mt-1">{project.contactPhone}</dd>
            </div>
          ) : null}
          {project.contactWechat ? (
            <div>
              <dt className="mono">微信</dt>
              <dd className="mt-1">{project.contactWechat}</dd>
            </div>
          ) : null}
          {project.teamName ? (
            <div>
              <dt className="mono">团队</dt>
              <dd className="mt-1">{project.teamName}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/projects/${project.id}`} variant="secondary" size="sm">
            查看公开页面
          </ButtonLink>
        </div>
      </Card>

      {isPendingReview || isLive || isDelisted ? (
        <section className="rounded-xl border border-brand-line bg-brand-wash p-5">
          <h3 className="eyebrow eyebrow--accent mb-4">REVIEW ACTIONS</h3>
          <div className="flex flex-wrap gap-3">
            {isPendingReview ? (
              <>
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
              </>
            ) : null}
            {isLive ? (
              <Button
                variant="ghost"
                className={DANGER_BTN}
                onClick={() => setDialog({ type: 'delist' })}
              >
                下架
              </Button>
            ) : null}
            {isDelisted ? (
              <Button onClick={() => setDialog({ type: 'restore' })}>恢复上架</Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {proposals.length > 0 ? (
        <section>
          <h3 className="mb-4 text-h3 font-bold">编辑提案记录</h3>
          <div className="flex flex-col gap-2">
            {proposals.map((proposal) => (
              <Card key={proposal.id} className="group">
                <Link
                  href={`/operator/proposals/${proposal.id}`}
                  className="flex flex-col gap-2 p-4 outline-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="card-id">#{proposal.id}</span>
                    <Chip tone={PROPOSAL_STATUS_TONES[proposal.status] ?? 'neutral'} dot>
                      {PROPOSAL_STATUS_LABELS[proposal.status] ?? '未知'}
                    </Chip>
                  </div>
                  <p className="mono">{new Date(proposal.createdAt).toLocaleString('zh-CN')}</p>
                </Link>
              </Card>
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
