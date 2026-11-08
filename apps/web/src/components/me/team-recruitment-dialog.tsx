'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import {
  FieldError,
  FormField,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import { applyToRecruitmentCard, publishRecruitmentCard } from '@/lib/team-api'
import {
  APPLICATION_MESSAGE_MAX,
  dateInputMin,
  emptyRecruitmentDraft,
  projectOptionLabel,
  toRecruitmentCardPayload,
  validateApplicationMessage,
  validateRecruitmentDraft,
  type ProjectOption,
  type RecruitmentDraftErrors,
  type RecruitmentDraftValues,
} from '@/lib/team'

/**
 * 「发布招募卡」弹窗（截图 4）。
 *
 * 招募卡（P1）出现在共鸣之地；别人申请后发起人在「我的 > 组队」里接受或婉拒。
 * 这个边界必须写在弹窗说明里 —— 否则很容易被当成「接受申请 = 加入核心团队」。
 *
 * 项目下拉默认选中当前项目：从项目卡点进来的人几乎总是给这个项目招人。
 * 角色 / 技能是逗号分隔的自由文本，提交前由 `parseCommaList` 拆成数组
 * （后端落库是数组，1—10 条、每条 ≤ 50 字）。
 */
export function TeamRecruitmentDialog({
  seasonId,
  projects,
  defaultProjectId,
  label = '发布招募卡',
}: {
  seasonId: number
  /** 可选的赛季项目（`P-011 峰谷电价计算器`）。 */
  projects: readonly ProjectOption[]
  /** 默认选中的项目（当前项目）。 */
  defaultProjectId: number | null
  label?: string
}) {
  const router = useRouter()
  const uid = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const titleId = `${uid}-title`

  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<RecruitmentDraftValues>(() =>
    emptyRecruitmentDraft(defaultProjectId),
  )
  const [errors, setErrors] = useState<RecruitmentDraftErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const id = (name: string) => `${uid}-${name}`

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function set<K extends keyof RecruitmentDraftValues>(
    key: K,
    next: RecruitmentDraftValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: next }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateRecruitmentDraft(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先补全表单中标红的字段')
      return
    }

    setPending(true)
    const { error } = await publishRecruitmentCard(seasonId, toRecruitmentCardPayload(values))
    setPending(false)

    if (error) {
      const bundle = error.body.error
      if (bundle.field && bundle.field in values) {
        setErrors({ [bundle.field]: bundle.message } as RecruitmentDraftErrors)
        return
      }
      setFormError(bundle.message || '发布失败，请稍后重试')
      return
    }

    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button ref={triggerRef} variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="ui-panel my-8 w-full max-w-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-h3 font-bold text-foreground">
                  发布招募卡
                </h2>
                <p className="mt-2 text-body-sm text-muted-foreground">
                  招募卡（P1）出现在共鸣之地。别人申请后，你在「我的 &gt; 组队」里接受或婉拒；
                  赛季核心成员仍按赛季组队规则登记。
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="ui-btn ui-btn--ghost ui-btn--small"
                aria-label="关闭"
              >
                关闭
              </button>
            </div>

            <form
              onSubmit={onSubmit}
              className="grid gap-4"
              noValidate
              aria-label="发布招募卡表单"
            >
              <FormField
                label="项目"
                htmlFor={id('project')}
                required
                error={errors.seasonProjectId}
              >
                <SelectInput
                  id={id('project')}
                  name="seasonProjectId"
                  value={values.seasonProjectId}
                  onChange={(next) => set('seasonProjectId', next)}
                  options={projects.map((project) => ({
                    value: String(project.id),
                    label: projectOptionLabel(project),
                  }))}
                  placeholder="选择项目"
                />
              </FormField>

              <FormField
                label="需要的角色"
                htmlFor={id('roles')}
                required
                error={errors.roles}
                hint="逗号分隔，最多 10 个"
              >
                <TextInput
                  id={id('roles')}
                  name="roles"
                  value={values.roles}
                  onChange={(next) => set('roles', next)}
                  placeholder="例如：前端，数据分析"
                  maxLength={200}
                />
              </FormField>

              <FormField
                label="技能关键词"
                htmlFor={id('skills')}
                error={errors.skills}
                hint="可选，逗号分隔，最多 10 个"
              >
                <TextInput
                  id={id('skills')}
                  name="skills"
                  value={values.skills}
                  onChange={(next) => set('skills', next)}
                  placeholder="例如：小程序，Python"
                  maxLength={200}
                />
              </FormField>

              <FormField
                label="说明"
                htmlFor={id('description')}
                required
                error={errors.description}
              >
                <TextArea
                  id={id('description')}
                  name="description"
                  value={values.description}
                  onChange={(next) => set('description', next)}
                  placeholder="要做什么、每周需要投入多少"
                  rows={4}
                  maxLength={2000}
                />
              </FormField>

              <FormField
                label="截止日期"
                htmlFor={id('deadline')}
                required
                error={errors.deadline}
                hint="当天 23:59 前有效"
              >
                <input
                  id={id('deadline')}
                  name="deadline"
                  type="date"
                  className="ui-input"
                  value={values.deadline}
                  min={dateInputMin()}
                  onChange={(event) => set('deadline', event.target.value)}
                  aria-invalid={errors.deadline ? true : undefined}
                  aria-describedby={errors.deadline ? `${id('deadline')}-error` : undefined}
                />
              </FormField>

              <FieldError>{formError}</FieldError>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pending}>
                  {pending ? '发布中…' : '发布'}
                </Button>
                <Button variant="ghost" onClick={close} disabled={pending}>
                  取消
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

/**
 * 「申请加入」弹窗（契约 §2.6）。
 *
 * 组队 tab 只展示**自己**的招募卡，所以这个弹窗的触发点在共鸣之地
 * （`/talents` 的招募卡上）。它放在这里而不是另开一个文件：与发布招募卡是
 * 同一张卡的两面（发布 / 申请），共用同一套弹窗外壳与校验口径。
 *
 * 申请说明是自由文本，前端只做「非空 + 长度」这一道；重复申请、卡片已关闭、
 * 不能申请自己的卡都由后端返回 409，前端原样展示那句话。
 */
export function TeamRecruitmentApplyDialog({
  cardId,
  projectName,
  roles,
  label = '申请加入',
}: {
  cardId: number
  projectName: string
  roles: readonly string[]
  label?: string
}) {
  const router = useRouter()
  const uid = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const titleId = `${uid}-title`

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const messageId = `${uid}-message`

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const validation = validateApplicationMessage(message)
    setError(validation)
    if (validation) {
      setFormError('请先补全表单中标红的字段')
      return
    }

    setPending(true)
    const { error: apiError } = await applyToRecruitmentCard(cardId, {
      message: message.trim(),
    })
    setPending(false)

    if (apiError) {
      setFormError(apiError.body.error.message || '申请失败，请稍后重试')
      return
    }

    setOpen(false)
    setMessage('')
    router.refresh()
  }

  return (
    <>
      <Button ref={triggerRef} variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="ui-panel my-8 w-full max-w-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-h3 font-bold text-foreground">
                  申请加入 · {projectName}
                </h2>
                <p className="mt-2 text-body-sm text-muted-foreground">
                  申请会发给卡片发起人，由对方决定接受或婉拒；不展示联系方式。
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="ui-btn ui-btn--ghost ui-btn--small"
                aria-label="关闭"
              >
                关闭
              </button>
            </div>

            <form
              onSubmit={onSubmit}
              className="grid gap-4"
              noValidate
              aria-label="申请加入表单"
            >
              {roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <Chip key={role} tone="accent">
                      {role}
                    </Chip>
                  ))}
                </div>
              ) : null}

              <FormField
                label="申请说明"
                htmlFor={messageId}
                required
                error={error ?? undefined}
                hint={`${APPLICATION_MESSAGE_MAX} 字以内：你是谁、能做什么`}
              >
                <TextArea
                  id={messageId}
                  name="message"
                  value={message}
                  onChange={setMessage}
                  placeholder="我是谁、能做什么"
                  rows={4}
                  maxLength={APPLICATION_MESSAGE_MAX}
                  error={error ?? undefined}
                />
              </FormField>

              <FieldError>{formError}</FieldError>
              {formError ? (
                // 重复申请 / 卡片已关闭这类后端错误：用 role="alert" 让读屏立刻播报，
                // 而不是等游标走到这段文字上（FieldError 本身没有 live region）。
                <p role="alert" className="ui-field-error">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pending}>
                  {pending ? '提交中…' : '提交申请'}
                </Button>
                <Button variant="ghost" onClick={close} disabled={pending}>
                  取消
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
