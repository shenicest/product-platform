'use client'

import { useId, useMemo, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import {
  FormField,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import {
  LONG_TERM_WORK_TYPES,
  longTermProjectById,
  type LongTermRecruitmentCard,
  type LongTermWork,
} from '@/lib/long-term-demo'
import {
  auditEntry,
  demoId,
  setDemoState,
  useDemoState,
} from '@/lib/season-demo-store'

type WorkForm = {
  projectId: string
  title: string
  type: string
  summary: string
  body: string
  publicScope: '公开' | '仅共建与核验可见'
}

type CardForm = {
  projectId: string
  roles: string
  skills: string
  description: string
  deadline: string
}

/**
 * 个人中心的「长期作品」tab。
 *
 * 对应权限矩阵的「发布作品（赛季外）」与「发布招募卡（P1）」：
 * 项目发起人 / 长期成员可以为自己的长期项目发布作品或招募卡，不依赖赛季
 * 选手身份，也不产生赛季积分。作品提交后进入产品共生审核，招募卡直接开放。
 */
export function LongTermWorks({
  userId,
  nickname,
}: {
  userId: string
  nickname: string | null
}) {
  const demo = useDemoState()
  const myProjects = useMemo(
    () =>
      demo.longTermProjects.filter(
        (project) =>
          project.ownerId === userId ||
          (nickname !== null && project.members.includes(nickname)),
      ),
    [demo.longTermProjects, nickname, userId],
  )
  const ownedProjects = useMemo(
    () => myProjects.filter((project) => project.ownerId === userId),
    [myProjects, userId],
  )
  const canPublishCard = ownedProjects.length > 0
  const myWorks = useMemo(
    () =>
      demo.longTermWorks.filter((work) =>
        myProjects.some((project) => project.id === work.projectId),
      ),
    [demo.longTermWorks, myProjects],
  )
  const myCards = useMemo(
    () =>
      demo.longTermRecruitmentCards.filter((card) =>
        myProjects.some((project) => project.id === card.projectId),
      ),
    [demo.longTermRecruitmentCards, myProjects],
  )

  const [workOpen, setWorkOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (myProjects.length === 0) {
    return (
      <div className="workspace-page">
        <header className="workspace-head">
          <div>
            <Eyebrow>LONG-TERM WORKS / 长期作品</Eyebrow>
            <h2 className="workspace-title">长期项目作品</h2>
            <p className="workspace-lead">
              不参加赛季也可以维护长期项目、发布作品和招募队友；这些作品不产生赛季积分。
            </p>
          </div>
        </header>
        <div className="workspace-empty">
          <p className="mono text-brand-text">还没有长期项目</p>
          <p>先在「提交产品」创建一个长期项目，提交审核后就可以发布作品与招募卡。</p>
          <ButtonLink href="/submit" variant="secondary">
            提交产品
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="workspace-page">
      <header className="workspace-head">
        <div>
          <Eyebrow>LONG-TERM WORKS / 长期作品</Eyebrow>
          <h2 className="workspace-title">长期项目作品</h2>
          <p className="workspace-lead">
            为长期项目持续发布作品、维护招募卡；作品进入产品共生审核，不产生赛季积分与奖金。
          </p>
        </div>
        <div className="workspace-head__meta">
          <Chip tone="accent" dot>
            长期项目
          </Chip>
          <div className="flex flex-wrap gap-2">
            {canPublishCard ? (
              <Button size="sm" variant="secondary" onClick={() => setCardOpen(true)}>
                发布招募卡
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setWorkOpen(true)}>
              发布作品
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
          <span className="ui-metric__label">长期项目</span>
          <strong className="ui-metric__value font-mono">{myProjects.length}</strong>
          <p className="ui-metric__hint">我发起或长期参与</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">长期作品</span>
          <strong className="ui-metric__value font-mono">{myWorks.length}</strong>
          <p className="ui-metric__hint">不产生赛季积分</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">招募卡</span>
          <strong className="ui-metric__value font-mono">{myCards.length}</strong>
          <p className="ui-metric__hint">在共鸣之地展示</p>
        </article>
        <article className="ui-metric">
          <span className="ui-metric__label">待审核作品</span>
          <strong className="ui-metric__value font-mono">
            {myWorks.filter((work) => work.status === 'pending_review').length}
          </strong>
          <p className="ui-metric__hint">通过后展示在产品共生</p>
        </article>
      </div>

      <div className="workspace-project-grid">
        {myProjects.map((project) => (
          <article key={project.id} className="ui-panel workspace-project-card">
            <header className="workspace-project-card__head">
              <div>
                <span className="workspace-label">
                  {project.code} · {project.ownerId === userId ? '我发起' : '我参与'}
                </span>
                <h3>{project.name}</h3>
              </div>
              <Chip tone="success">{project.stage}</Chip>
            </header>
            <p className="workspace-project-card__summary">{project.summary}</p>
            <dl className="workspace-project-card__facts">
              <div>
                <dt>长期成员</dt>
                <dd>{project.members.join(' · ')}</dd>
              </div>
              <div>
                <dt>作品</dt>
                <dd>{myWorks.filter((work) => work.projectId === project.id).length} 份</dd>
              </div>
              <div>
                <dt>招募卡</dt>
                <dd>{myCards.filter((card) => card.projectId === project.id).length} 张</dd>
              </div>
              <div>
                <dt>开始维护</dt>
                <dd>{project.createdAt}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>WORKS / 长期作品</Eyebrow>
            <h3>已发布的作品</h3>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setWorkOpen(true)}>
            发布作品
          </Button>
        </header>

        {myWorks.length > 0 ? (
          <ul className="work-list">
            {myWorks.map((work) => (
              <LongTermWorkRow key={work.id} work={work} />
            ))}
          </ul>
        ) : (
          <div className="workspace-empty">
            <p className="mono text-brand-text">还没有长期作品</p>
            <p>发布第一份作品后，它会进入产品共生审核。</p>
          </div>
        )}
      </section>

      <section className="ui-panel workspace-panel">
        <header className="workspace-panel__head">
          <div>
            <Eyebrow>RECRUITMENT / 招募卡</Eyebrow>
            <h3>长期项目招募</h3>
          </div>
          {canPublishCard ? (
            <Button size="sm" variant="secondary" onClick={() => setCardOpen(true)}>
              发布招募卡
            </Button>
          ) : (
            <span className="workspace-muted">只有项目发起人可以发布招募卡</span>
          )}
        </header>

        {myCards.length > 0 ? (
          <ul className="work-list">
            {myCards.map((card) => (
              <LongTermCardRow key={card.id} card={card} />
            ))}
          </ul>
        ) : (
          <div className="workspace-empty">
            <p className="mono text-brand-text">还没有招募卡</p>
            <p>发布招募卡后，会在共鸣之地展示并接收申请。</p>
          </div>
        )}
      </section>

      {workOpen ? (
        <LongTermWorkDialog
          projects={myProjects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
          nickname={nickname}
          onClose={() => setWorkOpen(false)}
          onSubmit={(form) => {
            const work: LongTermWork = {
              id: demoId('ltw'),
              projectId: form.projectId,
              title: form.title,
              type: form.type,
              summary: form.summary,
              body: form.body,
              publicScope: form.publicScope,
              authorName: nickname ?? '我',
              createdAt: '刚刚',
              status: 'pending_review',
            }
            setDemoState((current) => ({
              ...current,
              longTermWorks: [work, ...current.longTermWorks],
              audit: [
                auditEntry(
                  'long_term_work.published',
                  work.title,
                  '赛季外作品提交，等待产品共生审核',
                  nickname ?? '我',
                ),
                ...current.audit,
              ],
            }))
            setWorkOpen(false)
            setNotice('作品已提交，审核通过后会展示在产品共生。')
          }}
        />
      ) : null}

      {cardOpen ? (
        <LongTermCardDialog
          projects={ownedProjects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
          nickname={nickname}
          onClose={() => setCardOpen(false)}
          onSubmit={(form) => {
            const card: LongTermRecruitmentCard = {
              id: demoId('lrc'),
              projectId: form.projectId,
              roles: form.roles
                .split(/[,，、]/)
                .map((role) => role.trim())
                .filter(Boolean),
              skills: form.skills
                .split(/[,，、]/)
                .map((skill) => skill.trim())
                .filter(Boolean),
              description: form.description,
              deadline: form.deadline,
              status: 'open',
              createdAt: '刚刚',
            }
            setDemoState((current) => ({
              ...current,
              longTermRecruitmentCards: [card, ...current.longTermRecruitmentCards],
              audit: [
                auditEntry(
                  'recruitment_card.published',
                  card.roles.join('、'),
                  '长期项目招募卡发布',
                  nickname ?? '我',
                ),
                ...current.audit,
              ],
            }))
            setCardOpen(false)
            setNotice('招募卡已发布，会在共鸣之地展示。')
          }}
        />
      ) : null}
    </div>
  )
}

function LongTermWorkRow({ work }: { work: LongTermWork }) {
  return (
    <li className="work-row">
      <div className="work-row__main">
        <div className="work-row__head">
          <span className="work-row__type">{work.type}</span>
          <h4 className="work-row__title">{work.title}</h4>
          <Chip tone={work.status === 'published' ? 'success' : 'warning'}>
            {work.status === 'published' ? '已发布' : '待审核'}
          </Chip>
        </div>
        <p className="work-row__summary">{work.summary}</p>
        <div className="work-row__meta">
          <span>{work.authorName}</span>
          <span>{work.createdAt}</span>
          <span>{work.publicScope}</span>
        </div>
        <p className="work-row__note">{work.body}</p>
      </div>
    </li>
  )
}

function LongTermCardRow({ card }: { card: LongTermRecruitmentCard }) {
  return (
    <li className="work-row">
      <div className="work-row__main">
        <div className="work-row__head">
          <span className="work-row__type">招募卡</span>
          <h4 className="work-row__title">{card.roles.join(' · ') || '招募队友'}</h4>
          <Chip tone={card.status === 'open' ? 'success' : 'neutral'}>
            {card.status === 'open' ? '招募中' : '已关闭'}
          </Chip>
        </div>
        <p className="work-row__summary">{card.description}</p>
        <div className="work-row__meta">
          <span>{longTermProjectById(card.projectId)?.name ?? '长期项目'}</span>
          <span>截止 {card.deadline}</span>
          {card.skills.length > 0 ? <span>技能 · {card.skills.join('、')}</span> : null}
        </div>
      </div>
    </li>
  )
}

function LongTermWorkDialog({
  projects,
  nickname,
  onClose,
  onSubmit,
}: {
  projects: { value: string; label: string }[]
  nickname: string | null
  onClose: () => void
  onSubmit: (form: WorkForm) => void
}) {
  const id = useId()
  const [form, setForm] = useState<WorkForm>({
    projectId: projects[0]?.value ?? '',
    title: '',
    type: LONG_TERM_WORK_TYPES[0],
    summary: '',
    body: '',
    publicScope: '公开',
  })
  const [error, setError] = useState<string | null>(null)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (form.title.trim().length < 2) {
      setError('请填写作品标题（至少 2 个字）。')
      return
    }
    if (form.summary.trim().length < 8) {
      setError('摘要至少 8 个字。')
      return
    }
    if (form.body.trim().length < 12) {
      setError('正文至少 12 个字，写清楚做了什么、证据是什么。')
      return
    }
    onSubmit({
      ...form,
      title: form.title.trim(),
      summary: form.summary.trim(),
      body: form.body.trim(),
    })
  }

  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <form className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={submit}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>PUBLISH WORK / 发布作品</Eyebrow>
            <h3 id={`${id}-title`}>发布长期项目作品</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <p className="workspace-modal__hint">
          赛季外作品不产生积分与奖金；提交后进入产品共生审核，通过后展示在项目页。
        </p>
        <div className="workspace-modal__fields">
          <FormField label="所属长期项目" htmlFor={`${id}-project`} required>
            <SelectInput id={`${id}-project`} name="project" value={form.projectId} onChange={(value) => setForm({ ...form, projectId: value })} options={projects} />
          </FormField>
          <FormField label="作品类型" htmlFor={`${id}-type`} required>
            <SelectInput id={`${id}-type`} name="type" value={form.type} onChange={(value) => setForm({ ...form, type: value })} options={LONG_TERM_WORK_TYPES.map((value) => ({ value, label: value }))} />
          </FormField>
          <FormField label="标题" htmlFor={`${id}-work-title`} required>
            <TextInput id={`${id}-work-title`} name="title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          </FormField>
          <FormField label="摘要" htmlFor={`${id}-summary`} required hint="至少 8 个字">
            <TextArea id={`${id}-summary`} name="summary" value={form.summary} onChange={(value) => setForm({ ...form, summary: value })} rows={2} />
          </FormField>
          <FormField label="正文" htmlFor={`${id}-body`} required hint="至少 12 个字">
            <TextArea id={`${id}-body`} name="body" value={form.body} onChange={(value) => setForm({ ...form, body: value })} rows={4} />
          </FormField>
          <FormField label="公开范围" htmlFor={`${id}-scope`} required>
            <SelectInput
              id={`${id}-scope`}
              name="scope"
              value={form.publicScope}
              onChange={(value) => setForm({ ...form, publicScope: value as WorkForm['publicScope'] })}
              options={[
                { value: '公开', label: '公开' },
                { value: '仅共建与核验可见', label: '仅共建与核验可见' },
              ]}
            />
          </FormField>
          <p className="workspace-muted">发布人 · {nickname ?? '我'}</p>
          {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        </div>
        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit">提交作品</Button>
        </footer>
      </form>
    </div>
  )
}

function LongTermCardDialog({
  projects,
  nickname,
  onClose,
  onSubmit,
}: {
  projects: { value: string; label: string }[]
  nickname: string | null
  onClose: () => void
  onSubmit: (form: CardForm) => void
}) {
  const id = useId()
  const [form, setForm] = useState<CardForm>({
    projectId: projects[0]?.value ?? '',
    roles: '',
    skills: '',
    description: '',
    deadline: '',
  })
  const [error, setError] = useState<string | null>(null)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const roles = form.roles
      .split(/[,，、]/)
      .map((role) => role.trim())
      .filter(Boolean)
    if (roles.length === 0) {
      setError('请至少填写 1 个需要的角色。')
      return
    }
    if (form.description.trim().length < 12) {
      setError('说明至少 12 个字：要做什么、每周投入多少。')
      return
    }
    if (!form.deadline) {
      setError('请选择截止日期。')
      return
    }
    onSubmit({
      ...form,
      description: form.description.trim(),
    })
  }

  return (
    <div className="workspace-modal" role="presentation">
      <button type="button" className="workspace-modal__backdrop" aria-label="关闭" onClick={onClose} />
      <form className="workspace-modal__panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={submit}>
        <header className="workspace-modal__head">
          <div>
            <Eyebrow>RECRUITMENT CARD / 招募卡</Eyebrow>
            <h3 id={`${id}-title`}>发布长期项目招募卡</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </header>
        <p className="workspace-modal__hint">
          只有项目发起人可以发布；招募卡会展示在共鸣之地并接收申请。
        </p>
        <div className="workspace-modal__fields">
          <FormField label="所属长期项目" htmlFor={`${id}-project`} required>
            <SelectInput id={`${id}-project`} name="project" value={form.projectId} onChange={(value) => setForm({ ...form, projectId: value })} options={projects} />
          </FormField>
          <FormField label="需要的角色" htmlFor={`${id}-roles`} required hint="逗号分隔">
            <TextInput id={`${id}-roles`} name="roles" value={form.roles} onChange={(value) => setForm({ ...form, roles: value })} placeholder="前端工程师，数据分析" />
          </FormField>
          <FormField label="技能关键词" htmlFor={`${id}-skills`} hint="可选，逗号分隔">
            <TextInput id={`${id}-skills`} name="skills" value={form.skills} onChange={(value) => setForm({ ...form, skills: value })} placeholder="React，数据可视化" />
          </FormField>
          <FormField label="说明" htmlFor={`${id}-description`} required hint="至少 12 个字">
            <TextArea id={`${id}-description`} name="description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} rows={3} />
          </FormField>
          <FormField label="截止日期" htmlFor={`${id}-deadline`} required>
            <input
              id={`${id}-deadline`}
              name="deadline"
              type="date"
              className="ui-input"
              value={form.deadline}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
            />
          </FormField>
          <p className="workspace-muted">发布人 · {nickname ?? '我'}</p>
          {error ? <p className="ui-field-error" role="alert">{error}</p> : null}
        </div>
        <footer className="workspace-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit">发布招募卡</Button>
        </footer>
      </form>
    </div>
  )
}
