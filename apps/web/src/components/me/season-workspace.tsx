'use client'

import Link from 'next/link'
import { useId, useMemo, useRef, useState } from 'react'
import { Role } from '@shenicest/shared'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import {
  CheckboxInput,
  FieldError,
  FormField,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import { WorkList } from '@/components/season/works'
import { SEASON_ROLE_LABELS, type SeasonRole } from '@/lib/season-access'
import {
  auditEntry,
  demoId,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'
import {
  MY_PROJECT,
  PUBLIC_SCOPES,
  WORKSPACE_CHALLENGES,
  WORKSPACE_ENTERPRISE,
  WORKSPACE_JUDGE,
  WORKSPACE_PROJECTS,
  WORKSPACE_SEASON,
  WORK_TYPES,
  challengeById,
  formatReward,
  milestoneStatusMeta,
  selectedChallengeLabels,
  type PublicScope,
  type WorkspaceMilestone,
  type WorkspaceWork,
} from '@/lib/season-workspace'

type WorkDraft = {
  challengeId: string | null
  type: string
  title: string
  summary: string
  body: string
  publicScope: PublicScope
  externalLink: string
  contributors: string
  milestone: string
  privateNote: string
  requestReview: boolean
  attachments: string[]
}

/**
 * 提交进度/作品的表单弹层。
 *
 * 先提交到评审队列，主办方与评委都能在各自的工作台看到；标题、摘要和
 * 正文都做前端必填校验，错误的提示与字段用 FormField 的 aria 关联。
 */
function SubmitWorkDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (draft: WorkDraft) => void
}) {
  const id = useId()
  const [challengeId, setChallengeId] = useState('')
  const [type, setType] = useState<string>(WORK_TYPES[0])
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<PublicScope>('公开')
  const [externalLink, setExternalLink] = useState('')
  const [contributors, setContributors] = useState('')
  const [milestone, setMilestone] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [requestReview, setRequestReview] = useState(true)
  const [attachments, setAttachments] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const challengeOptions = [
    { value: '', label: '不标注命题' },
    ...MY_PROJECT.challengeIds
      .map((cid) => challengeById(cid))
      .filter((challenge): challenge is NonNullable<typeof challenge> => Boolean(challenge))
      .map((challenge) => ({ value: challenge.id, label: challenge.title })),
  ]

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (title.trim().length < 2) {
      setError('请填写作品标题（至少 2 个字）。')
      return
    }
    if (summary.trim().length < 8) {
      setError('摘要至少 8 个字，方便主办方快速了解这份进度。')
      return
    }
    if (body.trim().length < 12) {
      setError('正文至少 12 个字，写清楚这次做了什么、证据是什么。')
      return
    }
    setError(null)
    onSubmit({
      challengeId: challengeId || null,
      type,
      title: title.trim(),
      summary: summary.trim(),
      body: body.trim(),
      publicScope: scope,
      externalLink: externalLink.trim(),
      contributors: contributors.trim(),
      milestone,
      privateNote: privateNote.trim(),
      requestReview,
      attachments,
    })
    setTitle('')
    setSummary('')
    setBody('')
    setChallengeId('')
    setType(WORK_TYPES[0])
    setScope('公开')
    setExternalLink('')
    setContributors('')
    setMilestone('')
    setPrivateNote('')
    setRequestReview(true)
    setAttachments([])
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="workspace-modal" role="presentation">
      <button
        type="button"
        className="workspace-modal__backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <form
        className="workspace-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onSubmit={handleSubmit}
      >
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>PUBLISH STAGE / 发布阶段</Eyebrow>
            <h3 id={`${id}-title`}>发布阶段</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </header>

        <p className="workspace-modal__hint">
          提交后会同时进入主办方审核与评委评分队列；作品发布不会自动产生积分。
        </p>

        <div className="workspace-modal__fields">
          <FormField label="所属项目" htmlFor={`${id}-project`}>
            <TextInput
              id={`${id}-project`}
              name="project"
              value={`${MY_PROJECT.name} · ${MY_PROJECT.code}`}
              onChange={() => {}}
              disabled
            />
          </FormField>

          <FormField label="关联命题" htmlFor={`${id}-challenge`} hint="不标注命题也可以提交。">
            <SelectInput
              id={`${id}-challenge`}
              name="challenge"
              value={challengeId}
              onChange={setChallengeId}
              options={challengeOptions}
            />
          </FormField>

          <FormField label="作品类型" htmlFor={`${id}-type`}>
            <SelectInput
              id={`${id}-type`}
              name="type"
              value={type}
              onChange={setType}
              options={WORK_TYPES.map((value) => ({ value, label: value }))}
            />
          </FormField>

          <FormField label="公开范围" htmlFor={`${id}-scope`}>
            <SelectInput
              id={`${id}-scope`}
              name="scope"
              value={scope}
              onChange={(value) => setScope(value as PublicScope)}
              options={PUBLIC_SCOPES.map((value) => ({ value, label: value }))}
            />
          </FormField>

          <FormField label="标题" htmlFor={`${id}-title`} required>
            <TextInput
              id={`${id}-title`}
              name="title"
              value={title}
              onChange={setTitle}
              placeholder="例如：M2 客户访谈复盘"
              required
              maxLength={80}
            />
          </FormField>

          <FormField label="一句话摘要" htmlFor={`${id}-summary`} required hint="至少 8 个字">
            <TextInput
              id={`${id}-summary`}
              name="summary"
              value={summary}
              onChange={setSummary}
              placeholder="这次进度解决了什么、拿到了什么证据"
              required
              maxLength={120}
            />
          </FormField>

          <FormField label="正文" htmlFor={`${id}-body`} required hint="至少 12 个字">
            <TextArea
              id={`${id}-body`}
              name="body"
              value={body}
              onChange={setBody}
              placeholder="记录这次做了什么、客户/用户反馈、证据与下一步。"
              rows={5}
              required
              maxLength={2000}
            />
          </FormField>

          <FormField
            label="附件"
            htmlFor={`${id}-files`}
            hint="文字说明之外，可补充 PDF、图片或文档，支持多选"
          >
            <div className="workspace-upload">
              <input
                ref={fileRef}
                id={`${id}-files`}
                name="attachments"
                type="file"
                multiple
                className="workspace-upload__input"
                onChange={(event) =>
                  setAttachments(
                    Array.from(event.target.files ?? []).map((file) => file.name),
                  )
                }
              />
              <label htmlFor={`${id}-files`} className="workspace-upload__label">
                选择文件
              </label>
              <span className="workspace-upload__hint">
                已选 {attachments.length} 个文件
              </span>
              {attachments.length > 0 ? (
                <ul className="workspace-upload__list">
                  {attachments.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </FormField>

          <FormField label="外部链接" htmlFor={`${id}-link`} hint="演示地址、文档或视频链接">
            <TextInput
              id={`${id}-link`}
              name="externalLink"
              value={externalLink}
              onChange={setExternalLink}
              placeholder="https://"
            />
          </FormField>

          <FormField label="共同贡献者" htmlFor={`${id}-contributors`} hint="用逗号分隔，可留空">
            <TextInput
              id={`${id}-contributors`}
              name="contributors"
              value={contributors}
              onChange={setContributors}
              placeholder="例如：周野、陈青"
            />
          </FormField>

          <FormField label="关联里程碑" htmlFor={`${id}-milestone`} hint="里程碑只认证阶段，不产生固定积分">
            <SelectInput
              id={`${id}-milestone`}
              name="milestone"
              value={milestone}
              onChange={setMilestone}
              options={[
                { value: '', label: '不关联里程碑' },
                { value: 'M1', label: 'M1 · 验证真实问题' },
                { value: 'M2', label: 'M2 · 形成可交付方案' },
                { value: 'M3', label: 'M3 · 完成外部试用或真实交付' },
                { value: 'M4', label: 'M4 · 完成命题关键结果' },
              ]}
            />
          </FormField>

          <FormField
            label="私密证据"
            htmlFor={`${id}-private`}
            hint="仅项目成员、作用范围内的评委、核验员与主办方可见"
          >
            <TextArea
              id={`${id}-private`}
              name="privateNote"
              value={privateNote}
              onChange={setPrivateNote}
              rows={3}
              placeholder="客户名单、报价、验收单等不适合公开的材料说明。"
            />
          </FormField>

          <CheckboxInput
            id={`${id}-review`}
            name="requestReview"
            checked={requestReview}
            onChange={setRequestReview}
          >
            申请评分（发布本身不自动得分，多位评委可分别评分）
          </CheckboxInput>

          <FieldError>{error}</FieldError>
        </div>

        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">发布</Button>
        </footer>
      </form>
    </div>
  )
}

function MilestoneSubmitDialog({
  milestone,
  works,
  onClose,
  onSubmit,
}: {
  milestone: WorkspaceMilestone
  works: readonly WorkspaceWork[]
  onClose: () => void
  onSubmit: (draft: { workIds: string[]; challengeId: string | null; note: string }) => void
}) {
  const id = useId()
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>(
    works.slice(0, 2).map((work) => work.id),
  )
  const [challengeId, setChallengeId] = useState(MY_PROJECT.challengeIds[0] ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const needsChallenge = milestone.milestone === 'M3' || milestone.milestone === 'M4'
  const challengeOptions = MY_PROJECT.challengeIds
    .map((cid) => challengeById(cid))
    .filter((challenge): challenge is NonNullable<typeof challenge> => Boolean(challenge))
    .map((challenge) => ({ value: challenge.id, label: challenge.title }))

  const toggleWork = (workId: string, checked: boolean) => {
    setSelectedWorkIds((current) =>
      checked ? [...current, workId] : current.filter((id) => id !== workId),
    )
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (note.trim().length < 12) {
      setError('说明至少 12 个字，写清楚这次提交的证据与阶段判断。')
      return
    }
    setError(null)
    onSubmit({
      workIds: selectedWorkIds,
      challengeId: needsChallenge ? challengeId || null : null,
      note: note.trim(),
    })
  }

  return (
    <div className="workspace-modal" role="presentation">
      <button
        type="button"
        className="workspace-modal__backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <form
        className="workspace-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onSubmit={handleSubmit}
      >
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>SUBMIT MILESTONE / 提交里程碑</Eyebrow>
            <h3 id={`${id}-title`}>{milestone.milestone} · {milestone.label}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </header>

        <p className="workspace-modal__hint">
          里程碑只认证阶段，不产生固定积分；积分来自作品的滚动评分。通过后项目阶段会推进。
        </p>

        <div className="workspace-modal__fields">
          <fieldset className="workspace-checkbox-group">
            <legend className="ui-label">关联作品（作为证据）</legend>
            <div className="workspace-checkbox-group__items">
              {works.map((work) => (
                <CheckboxInput
                  key={work.id}
                  id={`${id}-work-${work.id}`}
                  name={`work-${work.id}`}
                  checked={selectedWorkIds.includes(work.id)}
                  onChange={(checked) => toggleWork(work.id, checked)}
                >
                  {work.title} · {work.type}
                </CheckboxInput>
              ))}
            </div>
          </fieldset>

          {needsChallenge ? (
            <FormField
              label="按哪个项目命题的门槛审核"
              htmlFor={`${id}-challenge`}
              hint="达到任一项目命题的要求即可通过"
            >
              <SelectInput
                id={`${id}-challenge`}
                name="challenge"
                value={challengeId}
                onChange={setChallengeId}
                options={challengeOptions}
              />
            </FormField>
          ) : null}

          <FormField label="说明" htmlFor={`${id}-note`} required hint="至少 12 个字">
            <TextArea
              id={`${id}-note`}
              name="note"
              value={note}
              onChange={setNote}
              rows={4}
              required
              placeholder="写清楚这次完成了什么、证据在哪、下一步是什么。"
            />
          </FormField>

          <FieldError>{error}</FieldError>
        </div>

        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">提交 {milestone.milestone}</Button>
        </footer>
      </form>
    </div>
  )
}

function WorkMetrics({
  works,
  totalScore,
  nextMilestone,
}: {
  works: readonly WorkspaceWork[]
  totalScore: number
  nextMilestone: string
}) {
  return (
    <div className="workspace-metrics">
      <article className="ui-metric">
        <span className="ui-metric__label">我的项目</span>
        <strong className="ui-metric__value font-mono">1</strong>
        <p className="ui-metric__hint">{MY_PROJECT.stage} · {MY_PROJECT.members.length} 人</p>
      </article>
      <article className="ui-metric">
        <span className="ui-metric__label">已选命题</span>
        <strong className="ui-metric__value font-mono">{MY_PROJECT.challengeIds.length}</strong>
        <p className="ui-metric__hint">最多可选 {WORKSPACE_SEASON.maxChallengesPerProject} 个平行命题</p>
      </article>
      <article className="ui-metric">
        <span className="ui-metric__label">作品 / 进度</span>
        <strong className="ui-metric__value font-mono">{works.length}</strong>
        <p className="ui-metric__hint">
          {works.filter((work) => work.status === 'reviewing').length} 份评审中
        </p>
      </article>
      <article className="ui-metric">
        <span className="ui-metric__label">当前积分 / 预计奖金</span>
        <strong className="ui-metric__value font-mono">{totalScore}</strong>
        <p className="ui-metric__hint">{formatReward(totalScore)} · 按 1 积分 = ¥1</p>
      </article>
      <article className="ui-metric">
        <span className="ui-metric__label">下一里程碑</span>
        <strong className="ui-metric__value text-h3">{nextMilestone}</strong>
        <p className="ui-metric__hint">M3 完成外部试用或真实交付</p>
      </article>
    </div>
  )
}

function MilestonePanel({
  milestones,
  onOpen,
}: {
  milestones: WorkspaceMilestone[]
  onOpen: (milestoneId: string) => void
}) {
  return (
    <section className="ui-panel workspace-panel">
      <header className="workspace-panel__head">
        <div>
          <Eyebrow>MILESTONES / 里程碑</Eyebrow>
          <h3>项目阶段进度</h3>
        </div>
        <span className="workspace-muted">认证通过后推进项目阶段</span>
      </header>

      <ol className="milestone-list">
        {milestones.map((milestone) => {
          const meta = milestoneStatusMeta(milestone.status)
          const canSubmit = milestone.status === 'pending' && milestone.milestone === 'M3'
          return (
            <li key={milestone.id} className="milestone-row">
              <span className="milestone-row__code">{milestone.milestone}</span>
              <div className="milestone-row__body">
                <strong>{milestone.label}</strong>
                <p>
                  {milestone.status === 'approved'
                    ? `已通过 · ${milestone.reviewedAt ?? ''}`
                    : milestone.status === 'submitted'
                      ? `已提交 · ${milestone.submittedAt ?? ''}，等待主办方审核${milestone.note ? ` · ${milestone.note}` : ''}`
                      : milestone.note ?? '尚未提交'}
                </p>
              </div>
              <Chip tone={meta.tone}>{meta.label}</Chip>
              {canSubmit ? (
                <Button size="sm" variant="secondary" onClick={() => onOpen(milestone.id)}>
                  提交 M3
                </Button>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function OtherIdentities({
  pendingWorks,
  seasonRoles,
}: {
  pendingWorks: number
  seasonRoles: readonly SeasonRole[]
}) {
  const showJudge = seasonRoles.includes('judge')
  const showEnterprise = seasonRoles.includes('enterprise')
  const showOrganizer = seasonRoles.includes('organizer')

  // 权限矩阵按赛季角色分别判断：只有真正持有该角色的人才看到对应入口。
  // 普通选手不应该看到评委台 / 企业命题台的入口，否则点进去就是 403。
  if (!showJudge && !showEnterprise && !showOrganizer) return null

  return (
    <section className="workspace-identities" aria-label="我的其他赛季身份">
      {showJudge ? (
        <Link href="/judge" className="ui-panel workspace-identity">
          <Eyebrow>JUDGE / 评委</Eyebrow>
          <strong>评委台 · {WORKSPACE_JUDGE.name}</strong>
          <p>
            {WORKSPACE_JUDGE.scope} · 剩余 {WORKSPACE_JUDGE.remaining} 分 · {pendingWorks} 份待评分
          </p>
          <span>进入评委台 →</span>
        </Link>
      ) : null}

      {showEnterprise ? (
        <Link href="/enterprise" className="ui-panel workspace-identity">
          <Eyebrow>ENTERPRISE / 企业</Eyebrow>
          <strong>企业命题台 · {WORKSPACE_ENTERPRISE.name}</strong>
          <p>1 个本企业命题 · 1 个选择本命题的项目</p>
          <span>查看企业视图 →</span>
        </Link>
      ) : null}

      {showOrganizer ? (
        <Link href="/organizer/projects" className="ui-panel workspace-identity">
          <Eyebrow>ORGANIZER / 主办方</Eyebrow>
          <strong>项目与进度评审</strong>
          <p>
            AI4BBS · {WORKSPACE_PROJECTS.filter((project) => project.reviewStatus === 'pending').length}{' '}
            个项目待评审
          </p>
          <span>进入主办方视图 →</span>
        </Link>
      ) : null}
    </section>
  )
}

function RoleContext({
  platformRoles,
  seasonRoles,
}: {
  platformRoles: readonly Role[]
  seasonRoles: readonly SeasonRole[]
}) {
  const platformLabels: string[] = []
  if (platformRoles.includes(Role.Operator)) platformLabels.push('运营')
  if (platformRoles.includes(Role.Founder)) platformLabels.push('创始人')
  if (platformLabels.length === 0) platformLabels.push('普通用户')

  const seasonLabels = seasonRoles.map((role) => SEASON_ROLE_LABELS[role])

  return (
    <section className="ui-panel workspace-panel" aria-label="角色上下文">
      <header className="workspace-panel__head">
        <div>
          <Eyebrow>ROLE CONTEXT / 角色上下文</Eyebrow>
          <h3>平台身份 → 赛季角色 → 项目角色</h3>
        </div>
        <span className="workspace-muted">
          同一人可以同时是选手、评委、企业成员或主办方，权限分别判断
        </span>
      </header>

      <div className="role-context">
        <div className="role-context__layer">
          <span className="role-context__no">1</span>
          <div>
            <strong>平台身份</strong>
            <div className="workspace-chips">
              {platformLabels.map((label) => (
                <Chip key={label} tone="neutral">
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="role-context__layer">
          <span className="role-context__no">2</span>
          <div>
            <strong>赛季角色</strong>
            <div className="workspace-chips">
              {seasonLabels.length > 0 ? (
                seasonLabels.map((label) => (
                  <Chip key={label} tone={label === '赛季选手' ? 'success' : 'neutral'}>
                    {label}
                  </Chip>
                ))
              ) : (
                <span className="workspace-muted">本赛季没有角色</span>
              )}
            </div>
          </div>
        </div>
        <div className="role-context__layer">
          <span className="role-context__no">3</span>
          <div>
            <strong>项目角色</strong>
            <div className="workspace-chips">
              <Chip tone="accent">{MY_PROJECT.name} · 发起人</Chip>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SeasonRulesPanel() {
  return (
    <aside className="ui-panel workspace-panel workspace-rules">
      <Eyebrow>SEASON RULES / 赛季规则</Eyebrow>
      <h3>本季规则卡</h3>
      <dl>
        <div>
          <dt>积分兑换</dt>
          <dd>1 积分 = ¥1</dd>
        </div>
        <div>
          <dt>每个项目命题上限</dt>
          <dd>{WORKSPACE_SEASON.maxChallengesPerProject} 个平行命题</dd>
        </div>
        <div>
          <dt>每人项目上限</dt>
          <dd>{WORKSPACE_SEASON.maxProjectsPerParticipant} 个</dd>
        </div>
        <div>
          <dt>单次评分上限</dt>
          <dd>{WORKSPACE_SEASON.singleWorkCap} 分</dd>
        </div>
        <div>
          <dt>作品截止</dt>
          <dd>{WORKSPACE_SEASON.workDeadline}</dd>
        </div>
        <div>
          <dt>评分截止</dt>
          <dd>{WORKSPACE_SEASON.scoreDeadline}</dd>
        </div>
      </dl>

      <div className="workspace-rules__links">
        <ButtonLink href="/me/team" variant="secondary" size="sm">
          管理组队
        </ButtonLink>
        <ButtonLink href="/seasons/1" variant="ghost" size="sm">
          查看赛季详情
        </ButtonLink>
        <ButtonLink href="/products" variant="ghost" size="sm">
          产品共生
        </ButtonLink>
      </div>
    </aside>
  )
}

export function SeasonWorkspace({
  platformRoles = [],
  seasonRoles = [],
}: {
  platformRoles?: readonly Role[]
  seasonRoles?: readonly SeasonRole[]
} = {}) {
  const demo = useDemoState()
  const works = useMemo(
    () => demo.works.filter((work) => work.projectId === MY_PROJECT.id),
    [demo.works],
  )
  const milestones = useMemo(
    () => demo.milestones.filter((milestone) => milestone.projectId === MY_PROJECT.id),
    [demo.milestones],
  )
  const [submitOpen, setSubmitOpen] = useState(false)
  const [milestoneDialogId, setMilestoneDialogId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const totalScore = works.reduce((sum, work) => sum + (work.score ?? 0), 0)
  const nextMilestone =
    milestones.find((milestone) => milestone.status !== 'approved')?.milestone ?? 'M4'
  const milestoneForDialog = milestoneDialogId
    ? (milestones.find((milestone) => milestone.id === milestoneDialogId) ?? null)
    : null

  const handleSubmit = (draft: WorkDraft) => {
    const newWork: WorkspaceWork = {
      id: demoId('w'),
      projectId: MY_PROJECT.id,
      challengeId: draft.challengeId,
      type: draft.type,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      authorName: '张一',
      createdAt: '刚刚',
      status: 'reviewing',
      score: null,
      version: 1,
      publicScope: draft.publicScope,
      reviewNote: null,
      reviews: [],
      externalLink: draft.externalLink || null,
      contributors: draft.contributors
        ? draft.contributors
            .split(/[,，、]/)
            .map((name) => name.trim())
            .filter(Boolean)
        : [],
      milestone: (draft.milestone || null) as WorkspaceWork['milestone'],
      privateNote: draft.privateNote || null,
      requestReview: draft.requestReview,
      attachments: draft.attachments,
    }
    setDemoState((current) => ({
      ...current,
      works: [newWork, ...current.works],
      audit: [
        auditEntry(
          'work.published',
          newWork.title,
          `版本 v${newWork.version}，公开范围：${newWork.publicScope}`,
          '张一',
        ),
        ...current.audit,
      ],
    }))
    setSubmitOpen(false)
    setNotice('已提交，主办方可审核、评委可评分。')
  }

  const handleMilestoneSubmit = (
    milestoneId: string,
    draft: { workIds: string[]; challengeId: string | null; note: string },
  ) => {
    const target = milestones.find((milestone) => milestone.id === milestoneId)
    setDemoState((current) => ({
      ...current,
      milestones: current.milestones.map((milestone) =>
        milestone.id === milestoneId
          ? {
              ...milestone,
              status: 'submitted',
              submittedAt: '刚刚',
              note: draft.note,
              workIds: draft.workIds,
              challengeId: draft.challengeId,
            }
          : milestone,
      ),
      audit: [
        auditEntry(
          'milestone.submitted',
          `${target?.milestone ?? '里程碑'} · ${target?.label ?? ''}`,
          draft.note,
          '张一',
        ),
        ...current.audit,
      ],
    }))
    setMilestoneDialogId(null)
    setNotice(`${target?.milestone ?? '里程碑'} 已提交，等待主办方审核。`)
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>SEASON WORKSPACE / 参赛台</Eyebrow>
          <h2 className="workspace-title">{WORKSPACE_SEASON.name}</h2>
          <p className="workspace-lead">
            报名已通过，当前处于作品提交与滚动评审阶段。提交的进度会同时进入主办方审核与评委评分队列。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            {WORKSPACE_SEASON.statusLabel}
          </Chip>
          <Chip>
            DAY {WORKSPACE_SEASON.dayIndex} / {WORKSPACE_SEASON.dayTotal}
          </Chip>
          <Chip tone="warning">作品截止 {WORKSPACE_SEASON.workDeadline}</Chip>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <OtherIdentities
        pendingWorks={works.filter((work) => work.status === 'reviewing').length}
        seasonRoles={seasonRoles}
      />

      <WorkMetrics works={works} totalScore={totalScore} nextMilestone={nextMilestone} />

      <div className="workspace-grid">
        <section className="ui-panel workspace-panel workspace-project">
          <header className="workspace-panel__head">
            <div>
              <Eyebrow>MY PROJECT / 我的项目</Eyebrow>
              <h3>{MY_PROJECT.name}</h3>
            </div>
            <div className="workspace-project__badges">
              <Chip tone="success">{MY_PROJECT.stage}</Chip>
              <Chip>{MY_PROJECT.code}</Chip>
            </div>
          </header>

          <p className="workspace-project__summary">{MY_PROJECT.summary}</p>

          <div className="workspace-project__block">
            <span className="workspace-label">已选命题</span>
            <div className="workspace-chips">
              {selectedChallengeLabels(MY_PROJECT).map((label) => (
                <Chip key={label} tone="neutral">
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="workspace-project__block">
            <span className="workspace-label">核心成员</span>
            <div className="workspace-chips">
              {MY_PROJECT.members.map((member) => (
                <Chip key={member}>{member}</Chip>
              ))}
            </div>
          </div>

          <dl className="workspace-project__facts">
            <div>
              <dt>当前积分</dt>
              <dd>{totalScore}</dd>
            </div>
            <div>
              <dt>预计奖金</dt>
              <dd>{formatReward(totalScore)}</dd>
            </div>
            <div>
              <dt>最新进度</dt>
              <dd>{MY_PROJECT.milestoneLabel}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>{MY_PROJECT.latestUpdate}</dd>
            </div>
          </dl>

          <div className="workspace-project__actions">
            <Button variant="primary" onClick={() => setSubmitOpen(true)}>
              发布阶段
            </Button>
            <ButtonLink href="/me/team" variant="secondary">
              管理项目
            </ButtonLink>
          </div>
        </section>

        <SeasonRulesPanel />
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>WORKS & PROGRESS / 作品与进度</Eyebrow>
            <h3>最近提交</h3>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setSubmitOpen(true)}>
            提交进度 / 作品
          </Button>
        </header>
        <WorkList works={works.slice(0, 4)} />
        <div className="workspace-panel__foot">
          <ButtonLink href="/me/works" variant="ghost" size="sm">
            查看全部作品 <span className="ui-btn__arrow" aria-hidden>→</span>
          </ButtonLink>
        </div>
      </section>

      <MilestonePanel milestones={milestones} onOpen={setMilestoneDialogId} />

      <RoleContext platformRoles={platformRoles} seasonRoles={seasonRoles} />

      {milestoneForDialog ? (
        <MilestoneSubmitDialog
          key={milestoneForDialog.id}
          milestone={milestoneForDialog}
          works={works}
          onClose={() => setMilestoneDialogId(null)}
          onSubmit={(draft) => handleMilestoneSubmit(milestoneForDialog.id, draft)}
        />
      ) : null}

      <SubmitWorkDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

const WORK_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'reviewing', label: '评审中' },
  { value: 'scored', label: '已评分' },
  { value: 'changes_requested', label: '需补充' },
] as const

export function WorksLibrary() {
  const demo = useDemoState()
  const works = useMemo(
    () => demo.works.filter((work) => work.projectId === MY_PROJECT.id),
    [demo.works],
  )
  const [filter, setFilter] = useState<(typeof WORK_FILTERS)[number]['value']>('all')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const filtered = useMemo(
    () => (filter === 'all' ? works : works.filter((work) => work.status === filter)),
    [filter, works],
  )

  const handleSubmit = (draft: WorkDraft) => {
    const newWork: WorkspaceWork = {
      id: demoId('w'),
      projectId: MY_PROJECT.id,
      challengeId: draft.challengeId,
      type: draft.type,
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      authorName: '张一',
      createdAt: '刚刚',
      status: 'reviewing',
      score: null,
      version: 1,
      publicScope: draft.publicScope,
      reviewNote: null,
      reviews: [],
      externalLink: draft.externalLink || null,
      contributors: draft.contributors
        ? draft.contributors
            .split(/[,，、]/)
            .map((name) => name.trim())
            .filter(Boolean)
        : [],
      milestone: (draft.milestone || null) as WorkspaceWork['milestone'],
      privateNote: draft.privateNote || null,
      requestReview: draft.requestReview,
      attachments: draft.attachments,
    }
    setDemoState((current) => ({
      ...current,
      works: [newWork, ...current.works],
      audit: [
        auditEntry(
          'work.published',
          newWork.title,
          `版本 v${newWork.version}，公开范围：${newWork.publicScope}`,
          '张一',
        ),
        ...current.audit,
      ],
    }))
    setSubmitOpen(false)
    setNotice('已提交，主办方可审核、评委可评分。')
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>MY WORKS / 我的作品</Eyebrow>
          <h2 className="workspace-title">作品与进度</h2>
          <p className="workspace-lead">
            这里汇总你在 {WORKSPACE_SEASON.name} 提交的全部作品与进度；每份作品都有独立的评审与评分记录。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Button variant="primary" onClick={() => setSubmitOpen(true)}>
            发布阶段
          </Button>
        </div>
      </header>

      {notice ? (
        <p className="workspace-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="workspace-metrics workspace-metrics--compact">
        <article className="ui-metric">
          <span className="ui-metric__label">全部作品</span>
          <strong className="ui-metric__value font-mono">{works.length}</strong>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">评审中</span>
          <strong className="ui-metric__value font-mono">
            {works.filter((work) => work.status === 'reviewing').length}
          </strong>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">已评分</span>
          <strong className="ui-metric__value font-mono">
            {works.filter((work) => work.status === 'scored').length}
          </strong>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">需补充</span>
          <strong className="ui-metric__value font-mono">
            {works.filter((work) => work.status === 'changes_requested').length}
          </strong>
        </article>
      </div>

      <div className="workspace-toolbar">
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
        <span className="workspace-muted">
          命题上限 {WORKSPACE_SEASON.maxChallengesPerProject} 个 · 1 积分 = ¥1
        </span>
      </div>

      <section className="ui-panel workspace-panel">
        <WorkList works={filtered} showProject emptyTitle="这个筛选下没有作品" />
      </section>

      <SubmitWorkDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export function SeasonChallengeConfig() {
  return (
    <section className="ui-panel workspace-panel">
      <header className="workspace-panel__head">
        <div>
          <Eyebrow>CHALLENGE CONFIG / 命题配置</Eyebrow>
          <h3>本季命题与提交要求</h3>
        </div>
        <span className="workspace-muted">1 积分 = ¥1 · 作品截止 {WORKSPACE_SEASON.workDeadline}</span>
      </header>
      <div className="workspace-challenge-grid">
        {WORKSPACE_CHALLENGES.map((challenge) => (
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
                <dt>团队容量</dt>
                <dd>
                  {challenge.selected} / {challenge.capacity} 个项目
                </dd>
              </div>
            </dl>
            <Link href={`/challenges/${challenge.id === 'c1' ? 1 : challenge.id === 'c2' ? 2 : challenge.id === 'c3' ? 3 : 4}`} className="workspace-link">
              查看命题详情 <span aria-hidden>→</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
