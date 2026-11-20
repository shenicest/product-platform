'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { FormField, TextArea } from '@/components/submit/form-fields'
import { WORKSPACE_SEASON } from '@/lib/season-workspace'
import {
  auditEntry,
  recomputeWorkScore,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'
import {
  verificationKindLabel,
  verificationStatusMeta,
  type OrganizerVerificationItem,
} from '@/lib/season-organizer-demo'

const KIND_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'large-review', label: '大额复核' },
  { value: 'evidence', label: '证据核验' },
  { value: 'dispute', label: '异议' },
] as const

/**
 * 主办方「核验与异议」。
 *
 * 大额复核与评委台共用同一份 store：评委提交 ≥ 阈值分数后，这里出现待复核项；
 * 通过后评分转为有效，驳回则把评分标记为已冲正并退回该评委的已用额度。
 * 证据核验与异议同理，处理结论会写进审计。
 */
export function VerificationConsole() {
  const demo = useDemoState()
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]['value']>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const pending = demo.verifications.filter((item) => item.status === 'pending')
  const processed = demo.verifications.filter((item) => item.status !== 'pending')
  const filteredPending = pending.filter((item) => kind === 'all' || item.kind === kind)
  const selected = pending.find((item) => item.id === selectedId) ?? null

  const metrics = {
    largeReview: pending.filter((item) => item.kind === 'large-review').length,
    evidence: pending.filter((item) => item.kind === 'evidence').length,
    dispute: pending.filter((item) => item.kind === 'dispute').length,
    processed: processed.length,
  }

  const pendingDrafts = demo.enterpriseDrafts.filter((item) => item.status === 'draft')
  const pendingRecommendations = demo.judgeRecommendations.filter(
    (item) => item.status === 'pending',
  )

  const publishDraft = (draftId: string) => {
    const target = demo.enterpriseDrafts.find((item) => item.id === draftId)
    if (!target) return
    setDemoState((current) => ({
      ...current,
      enterpriseDrafts: current.enterpriseDrafts.map((item) =>
        item.id === draftId ? { ...item, status: 'published' } : item,
      ),
      audit: [
        auditEntry(
          'challenge.published',
          target.title,
          '主办方发布企业命题草稿',
        ),
        ...current.audit,
      ],
    }))
    setNotice(`已发布命题《${target.title}》。`)
  }

  const decideRecommendation = (recommendationId: string, accepted: boolean) => {
    const target = demo.judgeRecommendations.find((item) => item.id === recommendationId)
    if (!target) return
    setDemoState((current) => ({
      ...current,
      judgeRecommendations: current.judgeRecommendations.map((item) =>
        item.id === recommendationId
          ? { ...item, status: accepted ? 'accepted' : 'rejected' }
          : item,
      ),
      audit: [
        auditEntry(
          accepted ? 'judge.recommendation_accepted' : 'judge.recommendation_rejected',
          target.name,
          accepted ? '主办方确认评委候选人，待分配积分' : '主办方不采用该候选人',
        ),
        ...current.audit,
      ],
    }))
    setNotice(
      accepted
        ? `已确认 ${target.name} 为评委候选人，请到「评委与积分池」分配额度。`
        : `已不采用候选人 ${target.name}。`,
    )
  }

  const defaultResolution = (item: OrganizerVerificationItem, approve: boolean) => {
    if (note.trim()) return note.trim()
    if (item.kind === 'large-review') {
      return approve ? '复核通过，评分保持有效。' : '复核驳回，评分按冲正处理。'
    }
    if (item.kind === 'evidence') {
      return approve ? '证据核验通过。' : '证据不足，退回补充。'
    }
    return approve ? '异议受理并答复。' : '异议驳回。'
  }

  const decide = (item: OrganizerVerificationItem, approve: boolean) => {
    const resolution = defaultResolution(item, approve)

    setDemoState((current) => {
      let nextWorks = current.works
      let nextAllocations = current.allocations
      let nextPool = current.pointPool

      if (item.kind === 'large-review' && item.workId && item.reviewId) {
        nextWorks = current.works.map((work) => {
          if (work.id !== item.workId) return work
          const next = {
            ...work,
            reviews: work.reviews.map((review) =>
              review.id === item.reviewId
                ? {
                    ...review,
                    status: approve ? ('有效' as const) : ('已冲正' as const),
                  }
                : review,
            ),
          }
          return recomputeWorkScore(next)
        })

        if (!approve && item.judgeName && typeof item.score === 'number') {
          nextAllocations = current.allocations.map((allocation) =>
            allocation.judgeName === item.judgeName && allocation.status === 'active'
              ? {
                  ...allocation,
                  usedAmount: Math.max(0, allocation.usedAmount - item.score!),
                }
              : allocation,
          )
          nextPool = {
            ...current.pointPool,
            usedPoints: Math.max(0, current.pointPool.usedPoints - item.score),
          }
        }
      }

      return {
        ...current,
        works: nextWorks,
        allocations: nextAllocations,
        pointPool: nextPool,
        verifications: current.verifications.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: approve ? ('approved' as const) : ('rejected' as const),
                resolution,
              }
            : entry,
        ),
        audit: [
          auditEntry(
            item.kind === 'large-review'
              ? approve
                ? 'review.approved'
                : 'review.reversed'
              : item.kind === 'evidence'
                ? approve
                  ? 'evidence.approved'
                  : 'evidence.returned'
                : approve
                  ? 'dispute.accepted'
                  : 'dispute.rejected',
            item.title,
            resolution,
          ),
          ...current.audit,
        ],
      }
    })

    setSelectedId(null)
    setNote('')
    setNotice(
      item.kind === 'large-review'
        ? approve
          ? '大额复核已通过，评分保持有效。'
          : '大额复核已驳回，评分按冲正处理。'
        : item.kind === 'evidence'
          ? approve
            ? '证据已通过核验。'
            : '证据已退回补充。'
          : approve
            ? '异议已受理并记录答复。'
            : '异议已驳回。',
    )
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>VERIFICATION & DISPUTES / 核验与异议</Eyebrow>
          <h2 className="workspace-title">复核队列与处理结论</h2>
          <p className="workspace-lead">
            大额评分由主办方第二人复核，复核人不能是原评委；证据核验与选手异议也在这里处理并留痕。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            主办方视图
          </Chip>
          <Chip>{WORKSPACE_SEASON.name}</Chip>
          <Chip tone={pending.length > 0 ? 'warning' : 'success'}>
            {pending.length} 项待处理
          </Chip>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="workspace-metrics">
        <article className="ui-metric">
          <span className="ui-metric__label">待复核评分</span>
          <strong className="ui-metric__value font-mono">{metrics.largeReview}</strong>
          <p className="ui-metric__hint">≥ {WORKSPACE_SEASON.reviewThreshold} 分的评分</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">待核验证据</span>
          <strong className="ui-metric__value font-mono">{metrics.evidence}</strong>
          <p className="ui-metric__hint">里程碑与交付证据</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">待处理异议</span>
          <strong className="ui-metric__value font-mono">{metrics.dispute}</strong>
          <p className="ui-metric__hint">选手提交的评分或结果异议</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">已处理</span>
          <strong className="ui-metric__value font-mono">{metrics.processed}</strong>
          <p className="ui-metric__hint">处理结论已写入审计</p>
        </article>
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>ENTERPRISE INBOX / 企业提交</Eyebrow>
            <h3>命题草稿与评委推荐</h3>
          </div>
          <span className="workspace-muted">企业只能提交草稿与推荐，发布与授权由主办方完成</span>
        </header>

        {pendingDrafts.length > 0 || pendingRecommendations.length > 0 ? (
          <div className="workspace-grid">
            <div className="grid gap-3">
              <span className="workspace-label">待发布命题草稿</span>
              {pendingDrafts.length > 0 ? (
                <ul className="rules-changes">
                  {pendingDrafts.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong> · {item.direction}
                      <span className="workspace-muted block">
                        {item.workTypes} · {item.formatLimit} · 承接 {item.capacity} 个项目
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => publishDraft(item.id)}>
                        发布命题
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="workspace-muted">没有待发布的命题草稿。</p>
              )}
            </div>

            <div className="grid gap-3">
              <span className="workspace-label">待确认评委推荐</span>
              {pendingRecommendations.length > 0 ? (
                <ul className="rules-changes">
                  {pendingRecommendations.map((item) => (
                    <li key={item.id}>
                      <strong>{item.name}</strong> · {item.email}
                      <span className="workspace-muted block">{item.reason}</span>
                      <span className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => decideRecommendation(item.id, true)}
                        >
                          确认授权
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => decideRecommendation(item.id, false)}
                        >
                          不采用
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="workspace-muted">没有待确认的评委推荐。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="workspace-muted">企业提交的命题草稿与评委推荐会出现在这里。</p>
        )}
      </section>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>QUEUE / 待处理</Eyebrow>
            <h3>按类型筛选</h3>
          </div>
          <div className="workspace-filters" role="group" aria-label="筛选核验类型">
            {KIND_FILTERS.map((item) => (
              <Button
                key={item.value}
                variant={kind === item.value ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={kind === item.value}
                onClick={() => setKind(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </header>

        {filteredPending.length > 0 ? (
          <ul className="work-list">
            {filteredPending.map((item) => (
              <li key={item.id} className="work-row">
                <div className="work-row__main">
                  <div className="work-row__head">
                    <span className="work-row__type">{verificationKindLabel(item.kind)}</span>
                    <h4 className="work-row__title">{item.title}</h4>
                    <Chip tone="warning">待处理</Chip>
                  </div>
                  <p className="work-row__summary">{item.detail}</p>
                  <div className="work-row__meta">
                    <span>项目 · {item.projectName}</span>
                    <span>提交人 · {item.submittedBy}</span>
                    <span>{item.submittedAt}</span>
                    {typeof item.score === 'number' ? <span>评分 +{item.score}</span> : null}
                    {item.judgeName ? <span>原评委 · {item.judgeName}</span> : null}
                  </div>
                  {item.reason ? <p className="work-row__note">{item.reason}</p> : null}
                </div>
                <div className="work-row__action">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedId(item.id)
                      setNote('')
                    }}
                  >
                    处理
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="workspace-empty">
            <p className="mono text-brand-text">这个筛选下没有待处理项</p>
            <p>新的评分、证据或异议会出现在这里。</p>
          </div>
        )}
      </section>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>PROCESSED / 处理记录</Eyebrow>
            <h3>复核与异议结论</h3>
          </div>
          <span className="workspace-muted">通过不改分，驳回等同冲正</span>
        </header>

        {processed.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="console-table" aria-label="核验处理记录">
              <thead>
                <tr>
                  <th scope="col">类型</th>
                  <th scope="col">事项</th>
                  <th scope="col">项目</th>
                  <th scope="col">提交人</th>
                  <th scope="col">结论</th>
                  <th scope="col">备注</th>
                </tr>
              </thead>
              <tbody>
                {processed.map((item) => {
                  const meta = verificationStatusMeta(item.status)
                  return (
                    <tr key={item.id}>
                      <td>{verificationKindLabel(item.kind)}</td>
                      <td className="min-w-40">{item.title}</td>
                      <td>{item.projectName}</td>
                      <td>{item.submittedBy}</td>
                      <td>
                        <Chip tone={meta.tone}>{meta.label}</Chip>
                      </td>
                      <td className="max-w-72 text-muted-foreground">
                        {item.resolution ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="workspace-empty">
            <p className="mono text-brand-text">还没有处理记录</p>
            <p>处理完一项复核、证据或异议后，结论会留在这里。</p>
          </div>
        )}
      </section>

      {selected ? (
        <DecideDialog
          item={selected}
          note={note}
          setNote={setNote}
          onClose={() => setSelectedId(null)}
          onApprove={() => decide(selected, true)}
          onReject={() => decide(selected, false)}
        />
      ) : null}
    </div>
  )
}

function DecideDialog({
  item,
  note,
  setNote,
  onClose,
  onApprove,
  onReject,
}: {
  item: OrganizerVerificationItem
  note: string
  setNote: (note: string) => void
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const id = useId()
  const approveLabel =
    item.kind === 'large-review'
      ? '通过复核'
      : item.kind === 'evidence'
        ? '通过核验'
        : '受理并答复'
  const rejectLabel =
    item.kind === 'large-review'
      ? '驳回并冲正'
      : item.kind === 'evidence'
        ? '退回补充'
        : '驳回异议'

  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <div className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>{verificationKindLabel(item.kind)} / 处理</Eyebrow>
            <h3 id={`${id}-title`}>{item.title}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <p className="workspace-modal__hint">{item.detail}</p>
        <dl className="workspace-project__facts">
          <div>
            <dt>项目</dt>
            <dd>{item.projectName}</dd>
          </div>
          <div>
            <dt>提交人</dt>
            <dd>{item.submittedBy}</dd>
          </div>
          {item.judgeName ? (
            <div>
              <dt>原评委</dt>
              <dd>{item.judgeName}</dd>
            </div>
          ) : null}
          {typeof item.score === 'number' ? (
            <div>
              <dt>评分</dt>
              <dd>+{item.score}</dd>
            </div>
          ) : null}
        </dl>
        <div className="workspace-modal__fields">
          <FormField label="处理备注" htmlFor={`${id}-note`} hint="会写入审计与处理记录">
            <TextArea
              id={`${id}-note`}
              name="note"
              value={note}
              onChange={setNote}
              rows={3}
              placeholder="写清楚判断依据或驳回原因。"
            />
          </FormField>
        </div>
        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button type="button" variant="ghost" onClick={onReject}>{rejectLabel}</Button>
          <Button type="button" onClick={onApprove}>{approveLabel}</Button>
        </footer>
      </div>
    </div>
  )
}
