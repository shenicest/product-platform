'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { FormField, TextArea, TextInput } from '@/components/submit/form-fields'
import { WorkList } from '@/components/season/works'
import {
  WORKSPACE_CHALLENGES,
  WORKSPACE_ENTERPRISE,
  WORKSPACE_SEASON,
  selectedChallengeLabels,
} from '@/lib/season-workspace'
import {
  auditEntry,
  demoId,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'

const MY_CHALLENGES = WORKSPACE_CHALLENGES.filter((challenge) =>
  WORKSPACE_ENTERPRISE.challengeIds.includes(challenge.id),
)

type DraftForm = {
  title: string
  direction: string
  workTypes: string
  formatLimit: string
  capacity: string
}

type RecommendForm = {
  name: string
  email: string
  reason: string
}

const EMPTY_DRAFT: DraftForm = {
  title: '',
  direction: '',
  workTypes: '过程记录、原型、数据/模型',
  formatLimit: 'PDF / 图片 / 外链，单个附件 ≤ 20MB',
  capacity: '5',
}

const EMPTY_RECOMMEND: RecommendForm = {
  name: '',
  email: '',
  reason: '',
}

/**
 * 企业命题台：企业按本企业命题范围查看项目、作品与评分，并完成矩阵允许的
 * 三个主动作 —— 提交命题草稿、推荐评委候选人、验收本命题交付。
 *
 * 企业仍然不能审核报名、自行发布命题、配置评委或改分：这些入口在这里
 * 根本不存在；草稿与推荐都只是「待主办方处理」的状态。
 */
export function EnterpriseConsole() {
  const demo = useDemoState()
  const projects = demo.projects.filter((project) =>
    WORKSPACE_ENTERPRISE.projectIds.includes(project.id),
  )
  const works = demo.works.filter(
    (work) =>
      work.challengeId !== null &&
      WORKSPACE_ENTERPRISE.challengeIds.includes(work.challengeId),
  )

  const [draftOpen, setDraftOpen] = useState(false)
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT)
  const [draftError, setDraftError] = useState<string | null>(null)

  const [recommendOpen, setRecommendOpen] = useState(false)
  const [recommend, setRecommend] = useState<RecommendForm>(EMPTY_RECOMMEND)
  const [recommendError, setRecommendError] = useState<string | null>(null)

  const [deliveryTarget, setDeliveryTarget] = useState<string | null>(null)
  const [deliveryNote, setDeliveryNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const totalWorks = works.length
  const scoredWorks = works.filter((work) => work.score !== null)
  const averageScore =
    scoredWorks.length > 0
      ? Math.round(
          scoredWorks.reduce((sum, work) => sum + (work.score ?? 0), 0) / scoredWorks.length,
        )
      : 0
  const totalScore = projects.reduce((sum, project) => sum + project.score, 0)
  const deliveryProject = projects.find((project) => project.id === deliveryTarget) ?? null

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault()
    if (draft.title.trim().length < 2) {
      setDraftError('请填写命题标题（至少 2 个字）。')
      return
    }
    if (draft.direction.trim().length < 2) {
      setDraftError('请填写命题方向。')
      return
    }
    const capacity = Number(draft.capacity)
    if (!Number.isInteger(capacity) || capacity <= 0) {
      setDraftError('承接项目数请填写正整数。')
      return
    }
    const title = draft.title.trim()
    setDemoState((current) => ({
      ...current,
      enterpriseDrafts: [
        {
          id: demoId('draft'),
          title,
          direction: draft.direction.trim(),
          workTypes: draft.workTypes.trim(),
          formatLimit: draft.formatLimit.trim(),
          capacity,
          status: 'draft',
          createdAt: '刚刚',
        },
        ...current.enterpriseDrafts,
      ],
      audit: [
        auditEntry(
          'challenge.draft_submitted',
          title,
          '企业提交命题草稿，等待主办方发布',
          WORKSPACE_ENTERPRISE.name,
        ),
        ...current.audit,
      ],
    }))
    setDraftOpen(false)
    setDraft(EMPTY_DRAFT)
    setDraftError(null)
    setNotice('命题草稿已提交，等待主办方确认后发布。')
  }

  const submitRecommendation = (event: React.FormEvent) => {
    event.preventDefault()
    if (recommend.name.trim().length < 2) {
      setRecommendError('请填写候选人姓名。')
      return
    }
    if (!recommend.email.includes('@')) {
      setRecommendError('请填写有效的邮箱。')
      return
    }
    if (recommend.reason.trim().length < 12) {
      setRecommendError('推荐理由至少 12 个字。')
      return
    }
    const name = recommend.name.trim()
    setDemoState((current) => ({
      ...current,
      judgeRecommendations: [
        {
          id: demoId('judge-rec'),
          name,
          email: recommend.email.trim(),
          reason: recommend.reason.trim(),
          status: 'pending',
          createdAt: '刚刚',
        },
        ...current.judgeRecommendations,
      ],
      audit: [
        auditEntry(
          'judge.recommended',
          name,
          '企业推荐评委候选人，等待主办方确认',
          WORKSPACE_ENTERPRISE.name,
        ),
        ...current.audit,
      ],
    }))
    setRecommendOpen(false)
    setRecommend(EMPTY_RECOMMEND)
    setRecommendError(null)
    setNotice('评委候选人已推荐，是否生效由主办方确认。')
  }

  const acceptDelivery = () => {
    if (!deliveryProject) return
    setDemoState((current) => ({
      ...current,
      deliveryStatus: { ...current.deliveryStatus, [deliveryProject.id]: 'accepted' },
      audit: [
        auditEntry(
          'delivery.accepted',
          deliveryProject.name,
          deliveryNote.trim() || '企业验收本命题交付',
          WORKSPACE_ENTERPRISE.name,
        ),
        ...current.audit,
      ],
    }))
    setDeliveryTarget(null)
    setDeliveryNote('')
    setNotice(`已验收《${deliveryProject.name}》的本命题交付。`)
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>ENTERPRISE CONSOLE / 企业命题台</Eyebrow>
          <h2 className="workspace-title">{WORKSPACE_ENTERPRISE.name}</h2>
          <p className="workspace-lead">
            查看本企业命题下的项目、作品与评分；可以提交命题草稿、推荐评委候选人、验收本命题交付。
            企业不能审核报名、自行发布命题、配置评委或改分。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            企业视图
          </Chip>
          <Chip>{WORKSPACE_SEASON.name}</Chip>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setDraftOpen(true)}>
              提交命题草稿
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRecommendOpen(true)}>
              推荐评委候选人
            </Button>
          </div>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="workspace-metrics">
        <article className="ui-metric">
          <span className="ui-metric__label">本企业命题</span>
          <strong className="ui-metric__value font-mono">{MY_CHALLENGES.length}</strong>
          <p className="ui-metric__hint">按企业归属汇总</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">选择本命题的项目</span>
          <strong className="ui-metric__value font-mono">{projects.length}</strong>
          <p className="ui-metric__hint">项目命题完全平行</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">本命题作品</span>
          <strong className="ui-metric__value font-mono">{totalWorks}</strong>
          <p className="ui-metric__hint">{scoredWorks.length} 份已有评分</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">项目积分</span>
          <strong className="ui-metric__value font-mono">{totalScore}</strong>
          <p className="ui-metric__hint">
            平均作品分 {averageScore} · 1 积分 = ¥1
          </p>
        </article>
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>MY CHALLENGES / 本企业命题</Eyebrow>
            <h3>命题配置与选择情况</h3>
          </div>
          <span className="workspace-muted">只展示本企业授权范围</span>
        </header>

        <div className="workspace-challenge-grid">
          {MY_CHALLENGES.map((challenge) => (
            <article key={challenge.id} className="workspace-challenge">
              <header>
                <span className="workspace-challenge__enterprise">{challenge.enterprise}</span>
                <Chip tone="neutral">{challenge.typeLabel}</Chip>
              </header>
              <h4>{challenge.title}</h4>
              <dl>
                <div>
                  <dt>方向</dt>
                  <dd>{challenge.direction}</dd>
                </div>
                <div>
                  <dt>作品类型</dt>
                  <dd>{challenge.workTypes}</dd>
                </div>
                <div>
                  <dt>格式限制</dt>
                  <dd>{challenge.formatLimit}</dd>
                </div>
                <div>
                  <dt>项目选择</dt>
                  <dd>
                    {challenge.selected} / {challenge.capacity}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {demo.enterpriseDrafts.length > 0 ? (
        <section className="ui-panel workspace-panel">
          <header className="workspace-panel__head">
            <div>
              <Eyebrow>CHALLENGE DRAFTS / 命题草稿</Eyebrow>
              <h3>已提交的草稿</h3>
            </div>
            <Chip
              tone={demo.enterpriseDrafts.some((item) => item.status === 'draft') ? 'warning' : 'success'}
            >
              {demo.enterpriseDrafts.some((item) => item.status === 'draft')
                ? '等待主办方发布'
                : '已由主办方处理'}
            </Chip>
          </header>
          <ul className="rules-changes">
            {demo.enterpriseDrafts.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> · {item.direction} · {item.capacity} 个项目承接
                <Chip tone={item.status === 'published' ? 'success' : 'warning'}>
                  {item.status === 'published' ? '已发布' : '草稿'}
                </Chip>
                <span className="workspace-muted block">
                  {item.workTypes} · {item.formatLimit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>PROJECTS / 项目</Eyebrow>
            <h3>选择本企业命题的项目</h3>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="console-table" aria-label="选择本企业命题的项目">
            <thead>
              <tr>
                <th scope="col">项目</th>
                <th scope="col">发起人</th>
                <th scope="col">项目命题</th>
                <th scope="col">阶段</th>
                <th scope="col">作品</th>
                <th scope="col">积分</th>
                <th scope="col">最新进度</th>
                <th scope="col">交付验收</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const accepted = demo.deliveryStatus[project.id] === 'accepted'
                return (
                  <tr key={project.id}>
                    <td className="min-w-40">
                      <span className="font-bold">{project.name}</span>
                      <span className="workspace-muted block">{project.code}</span>
                    </td>
                    <td>{project.ownerName}</td>
                    <td>
                      <span className="flex flex-wrap gap-1.5">
                        {selectedChallengeLabels(project).map((title) => (
                          <Chip key={title} className="text-meta">
                            {title}
                          </Chip>
                        ))}
                      </span>
                    </td>
                    <td>{project.stage}</td>
                    <td className="font-mono text-meta">{project.worksCount} 份</td>
                    <td className="font-mono text-meta">{project.score}</td>
                    <td className="font-mono text-meta">{project.latestUpdate}</td>
                    <td className="w-px whitespace-nowrap">
                      {accepted ? (
                        <Chip tone="success">已验收</Chip>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDeliveryTarget(project.id)
                            setDeliveryNote('')
                          }}
                        >
                          验收交付
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

      {demo.judgeRecommendations.length > 0 ? (
        <section className="ui-panel workspace-panel">
          <header className="workspace-panel__head">
            <div>
              <Eyebrow>JUDGE RECOMMENDATIONS / 评委推荐</Eyebrow>
              <h3>已推荐的候选人</h3>
            </div>
            <Chip
              tone={
                demo.judgeRecommendations.some((item) => item.status === 'pending')
                  ? 'warning'
                  : 'success'
              }
            >
              {demo.judgeRecommendations.some((item) => item.status === 'pending')
                ? '等待主办方确认'
                : '已由主办方处理'}
            </Chip>
          </header>
          <ul className="rules-changes">
            {demo.judgeRecommendations.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong> · {item.email}
                <Chip
                  tone={
                    item.status === 'accepted'
                      ? 'success'
                      : item.status === 'rejected'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {item.status === 'accepted'
                    ? '已通过'
                    : item.status === 'rejected'
                      ? '未采用'
                      : '待确认'}
                </Chip>
                <span className="workspace-muted block">{item.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>WORKS / 作品与进度</Eyebrow>
            <h3>本企业命题下的作品</h3>
          </div>
          <span className="workspace-muted">仅统计标注本企业命题的作品</span>
        </header>
        <WorkList works={works} showProject />
      </section>

      <section className="ui-panel workspace-panel workspace-report">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>CHALLENGE REPORT / 命题报告</Eyebrow>
            <h3>本命题基础聚合</h3>
          </div>
          <Chip tone="neutral">只读</Chip>
        </header>
        <div className="workspace-report__grid">
          <div>
            <span className="workspace-label">选择本命题的项目</span>
            <strong>{projects.length}</strong>
          </div>
          <div>
            <span className="workspace-label">本命题作品</span>
            <strong>{totalWorks}</strong>
          </div>
          <div>
            <span className="workspace-label">已有评分</span>
            <strong>{scoredWorks.length}</strong>
          </div>
          <div>
            <span className="workspace-label">项目累计积分</span>
            <strong>{totalScore}</strong>
          </div>
        </div>
        <p className="workspace-muted">
          收入金额默认不公开；嘉宾评分、作品正文与私密证据只在授权范围内展示。
        </p>
      </section>

      {draftOpen ? (
        <DraftDialog
          form={draft}
          setForm={setDraft}
          error={draftError}
          onClose={() => setDraftOpen(false)}
          onSubmit={submitDraft}
        />
      ) : null}

      {recommendOpen ? (
        <RecommendDialog
          form={recommend}
          setForm={setRecommend}
          error={recommendError}
          onClose={() => setRecommendOpen(false)}
          onSubmit={submitRecommendation}
        />
      ) : null}

      {deliveryProject ? (
        <DeliveryDialog
          projectName={deliveryProject.name}
          note={deliveryNote}
          setNote={setDeliveryNote}
          onClose={() => setDeliveryTarget(null)}
          onSubmit={acceptDelivery}
        />
      ) : null}
    </div>
  )
}

function DraftDialog({
  form,
  setForm,
  error,
  onClose,
  onSubmit,
}: {
  form: DraftForm
  setForm: (form: DraftForm) => void
  error: string | null
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
}) {
  const id = useId()
  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <form className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={onSubmit}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>CHALLENGE DRAFT / 命题草稿</Eyebrow>
            <h3 id={`${id}-title`}>提交命题草稿</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <p className="workspace-modal__hint">
          企业只能提交草稿；是否发布、什么时候发布由本赛季主办方决定。
        </p>
        <div className="workspace-modal__fields">
          <FormField label="命题标题" htmlFor={`${id}-title-input`} required>
            <TextInput id={`${id}-title-input`} name="title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="例如：园区储能站点智能运维" />
          </FormField>
          <FormField label="方向" htmlFor={`${id}-direction`} required>
            <TextInput id={`${id}-direction`} name="direction" value={form.direction} onChange={(value) => setForm({ ...form, direction: value })} placeholder="例如：储能 / 智能运维" />
          </FormField>
          <FormField label="作品类型" htmlFor={`${id}-types`} required>
            <TextInput id={`${id}-types`} name="workTypes" value={form.workTypes} onChange={(value) => setForm({ ...form, workTypes: value })} />
          </FormField>
          <FormField label="格式限制" htmlFor={`${id}-format`} required>
            <TextInput id={`${id}-format`} name="formatLimit" value={form.formatLimit} onChange={(value) => setForm({ ...form, formatLimit: value })} />
          </FormField>
          <FormField label="承接项目数" htmlFor={`${id}-capacity`} required>
            <TextInput id={`${id}-capacity`} name="capacity" type="number" value={form.capacity} onChange={(value) => setForm({ ...form, capacity: value })} min={1} />
          </FormField>
          {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        </div>
        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit">提交草稿</Button>
        </footer>
      </form>
    </div>
  )
}

function RecommendDialog({
  form,
  setForm,
  error,
  onClose,
  onSubmit,
}: {
  form: RecommendForm
  setForm: (form: RecommendForm) => void
  error: string | null
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
}) {
  const id = useId()
  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <form className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={onSubmit}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>JUDGE RECOMMENDATION / 评委推荐</Eyebrow>
            <h3 id={`${id}-title`}>推荐评委候选人</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <p className="workspace-modal__hint">
          企业只能推荐，不能自行生效；评委配置与积分分配由主办方完成。
        </p>
        <div className="workspace-modal__fields">
          <FormField label="候选人姓名" htmlFor={`${id}-name`} required>
            <TextInput id={`${id}-name`} name="name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          </FormField>
          <FormField label="邮箱" htmlFor={`${id}-email`} required>
            <TextInput id={`${id}-email`} name="email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          </FormField>
          <FormField label="推荐理由" htmlFor={`${id}-reason`} required hint="至少 12 个字">
            <TextArea id={`${id}-reason`} name="reason" value={form.reason} onChange={(value) => setForm({ ...form, reason: value })} rows={3} />
          </FormField>
          {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        </div>
        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit">提交推荐</Button>
        </footer>
      </form>
    </div>
  )
}

function DeliveryDialog({
  projectName,
  note,
  setNote,
  onClose,
  onSubmit,
}: {
  projectName: string
  note: string
  setNote: (note: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const id = useId()
  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <div className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>DELIVERY ACCEPTANCE / 交付验收</Eyebrow>
            <h3 id={`${id}-title`}>验收《{projectName}》</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <p className="workspace-modal__hint">
          本动作只针对本企业命题下的交付；验收后主办方会在赛季记录里看到结论。
        </p>
        <div className="workspace-modal__fields">
          <FormField label="验收说明" htmlFor={`${id}-note`} hint="可选">
            <TextArea id={`${id}-note`} name="note" value={note} onChange={setNote} rows={3} placeholder="交付范围、验收结论或后续事项。" />
          </FormField>
        </div>
        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button type="button" onClick={onSubmit}>确认验收</Button>
        </footer>
      </div>
    </div>
  )
}
