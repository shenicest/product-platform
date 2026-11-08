'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChipButton } from '@/components/ui/chip'
import {
  FieldError,
  FormField,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import { createSeasonProject } from '@/lib/team-api'
import {
  challengeMetaLabel,
  challengeSelectable,
  emptyProjectDraft,
  projectOptionLabel,
  projectThemeOptions,
  toSeasonProjectPayload,
  unselectableChallengeHint,
  validateProjectDraft,
  type ProjectDraftErrors,
  type ProjectDraftMode,
  type ProjectDraftValues,
  type ProjectOption,
  type TeamChallengeDto,
} from '@/lib/team'

/**
 * 「发起项目」弹窗（截图 3）。
 *
 * 两种模式共用一个弹窗：
 *   · `create` —— 在赛季内新建一个长期项目并登记为赛季项目；
 *   · `bring`  —— 把我在产品共生里已有的项目带进赛季（内容不重填）。
 *
 * 顶部黄色提示条只在「我在产品共生里已经有项目」且当前是新建模式时出现 ——
 * 那正是用户可能白填一遍表单的时刻。切到带入模式后提示条自己消失，
 * 因为此刻它想表达的事情已经做完了。
 *
 * 命题只能选**已发布**的：参考资料 / 草稿会在列表里标注不可选，并在底部
 * 用一句话点名（契约 §2.2 与截图 3 的口径一致）。
 */
export function TeamProjectDialog({
  seasonId,
  seasonCode,
  themes,
  challenges,
  projects,
  maxChallengesPerProject,
  label = '发起项目',
}: {
  seasonId: number
  seasonCode: string
  /** 赛季方向（`seasons.themes`）；为空时回落到平台品类。 */
  themes: readonly string[]
  /** 本赛季全部命题（含参考资料 / 草稿）。 */
  challenges: readonly TeamChallengeDto[]
  /** 我在产品共生里已有的项目（用于「带入」）。 */
  projects: readonly ProjectOption[]
  maxChallengesPerProject: number
  /** 触发按钮文案（项目卡里是「发起项目」，空态里也是）。 */
  label?: string
}) {
  const router = useRouter()
  const uid = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const titleId = `${uid}-title`

  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<ProjectDraftValues>(() => emptyProjectDraft('create'))
  const [errors, setErrors] = useState<ProjectDraftErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const id = (name: string) => `${uid}-${name}`
  const themeOptions = projectThemeOptions(themes)
  const selectable = challenges.filter(challengeSelectable)
  const blockedHint = unselectableChallengeHint(challenges)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  /** 关闭后焦点回到触发按钮（与 `challenge-dialog-shell.tsx` 同一约定）。 */
  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function setMode(mode: ProjectDraftMode) {
    setValues((current) => ({ ...current, mode }))
    setErrors({})
    setFormError(null)
  }

  function toggleTheme(theme: string) {
    setValues((current) => ({
      ...current,
      themes: current.themes.includes(theme)
        ? current.themes.filter((item) => item !== theme)
        : [...current.themes, theme],
    }))
  }

  function toggleChallenge(challengeId: number) {
    setValues((current) => {
      const selected = current.challengeIds.includes(challengeId)
      if (selected) {
        return {
          ...current,
          challengeIds: current.challengeIds.filter((item) => item !== challengeId),
        }
      }
      // 上限到了就不再加：让「最多 N 个」在点击这一刻生效，而不是提交后才报错。
      if (current.challengeIds.length >= maxChallengesPerProject) return current
      return { ...current, challengeIds: [...current.challengeIds, challengeId] }
    })
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateProjectDraft(values, {
      maxChallengesPerProject,
      selectableChallengeIds: selectable.map((challenge) => challenge.id),
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先补全表单中标红的字段')
      return
    }

    setPending(true)
    const { error } = await createSeasonProject(seasonId, toSeasonProjectPayload(values))
    setPending(false)

    if (error) {
      const bundle = error.body.error
      // 后端把字段级错误放在 `field` 里；能定位到控件时就只标红那个控件。
      if (bundle.field && bundle.field in values) {
        setErrors({ [bundle.field]: bundle.message } as ProjectDraftErrors)
        return
      }
      setFormError(bundle.message || '发起项目失败，请稍后重试')
      return
    }

    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button ref={triggerRef} onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="ui-panel my-8 w-full max-w-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-h3 font-bold text-foreground">
                  发起项目 · {seasonCode}
                </h2>
                <p className="mt-2 text-body-sm text-muted-foreground">
                  项目会同时出现在产品共生与本赛季；内容之后在项目页继续完善。
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

            {values.mode === 'create' && projects.length > 0 ? (
              <div className="ui-note ui-note--warning mb-5 items-center justify-between gap-4">
                <p className="m-0">
                  你在产品共生里已经有「{projects[0].name}」。想用它参赛，可以直接带入赛季，不用重新建。
                </p>
                <Button variant="secondary" size="sm" onClick={() => setMode('bring')}>
                  改为带入已有项目
                </Button>
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="grid gap-4" noValidate aria-label="发起项目表单">
              {values.mode === 'bring' ? (
                <FormField
                  label="带入哪个项目"
                  htmlFor={id('project')}
                  required
                  error={errors.projectId}
                  hint="项目内容沿用产品共生里的版本，赛季只登记方向与命题"
                >
                  <SelectInput
                    id={id('project')}
                    name="projectId"
                    value={values.projectId === null ? '' : String(values.projectId)}
                    onChange={(next) =>
                      setValues((current) => ({
                        ...current,
                        projectId: next ? Number(next) : null,
                      }))
                    }
                    options={projects.map((project) => ({
                      value: String(project.id),
                      label: projectOptionLabel(project),
                    }))}
                    placeholder="选择一个已有项目"
                  />
                </FormField>
              ) : (
                <>
                  <FormField
                    label="项目名称"
                    htmlFor={id('name')}
                    required
                    error={errors.name}
                  >
                    <TextInput
                      id={id('name')}
                      name="name"
                      value={values.name}
                      onChange={(next) => setValues((current) => ({ ...current, name: next }))}
                      placeholder="例如：冷库电费管家"
                      maxLength={100}
                    />
                  </FormField>

                  <FormField
                    label="一句话介绍"
                    htmlFor={id('tagline')}
                    error={errors.tagline}
                    hint="为谁解决什么问题，一句话说清"
                  >
                    <TextArea
                      id={id('tagline')}
                      name="tagline"
                      value={values.tagline}
                      onChange={(next) =>
                        setValues((current) => ({ ...current, tagline: next }))
                      }
                      placeholder="为谁解决什么问题"
                      rows={3}
                      maxLength={200}
                    />
                  </FormField>
                </>
              )}

              <FormField
                label="领域"
                htmlFor={id('themes')}
                group
                error={errors.themes}
                hint={`可多选，最多 5 个。${themes.length > 0 ? '选项来自本赛季配置的方向' : '本赛季还没配置方向，先用平台品类'}`}
              >
                <div className="flex flex-wrap gap-2">
                  {themeOptions.map((theme) => {
                    const selected = values.themes.includes(theme)
                    return (
                      <ChipButton
                        key={theme}
                        aria-pressed={selected}
                        tone={selected ? 'accent' : 'neutral'}
                        onClick={() => toggleTheme(theme)}
                      >
                        {theme}
                      </ChipButton>
                    )
                  })}
                </div>
              </FormField>

              <FormField
                label="项目命题"
                htmlFor={id('challenges')}
                group
                required
                error={errors.challengeIds}
                hint={`可选 1—${maxChallengesPerProject} 个，平行、无主次`}
              >
                {selectable.length === 0 ? (
                  <p className="ui-hint">本赛季还没有已发布的命题，先等主办方发布。</p>
                ) : (
                  <div className="grid gap-2">
                    {selectable.map((challenge) => {
                      const selected = values.challengeIds.includes(challenge.id)
                      return (
                        <label
                          key={challenge.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-brand"
                            checked={selected}
                            onChange={() => toggleChallenge(challenge.id)}
                            aria-label={challenge.title}
                          />
                          <span className="min-w-0">
                            <span className="block text-body-sm font-bold text-foreground">
                              {challenge.title}
                            </span>
                            <span className="block font-mono text-meta text-muted-foreground">
                              {challengeMetaLabel(challenge)}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {blockedHint ? <p className="ui-hint">{blockedHint}</p> : null}
              </FormField>

              <FieldError>{formError}</FieldError>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pending}>
                  {pending ? '发布中…' : '发布为「种子」'}
                </Button>
                <Button variant="ghost" onClick={close} disabled={pending}>
                  取消
                </Button>
                {values.mode === 'bring' ? (
                  <Button variant="text" onClick={() => setMode('create')} disabled={pending}>
                    改为新建项目
                  </Button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
