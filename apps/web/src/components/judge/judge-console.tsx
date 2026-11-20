'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { FormField, SelectInput, TextArea, TextInput } from '@/components/submit/form-fields'
import { WorkStatusChip } from '@/components/season/works'
import {
  WORKSPACE_CANDIDATES,
  WORKSPACE_JUDGE,
  WORKSPACE_SEASON,
  challengeById,
  projectById,
  type WorkspaceWork,
} from '@/lib/season-workspace'
import {
  auditEntry,
  demoId,
  recomputeWorkScore,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'

const DIMENSIONS = [
  '真实商业结果',
  '交付质量与客户价值',
  '原创方法与产业洞察',
  '行动、证据与有效迭代',
  '共建、开源和复用价值',
]

const WORK_FILTERS = [
  { value: 'all', label: '全部作品' },
  { value: 'reviewing', label: '待评分' },
  { value: 'scored', label: '已评分' },
]

/**
 * 权限矩阵 4.2 第 5 条：同一评委对同一作品版本只能评一次。
 * 已冲正的评分不算有效评分，允许重新评。
 */
function reviewedByMe(work: WorkspaceWork): boolean {
  return work.reviews.some(
    (review) => review.judgeName === WORKSPACE_JUDGE.name && review.status !== '已冲正',
  )
}

/** 权限矩阵 4.5 第 5 条：评委不得给本人参与的项目评分。 */
function isConflict(work: WorkspaceWork): boolean {
  const project = projectById(work.projectId)
  return project?.members.includes(WORKSPACE_JUDGE.name) ?? false
}

export function JudgeConsole() {
  const demo = useDemoState()
  const works = demo.works
  const myAllocation = demo.allocations.find(
    (allocation) =>
      allocation.judgeName === WORKSPACE_JUDGE.name && allocation.status === 'active',
  )
  const remaining = myAllocation ? myAllocation.amount - myAllocation.usedAmount : 0
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')
  const [dimension, setDimension] = useState(DIMENSIONS[0])
  const [suggestReview, setSuggestReview] = useState('否')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selected = works.find((work) => work.id === selectedId) ?? null
  const used = myAllocation?.usedAmount ?? 0

  const filteredWorks = useMemo(
    () => (filter === 'all' ? works : works.filter((work) => work.status === filter)),
    [filter, works],
  )

  const myReviews = useMemo(
    () =>
      works.flatMap((work) =>
        work.reviews
          .filter((review) => review.judgeName === WORKSPACE_JUDGE.name)
          .map((review) => ({ ...review, workTitle: work.title })),
      ),
    [works],
  )
  const pendingReviewCount = myReviews.filter((review) => review.status === '待复核').length

  const openWork = (workId: string) => {
    const target = works.find((work) => work.id === workId)
    if (!target) return
    // 表格已经把这两种情况的按钮换成「回避 / 已评分」，这里再兜一次，
    // 避免通过其它入口（键盘、未来加上的快捷操作）绕过规则。
    if (isConflict(target)) {
      setNotice('评委不得给本人参与的项目评分。')
      return
    }
    if (reviewedByMe(target)) {
      setNotice('同一评委对同一作品版本只能评分一次；需要更正请走冲正流程。')
      return
    }
    setSelectedId(workId)
    setScore('')
    setReason('')
    setDimension(DIMENSIONS[0])
    setSuggestReview('否')
    setError(null)
    setNotice(null)
  }

  const closeWork = () => {
    setSelectedId(null)
    setError(null)
  }

  const applyScore = (work: WorkspaceWork) => {
    if (isConflict(work)) {
      setError('评委不得给本人参与的项目评分。')
      return
    }
    if (reviewedByMe(work)) {
      setError('同一评委对同一作品版本只能评分一次；需要更正请走冲正流程。')
      return
    }
    const value = Number(score)
    if (!Number.isInteger(value) || value <= 0) {
      setError('请填写正整数分值。')
      return
    }
    if (value > remaining) {
      setError(`超出剩余分配余额：当前只剩 ${remaining} 分。`)
      return
    }
    if (value > WORKSPACE_SEASON.singleWorkCap) {
      setError(`单次评分不能超过 ${WORKSPACE_SEASON.singleWorkCap} 分。`)
      return
    }
    if (reason.trim().length < 12) {
      setError('评分理由至少 12 个字，并尽量对应作品证据。')
      return
    }

    const needsReview = value >= WORKSPACE_SEASON.reviewThreshold || suggestReview === '是'
    const reviewId = demoId(`jr-${work.id}`)
    const review = {
      id: reviewId,
      workId: work.id,
      judgeName: WORKSPACE_JUDGE.name,
      score: value,
      reason: reason.trim(),
      createdAt: '刚刚',
      status: needsReview ? ('待复核' as const) : ('有效' as const),
    }
    const projectName = projectById(work.projectId)?.name ?? '—'

    setDemoState((current) => {
      const allocation = current.allocations.find(
        (item) => item.judgeName === WORKSPACE_JUDGE.name && item.status === 'active',
      )
      const nextWorks = current.works.map((item) =>
        item.id === work.id
          ? recomputeWorkScore({ ...item, reviews: [...item.reviews, review] })
          : item,
      )
      const nextAllocations = current.allocations.map((item) =>
        item.id === allocation?.id
          ? { ...item, usedAmount: item.usedAmount + value }
          : item,
      )
      const nextVerifications = needsReview
        ? [
            ...current.verifications,
            {
              id: demoId('verify'),
              kind: 'large-review' as const,
              title: work.title,
              projectName,
              submittedBy: WORKSPACE_JUDGE.name,
              submittedAt: '刚刚',
              status: 'pending' as const,
              detail: `单次评分 ${value} 分，达到大额复核阈值 ${WORKSPACE_SEASON.reviewThreshold} 分。`,
              workId: work.id,
              reviewId,
              judgeName: WORKSPACE_JUDGE.name,
              score: value,
              reason: reason.trim(),
            },
          ]
        : current.verifications

      return {
        ...current,
        works: nextWorks,
        allocations: nextAllocations,
        pointPool: {
          ...current.pointPool,
          usedPoints: current.pointPool.usedPoints + value,
        },
        verifications: nextVerifications,
        audit: [
          auditEntry(
            'score.submitted',
            work.title,
            `+${value} 分${needsReview ? '，进入大额复核' : ''}`,
            WORKSPACE_JUDGE.name,
          ),
          ...current.audit,
        ],
      }
    })
    setNotice(
      needsReview
        ? `已提交 ${value} 分，因达到大额复核阈值，等待主办方复核。`
        : `已提交 ${value} 分，剩余分配 ${remaining - value} 分。`,
    )
    closeWork()
  }

  /** 不予赋分：记录 0 分评审结论，作品退回选手补充；不动积分额度。 */
  const rejectWork = (work: WorkspaceWork) => {
    if (isConflict(work)) {
      setError('评委不得对本人参与的项目提出评审意见。')
      return
    }
    if (reviewedByMe(work)) {
      setError('同一评委对同一作品版本只能留下一次评审结论。')
      return
    }
    if (reason.trim().length < 12) {
      setError('请先写清楚不予赋分的理由（至少 12 个字）。')
      return
    }

    const reviewId = demoId(`jr-${work.id}`)
    setDemoState((current) => ({
      ...current,
      works: current.works.map((item) =>
        item.id === work.id
          ? {
              ...item,
              status: 'changes_requested',
              reviewNote: reason.trim(),
              reviews: [
                ...item.reviews,
                {
                  id: reviewId,
                  workId: work.id,
                  judgeName: WORKSPACE_JUDGE.name,
                  score: 0,
                  reason: reason.trim(),
                  createdAt: '刚刚',
                  status: '不予赋分',
                },
              ],
            }
          : item,
      ),
      audit: [
        auditEntry('score.rejected', work.title, '评委不予赋分', WORKSPACE_JUDGE.name),
        ...current.audit,
      ],
    }))
    setNotice('已提交「不予赋分」，作品退回选手补充；未占用评分额度。')
    closeWork()
  }

  const requestChanges = (work: WorkspaceWork) => {
    if (isConflict(work)) {
      setNotice('评委不得对本人参与的项目提出评审意见。')
      closeWork()
      return
    }
    if (reviewedByMe(work)) {
      setNotice('同一评委对同一作品版本只能留下一次评审结论。')
      closeWork()
      return
    }
    const note = reason.trim() || '请补充客户反馈、证据或交付说明后重新提交。'
    setDemoState((current) => ({
      ...current,
      works: current.works.map((item) =>
        item.id === work.id
          ? {
              ...item,
              status: 'changes_requested',
              reviewNote: note,
            }
          : item,
      ),
      audit: [
        auditEntry('work.changes_requested', work.title, note, WORKSPACE_JUDGE.name),
        ...current.audit,
      ],
    }))
    setNotice('已要求选手补充材料。')
    closeWork()
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>JUDGE CONSOLE / 评委台</Eyebrow>
          <h2 className="workspace-title">{WORKSPACE_SEASON.name}</h2>
          <p className="workspace-lead">
            在作用范围与分配余额内，对已发布的赛季作品进行滚动评分。每份作品版本只能评分一次，多位评委的评分独立叠加。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            评委 · {WORKSPACE_JUDGE.name}
          </Chip>
          <Chip>{WORKSPACE_JUDGE.scope}</Chip>
          <Chip tone="warning">大额复核阈值 {WORKSPACE_SEASON.reviewThreshold}</Chip>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="workspace-metrics">
        <article className="ui-metric">
          <span className="ui-metric__label">分配额度</span>
          <strong className="ui-metric__value font-mono">{myAllocation?.amount ?? 0}</strong>
          <p className="ui-metric__hint">来自赛季积分池</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">已用</span>
          <strong className="ui-metric__value font-mono">{used}</strong>
          <p className="ui-metric__hint">有效评分流水</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">剩余</span>
          <strong className="ui-metric__value font-mono">{remaining}</strong>
          <p className="ui-metric__hint">用完即不能继续评分</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">待评分</span>
          <strong className="ui-metric__value font-mono">
            {works.filter((work) => work.status !== 'scored').length}
          </strong>
          <p className="ui-metric__hint">按作品版本进入队列</p>
        </article>
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>CANDIDATES / 参赛候选人</Eyebrow>
            <h3>注册选手与项目</h3>
          </div>
          <span className="workspace-muted">仅展示注册 ID、邮箱与项目归属</span>
        </header>

        <div className="overflow-x-auto">
          <table className="console-table" aria-label="评委可见的参赛候选人">
            <thead>
              <tr>
                <th scope="col">注册 ID</th>
                <th scope="col">选手</th>
                <th scope="col">邮箱</th>
                <th scope="col">项目</th>
                <th scope="col">项目命题</th>
                <th scope="col">作品</th>
              </tr>
            </thead>
            <tbody>
              {WORKSPACE_CANDIDATES.map((candidate) => (
                <tr key={candidate.userId}>
                  <td className="font-mono text-meta">{candidate.userId}</td>
                  <td className="font-bold">{candidate.name}</td>
                  <td className="font-mono text-meta">{candidate.email}</td>
                  <td>{candidate.projectName}</td>
                  <td>
                    <span className="flex flex-wrap gap-1.5">
                      {candidate.challengeIds.map((challengeId) => {
                        const challenge = challengeById(challengeId)
                        return challenge ? (
                          <Chip key={challengeId} className="text-meta">
                            {challenge.title}
                          </Chip>
                        ) : null
                      })}
                    </span>
                  </td>
                  <td className="font-mono text-meta">{candidate.worksCount} 份</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>SCORING QUEUE / 评分队列</Eyebrow>
            <h3>待评分作品</h3>
          </div>
          <div className="workspace-filters" role="group" aria-label="筛选作品">
            {WORK_FILTERS.map((item) => (
              <Button
                key={item.value}
                variant={filter === item.value ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="console-table" aria-label="评委评分队列">
            <thead>
              <tr>
                <th scope="col">作品</th>
                <th scope="col">项目</th>
                <th scope="col">命题</th>
                <th scope="col">版本</th>
                <th scope="col">状态</th>
                <th scope="col">已有评分</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorks.map((work) => {
                const project = projectById(work.projectId)
                const challenge = challengeById(work.challengeId)
                const conflict = isConflict(work)
                const reviewed = reviewedByMe(work)
                return (
                  <tr key={work.id} className={conflict ? 'is-conflict' : undefined}>
                    <td className="min-w-52">
                      <span className="font-bold">{work.title}</span>
                      <span className="workspace-muted block">{work.type}</span>
                    </td>
                    <td>{project?.name ?? '—'}</td>
                    <td className="min-w-40">{challenge?.title ?? '未标注'}</td>
                    <td className="font-mono text-meta">v{work.version}</td>
                    <td>
                      <WorkStatusChip work={work} />
                    </td>
                    <td className="font-mono text-meta">
                      {work.reviews.length > 0
                        ? work.reviews.map((review) => `${review.judgeName} +${review.score}`).join(' · ')
                        : '尚无评分'}
                    </td>
                    <td className="w-px whitespace-nowrap">
                      {conflict ? (
                        <Chip tone="danger">回避</Chip>
                      ) : reviewed ? (
                        <Chip tone="neutral">已评分</Chip>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => openWork(work.id)}>
                          评分
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>MY REVIEWS / 我的评分记录</Eyebrow>
            <h3>最近评分</h3>
          </div>
          <span className="workspace-muted">
            评分不能直接修改；更正由平台管理员冲正后重新评分
          </span>
        </header>

        {myReviews.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="console-table" aria-label="我的评分记录">
              <thead>
                <tr>
                  <th scope="col">时间</th>
                  <th scope="col">作品</th>
                  <th scope="col">我的分值</th>
                  <th scope="col">状态</th>
                  <th scope="col">理由</th>
                </tr>
              </thead>
              <tbody>
                {myReviews.map((review) => (
                  <tr key={review.id}>
                    <td className="whitespace-nowrap font-mono text-meta">
                      {review.createdAt}
                    </td>
                    <td className="min-w-40">{review.workTitle}</td>
                    <td className="font-mono text-meta text-brand-text">+{review.score}</td>
                    <td>
                      <Chip
                        tone={
                          review.status === '待复核'
                            ? 'warning'
                            : review.status === '已冲正'
                              ? 'danger'
                              : review.status === '不予赋分'
                                ? 'neutral'
                                : 'success'
                        }
                      >
                        {review.status}
                      </Chip>
                    </td>
                    <td className="max-w-72 text-muted-foreground">{review.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="workspace-empty">
            <p className="mono text-brand-text">还没有评分记录</p>
            <p>完成第一份作品评分后，记录会出现在这里。</p>
          </div>
        )}
      </section>

      <div className="workspace-grid">
        <section className="ui-panel workspace-panel">
          <header className="workspace-panel__head">
            <div>
              <Eyebrow>LARGE REVIEW / 大额复核</Eyebrow>
              <h3>待复核评分</h3>
            </div>
            <Chip tone={pendingReviewCount > 0 ? 'warning' : 'success'}>
              {pendingReviewCount} 条
            </Chip>
          </header>
          <p className="workspace-muted">
            单次评分不低于 {WORKSPACE_SEASON.reviewThreshold} 分进入待复核；复核人不能是原评委，通过不改分，驳回等同冲正。
          </p>
          {myReviews.filter((review) => review.status === '待复核').length > 0 ? (
            <ul className="rules-changes">
              {myReviews
                .filter((review) => review.status === '待复核')
                .map((review) => (
                  <li key={review.id}>
                    《{review.workTitle}》+{review.score} · 等待主办方复核
                  </li>
                ))}
            </ul>
          ) : (
            <p className="workspace-muted">你没有待复核的评分。</p>
          )}
        </section>

        <section className="ui-panel workspace-panel">
          <header className="workspace-panel__head">
            <div>
              <Eyebrow>SCORING RULES / 评分规则</Eyebrow>
              <h3>本季约束</h3>
            </div>
          </header>
          <ul className="rules-changes">
            <li>单次上限 {WORKSPACE_SEASON.singleWorkCap} 分；标注命题的作品取赛季与命题上限较小值</li>
            <li>同一评委对同一作品版本只能有一条有效评分</li>
            <li>多位评委可分别评分，积分叠加并归项目</li>
            <li>理由至少 12 个字，需对应作品证据</li>
            <li>大额复核阈值 {WORKSPACE_SEASON.reviewThreshold} 分</li>
            <li>每日额度：{WORKSPACE_JUDGE.dailyQuota ? '开启' : '关闭'}</li>
            <li>评分截止 {WORKSPACE_SEASON.scoreDeadline}（北京时间）</li>
            <li>不按点赞、浏览量、群聊热度评分</li>
          </ul>
        </section>
      </div>

      {selected ? (
        <div className="workspace-modal" role="presentation">
          <button
            type="button"
            className="workspace-modal__backdrop"
            aria-label="关闭评分"
            onClick={closeWork}
          />
          <form
            className="workspace-modal__panel workspace-modal__panel--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="judge-score-title"
            onSubmit={(event) => {
              event.preventDefault()
              applyScore(selected)
            }}
          >
            <header className="workspace-modal__head">
              <div>
                <Eyebrow>SCORE WORK / 作品评分</Eyebrow>
                <h3 id="judge-score-title">{selected.title}</h3>
                <p className="workspace-muted">
                  {projectById(selected.projectId)?.name} ·{' '}
                  {challengeById(selected.challengeId)?.title ?? '未标注命题'} · v
                  {selected.version}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeWork}>
                关闭
              </Button>
            </header>

            <div className="workspace-review-grid">
              <div className="workspace-review-main">
                <p className="workspace-project__summary">{selected.summary}</p>
                <div className="workspace-score-guide">
                  <span className="workspace-label">五维评分引导</span>
                  <ol>
                    {DIMENSIONS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>

                {selected.reviews.length > 0 ? (
                  <div className="workspace-score-history">
                    <span className="workspace-label">已有评分</span>
                    <ul>
                      {selected.reviews.map((review) => (
                        <li key={review.id}>
                          <strong>{review.judgeName}</strong>
                          <span className="workspace-score">+{review.score}</span>
                          <span>{review.reason}</span>
                          <small>{review.status} · {review.createdAt}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <aside className="workspace-review-side">
                <dl className="workspace-project__facts">
                  <div>
                    <dt>我的作用范围</dt>
                    <dd>{WORKSPACE_JUDGE.scope}</dd>
                  </div>
                  <div>
                    <dt>剩余分配</dt>
                    <dd>{remaining} 分</dd>
                  </div>
                  <div>
                    <dt>单次上限</dt>
                    <dd>{WORKSPACE_SEASON.singleWorkCap} 分</dd>
                  </div>
                  <div>
                    <dt>大额复核</dt>
                    <dd>≥ {WORKSPACE_SEASON.reviewThreshold} 分</dd>
                  </div>
                </dl>

                <FormField label="分值" htmlFor="judge-score" required hint="正整数，不超过剩余分配">
                  <TextInput
                    id="judge-score"
                    name="score"
                    type="number"
                    value={score}
                    onChange={setScore}
                    placeholder="例如 18"
                    min={1}
                    max={remaining}
                  />
                </FormField>

                <FormField label="价值维度" htmlFor="judge-dimension">
                  <SelectInput
                    id="judge-dimension"
                    name="dimension"
                    value={dimension}
                    onChange={setDimension}
                    options={DIMENSIONS.map((value) => ({ value, label: value }))}
                  />
                </FormField>

                <FormField label="是否建议复核" htmlFor="judge-review">
                  <SelectInput
                    id="judge-review"
                    name="suggest-review"
                    value={suggestReview}
                    onChange={setSuggestReview}
                    options={[
                      { value: '否', label: '否' },
                      { value: '是', label: '是，建议主办方复核' },
                    ]}
                  />
                </FormField>

                <FormField label="评分理由" htmlFor="judge-reason" required hint="至少 12 个字">
                  <TextArea
                    id="judge-reason"
                    name="reason"
                    value={reason}
                    onChange={setReason}
                    rows={4}
                    placeholder="对应作品证据，说明为什么给这个分值。"
                  />
                </FormField>

                {error ? (
                  <p className="ui-field-error" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="workspace-review-actions">
                  <Button type="submit">确认评分</Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => rejectWork(selected)}
                  >
                    不予赋分
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => requestChanges(selected)}>
                    要求补充
                  </Button>
                </div>
              </aside>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
