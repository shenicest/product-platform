'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { FormField, TextArea, TextInput, SelectInput } from '@/components/submit/form-fields'
import { WorkList } from '@/components/season/works'
import { SeasonChallengeConfig } from '@/components/me/season-workspace'
import {
  WORKSPACE_CHALLENGES,
  formatReward,
  milestoneStatusMeta,
  projectReviewMeta,
  selectedChallengeLabels,
} from '@/lib/season-workspace'
import {
  auditEntry,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待评审' },
  { value: 'changes_requested', label: '需补充' },
  { value: 'approved', label: '已确认' },
]

const PROJECT_COLUMNS = [
  '项目',
  '发起人',
  '命题',
  '阶段',
  '最新进度',
  '作品',
  '积分 / 奖金',
  '评审状态',
  '操作',
]

export function ProjectsReviewView() {
  const demo = useDemoState()
  const projects = demo.projects
  const works = demo.works
  const milestones = demo.milestones
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [challengeFilter, setChallengeFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return projects.filter((project) => {
      if (status !== 'all' && project.reviewStatus !== status) return false
      if (
        challengeFilter !== 'all' &&
        !project.challengeIds.includes(challengeFilter)
      ) {
        return false
      }
      if (!keyword) return true
      return (
        project.name.toLowerCase().includes(keyword) ||
        project.ownerName.toLowerCase().includes(keyword) ||
        project.ownerEmail.toLowerCase().includes(keyword)
      )
    })
  }, [challengeFilter, projects, query, status])

  const selected = projects.find((project) => project.id === selectedId) ?? null
  const selectedWorks = selected
    ? works.filter((work) => work.projectId === selected.id)
    : []
  const selectedMilestones = selected
    ? milestones.filter((milestone) => milestone.projectId === selected.id)
    : []

  const pendingCount = projects.filter((project) => project.reviewStatus === 'pending').length
  const totalWorks = works.length
  const changesCount = works.filter((work) => work.status === 'changes_requested').length

  const reviewProject = (projectId: string, decision: 'approved' | 'changes_requested') => {
    const project = projects.find((item) => item.id === projectId)
    setDemoState((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === projectId
          ? {
              ...item,
              reviewStatus: decision,
              reviewNote: reviewNote.trim() || null,
            }
          : item,
      ),
      audit: [
        auditEntry(
          decision === 'approved' ? 'project.approved' : 'project.changes_requested',
          project?.name ?? projectId,
          reviewNote.trim() || (decision === 'approved' ? '项目评审通过' : '要求补充材料'),
        ),
        ...current.audit,
      ],
    }))
    setNotice(
      decision === 'approved'
        ? '项目评审已通过，选手会看到确认结果。'
        : '已要求补充材料，选手会看到补充说明。',
    )
    setReviewNote('')
  }

  const reviewMilestone = (
    milestoneId: string,
    decision: 'approved' | 'changes_requested',
  ) => {
    const milestone = milestones.find((item) => item.id === milestoneId)
    setDemoState((current) => ({
      ...current,
      milestones: current.milestones.map((item) =>
        item.id === milestoneId
          ? {
              ...item,
              status: decision,
              reviewedAt: '刚刚',
              note:
                decision === 'changes_requested'
                  ? reviewNote.trim() || '请补充里程碑证据或说明。'
                  : item.note,
            }
          : item,
      ),
      audit: [
        auditEntry(
          decision === 'approved' ? 'milestone.approved' : 'milestone.changes_requested',
          `${milestone?.milestone ?? '里程碑'} · ${milestone?.label ?? ''}`,
          reviewNote.trim() || (decision === 'approved' ? '里程碑通过' : '要求补充材料'),
        ),
        ...current.audit,
      ],
    }))
    setNotice(
      decision === 'approved'
        ? '里程碑已通过，项目阶段会推进。'
        : '已要求选手补充里程碑材料。',
    )
    setReviewNote('')
  }

  const reviewWork = (workId: string, decision: 'approve' | 'changes') => {
    const work = works.find((item) => item.id === workId)
    setDemoState((current) => ({
      ...current,
      works: current.works.map((item) =>
        item.id === workId
          ? {
              ...item,
              status: decision === 'approve' ? 'published' : 'changes_requested',
              reviewNote:
                decision === 'approve'
                  ? null
                  : reviewNote.trim() || '请补充客户反馈、证据或交付说明。',
            }
          : item,
      ),
      audit: [
        auditEntry(
          decision === 'approve' ? 'work.approved' : 'work.changes_requested',
          work?.title ?? workId,
          reviewNote.trim() || (decision === 'approve' ? '进度审核通过' : '要求补充材料'),
        ),
        ...current.audit,
      ],
    }))
    setNotice(
      decision === 'approve'
        ? '进度已通过审核。'
        : '已要求选手补充进度材料。',
    )
    setReviewNote('')
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>PROJECTS & PROGRESS / 项目与进度</Eyebrow>
          <h2 className="workspace-title">赛季项目评审</h2>
          <p className="workspace-lead">
            查看全部赛季项目、选手提交的作品与里程碑进度。企业方只有项目只读视图，评审动作只对主办方开放。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            主办方视图
          </Chip>
          <Chip>项目与进度</Chip>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="workspace-metrics">
        <article className="ui-metric">
          <span className="ui-metric__label">赛季项目</span>
          <strong className="ui-metric__value font-mono">{projects.length}</strong>
          <p className="ui-metric__hint">覆盖 {WORKSPACE_CHALLENGES.length} 个命题</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">作品 / 进度</span>
          <strong className="ui-metric__value font-mono">{totalWorks}</strong>
          <p className="ui-metric__hint">选手可持续提交，滚动进入评审</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">待评审项目</span>
          <strong className="ui-metric__value font-mono">{pendingCount}</strong>
          <p className="ui-metric__hint">按项目汇总，可逐条查看进度</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">需补充进度</span>
          <strong className="ui-metric__value font-mono">{changesCount}</strong>
          <p className="ui-metric__hint">已退回选手补充材料</p>
        </article>
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>ALL PROJECTS / 全部项目</Eyebrow>
            <h3>项目与最新进度</h3>
          </div>
        </header>

        <div className="workspace-toolbar">
          <div className="workspace-toolbar__filters">
            <TextInput
              id="project-search"
              name="project-search"
              value={query}
              onChange={setQuery}
              placeholder="搜索项目 / 发起人 / 邮箱"
            />
            <SelectInput
              id="challenge-filter"
              name="challenge-filter"
              value={challengeFilter}
              onChange={setChallengeFilter}
              options={[
                { value: 'all', label: '全部命题' },
                ...WORKSPACE_CHALLENGES.map((challenge) => ({
                  value: challenge.id,
                  label: challenge.title,
                })),
              ]}
            />
            <SelectInput
              id="status-filter"
              name="status-filter"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS}
            />
          </div>
          <span className="workspace-muted">共 {filtered.length} 个项目</span>
        </div>

        <div className="overflow-x-auto">
          <table className="console-table" aria-label="赛季项目与进度">
            <thead>
              <tr>
                {PROJECT_COLUMNS.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => {
                const review = projectReviewMeta(project.reviewStatus)
                const challenges = selectedChallengeLabels(project)
                return (
                  <tr key={project.id}>
                    <td className="min-w-40">
                      <button
                        type="button"
                        className="workspace-table-link"
                        onClick={() => setSelectedId(project.id)}
                      >
                        {project.name}
                      </button>
                      <span className="workspace-muted block">{project.code}</span>
                    </td>
                    <td className="min-w-36">
                      <span className="font-bold">{project.ownerName}</span>
                      <span className="workspace-muted block">{project.ownerEmail}</span>
                    </td>
                    <td className="min-w-44">
                      <span className="flex flex-wrap gap-1.5">
                        {challenges.map((title) => (
                          <Chip key={title} className="text-meta">
                            {title}
                          </Chip>
                        ))}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{project.stage}</td>
                    <td className="whitespace-nowrap font-mono text-meta">
                      {project.latestUpdate}
                    </td>
                    <td className="whitespace-nowrap font-mono text-meta">
                      {project.worksCount} 份
                    </td>
                    <td className="whitespace-nowrap font-mono text-meta">
                      {project.score} / {formatReward(project.expectedReward)}
                    </td>
                    <td>
                      <Chip tone={review.tone} dot>
                        {review.label}
                      </Chip>
                    </td>
                    <td className="w-px whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedId(project.id)}
                      >
                        查看
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="workspace-empty">
            <p className="mono text-brand-text">没有匹配的项目</p>
            <p>调整搜索或筛选条件后再试。</p>
          </div>
        ) : null}
      </section>

      <SeasonChallengeConfig />

      {selected ? (
        <div className="workspace-modal" role="presentation">
          <button
            type="button"
            className="workspace-modal__backdrop"
            aria-label="关闭项目详情"
            onClick={() => setSelectedId(null)}
          />
          <section
            className="workspace-modal__panel workspace-modal__panel--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-review-title"
          >
            <header className="workspace-modal__head">
              <div>
                <Eyebrow>PROJECT REVIEW / 项目评审</Eyebrow>
                <h3 id="project-review-title">{selected.name}</h3>
                <p className="workspace-muted">
                  {selected.code} · {selected.ownerName} · {selected.ownerEmail}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                关闭
              </Button>
            </header>

            <div className="workspace-review-grid">
              <div className="workspace-review-main">
                <p className="workspace-project__summary">{selected.summary}</p>

                <div className="workspace-project__block">
                  <span className="workspace-label">项目命题</span>
                  <div className="workspace-chips">
                    {selectedChallengeLabels(selected).map((title) => (
                      <Chip key={title}>{title}</Chip>
                    ))}
                  </div>
                </div>

                <div className="workspace-project__block">
                  <span className="workspace-label">核心成员</span>
                  <div className="workspace-chips">
                    {selected.members.map((member) => (
                      <Chip key={member}>{member}</Chip>
                    ))}
                  </div>
                </div>

                <WorkList
                  works={selectedWorks}
                  renderAction={(work) => (
                    <div className="workspace-review-actions">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => reviewWork(work.id, 'approve')}
                      >
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reviewWork(work.id, 'changes')}
                      >
                        要求补充
                      </Button>
                    </div>
                  )}
                />
              </div>

              <aside className="workspace-review-side">
                <dl className="workspace-project__facts">
                  <div>
                    <dt>阶段</dt>
                    <dd>{selected.stage}</dd>
                  </div>
                  <div>
                    <dt>当前积分</dt>
                    <dd>{selected.score}</dd>
                  </div>
                  <div>
                    <dt>预计奖金</dt>
                    <dd>{formatReward(selected.expectedReward)}</dd>
                  </div>
                  <div>
                    <dt>评审状态</dt>
                    <dd>{projectReviewMeta(selected.reviewStatus).label}</dd>
                  </div>
                </dl>

                <div className="workspace-project__block">
                  <span className="workspace-label">里程碑</span>
                  <ol className="milestone-list milestone-list--compact">
                    {selectedMilestones.map((milestone) => {
                      const meta = milestoneStatusMeta(milestone.status)
                      return (
                        <li key={milestone.id} className="milestone-row">
                          <span className="milestone-row__code">{milestone.milestone}</span>
                          <div className="milestone-row__body">
                            <strong>{milestone.label}</strong>
                            {milestone.note ? <p>{milestone.note}</p> : null}
                          </div>
                          <Chip tone={meta.tone}>{meta.label}</Chip>
                          {milestone.status === 'submitted' ? (
                            <div className="workspace-review-actions">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => reviewMilestone(milestone.id, 'approved')}
                              >
                                通过
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  reviewMilestone(milestone.id, 'changes_requested')
                                }
                              >
                                要求补充
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ol>
                </div>

                <FormField
                  label="评审说明"
                  htmlFor="project-review-note"
                  hint="要求补充或退回时，会把这段说明发给选手。"
                >
                  <TextArea
                    id="project-review-note"
                    name="review-note"
                    value={reviewNote}
                    onChange={setReviewNote}
                    rows={3}
                    placeholder="写清楚需要补充的材料或下一步要求。"
                  />
                </FormField>

                <div className="workspace-review-actions">
                  <Button onClick={() => reviewProject(selected.id, 'approved')}>
                    通过项目评审
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => reviewProject(selected.id, 'changes_requested')}
                  >
                    要求补充
                  </Button>
                </div>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
