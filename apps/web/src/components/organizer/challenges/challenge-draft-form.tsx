'use client'

import { useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  FieldError,
  FormField,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import {
  challengeDraftFromRow,
  challengeTypeHint,
  challengeTypeOptions,
  emptyChallengeDraft,
  toChallengePayload,
  validateChallengeDraft,
  type ChallengeDraftErrors,
  type ChallengeDraftValues,
  type ChallengeDto,
} from '@/lib/organizer-challenges'
import { createChallenge, updateChallenge } from '@/lib/organizer-challenges-api'

/**
 * 命题草稿表单（新建 / 编辑共用）。
 *
 * 字段顺序按契约 §0 第 2 条：赛季名称（只读）→ 命题标题 → 类型 + 命题容量 →
 * 赛季主题 → 真实问题 → 资源需求。
 *
 * 几个刻意的取舍：
 *   · **赛季名称只读**：命题一定属于某个赛季，换赛季要重新打开页面，这里给一个
 *     不可编辑的回显，避免让人以为能在弹窗里把命题挪到别的赛季；
 *   · **只有标题必填**：五件套的其余四项是发布门槛，不是草稿门槛。草稿阶段
 *     就逼着填满五件套，等于把「先记一笔」这个动作堵死；
 *   · **主题下拉的数据源是赛季 `themes`**：没有主题时整项禁用并说明去哪儿配，
 *     而不是给一个空下拉让人反复点开；
 *   · **命题容量留空 = 不限**：与赛季名额同口径，空串转 `null`。
 */
export function ChallengeDraftForm({
  seasonId,
  seasonName,
  themes,
  mode,
  initial,
  onCancel,
  onSaved,
}: {
  seasonId: number
  seasonName: string
  /** 本赛季主题（`seasons.themes`）；空数组时主题下拉禁用。 */
  themes: readonly string[]
  mode: 'create' | 'edit'
  /** 编辑模式：用表格里的行回填。新建模式忽略。 */
  initial?: ChallengeDto | null
  onCancel: () => void
  /** 保存成功回调：父级负责关闭弹窗并刷新数据。 */
  onSaved: () => void
}) {
  const router = useRouter()
  const uid = useId()

  const [values, setValues] = useState<ChallengeDraftValues>(() =>
    mode === 'edit' && initial ? challengeDraftFromRow(initial) : emptyChallengeDraft(),
  )
  const [errors, setErrors] = useState<ChallengeDraftErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const id = (name: string) => `${uid}-${name}`
  const set = <K extends keyof ChallengeDraftValues>(key: K, next: ChallengeDraftValues[K]) => {
    setValues((current) => ({ ...current, [key]: next }))
  }
  /** 错误值是空串时不要当成“有错误”，FormField 只认非空文案。 */
  const errorOf = (key: keyof ChallengeDraftValues) => errors[key] || undefined

  const typeOptions = useMemo(() => challengeTypeOptions(), [])
  const themeOptions = useMemo(
    () => themes.map((theme) => ({ value: theme, label: theme })),
    [themes],
  )
  const typeHint = challengeTypeHint(values.type)
  const noThemes = themes.length === 0

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateChallengeDraft(values, { themes })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先补全表单中标红的字段')
      return
    }

    const payload = toChallengePayload(values)
    setPending(true)
    const { error } = mode === 'edit' && initial
      ? await updateChallenge(initial.id, payload)
      : await createChallenge(seasonId, payload)
    setPending(false)

    if (error) {
      const bundle = error.body.error
      // 后端把字段级错误放在 `field` 里（`theme` / `capacity` / `title`）。
      // 能定位到控件时就只标红那个控件，不再重复一遍整表提示 —— 同一句话
      // 在同一个弹窗里出现两次只会让人以为有两处错。
      if (bundle.field && bundle.field in values) {
        setErrors({ [bundle.field]: bundle.message } as ChallengeDraftErrors)
        return
      }
      setFormError(bundle.message || '保存失败，请稍后重试')
      return
    }

    onSaved()
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate aria-label="命题草稿表单">
      <FormField
        label="赛季名称"
        htmlFor={id('season')}
        hint="命题固定属于当前赛季，不能在这里更换"
      >
        {/* 只读回显用 ui-input + readOnly：与其它字段对齐，同时明确不可编辑。 */}
        <input
          id={id('season')}
          name="seasonName"
          value={seasonName}
          readOnly
          className="ui-input"
          aria-readonly
        />
      </FormField>

      <FormField
        label="命题标题"
        htmlFor={id('title')}
        required
        error={errorOf('title')}
        hint="2–255 个字符，选手看到的第一行"
      >
        <TextInput
          id={id('title')}
          name="title"
          value={values.title}
          onChange={(next) => set('title', next)}
          placeholder="例如：3 个站点的历史用电数据预测"
          maxLength={255}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="类型"
          htmlFor={id('type')}
          error={errorOf('type')}
          hint={typeHint ?? '类型只描述这条命题要验证什么，不参与发布门槛'}
        >
          <SelectInput
            id={id('type')}
            name="type"
            value={values.type}
            onChange={(next) => set('type', next)}
            options={typeOptions}
          />
        </FormField>

        <FormField
          label="命题容量"
          htmlFor={id('capacity')}
          error={errorOf('capacity')}
          hint="该命题下最多几个参赛项目，留空表示不限"
        >
          <TextInput
            id={id('capacity')}
            name="capacity"
            type="number"
            value={values.capacity}
            onChange={(next) => set('capacity', next)}
            placeholder="不限"
            min={1}
            max={999}
          />
        </FormField>
      </div>

      <FormField
        label="赛季主题"
        htmlFor={id('theme')}
        error={errorOf('theme')}
        hint={
          noThemes
            ? '先到「赛季设置」里添加赛季主题'
            : '从本赛季已配置的主题里选一个，不选则不计入任何主题'
        }
      >
        {/* 主题需要「没有主题时禁用」，而共享的 SelectInput 不接受 disabled；
            这里直接用同一套 `ui-select` 类，视觉与其它下拉一致。 */}
        <select
          id={id('theme')}
          name="theme"
          value={values.theme}
          onChange={(event) => set('theme', event.target.value)}
          className="ui-select"
          disabled={noThemes}
          aria-invalid={errorOf('theme') ? true : undefined}
        >
          <option value="">{noThemes ? '本赛季还没有主题' : '不指定主题'}</option>
          {themeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="真实问题"
        htmlFor={id('realProblem')}
        error={errorOf('realProblem')}
        hint="五件套之一：选手要解决的真实问题；可以之后补，发布前必须填写"
      >
        <TextArea
          id={id('realProblem')}
          name="realProblem"
          value={values.realProblem}
          onChange={(next) => set('realProblem', next)}
          rows={4}
          maxLength={20_000}
        />
      </FormField>

      <FormField
        label="资源需求"
        htmlFor={id('resourceCommitment')}
        error={errorOf('resourceCommitment')}
        hint="五件套之一（资源投入）：企业承诺提供的数据、场地、渠道、资金等；逐条兑现状态在下方「资源兑现」里维护"
      >
        <TextArea
          id={id('resourceCommitment')}
          name="resourceCommitment"
          value={values.resourceCommitment}
          onChange={(next) => set('resourceCommitment', next)}
          rows={4}
          maxLength={20_000}
        />
      </FormField>

      <FieldError>{formError}</FieldError>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? '保存中…' : mode === 'edit' ? '保存修改' : '创建草稿'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          取消
        </Button>
      </div>
    </form>
  )
}
