'use client'

import { useId, useMemo, useState } from 'react'
import { SEASON_RULE_LIMITS } from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import { ChipButton } from '@/components/ui/chip'
import {
  CheckboxInput,
  FieldError,
  FormField,
  SelectInput,
  TextArea,
  TextInput,
  useFieldDescription,
} from '@/components/submit/form-fields'
import {
  SCHEDULE_FIELDS,
  validateSeasonDraft,
  type OrganizerOrg,
  type SeasonDraftErrors,
  type SeasonDraftValues,
} from '@/lib/organizer'

/**
 * 赛季草稿表单。
 *
 * 字段对齐 `seasons` 表的全部业务列；`status / approvedAt / submittedAt /
 * pinned / createdBy / rulesVersion` 这类状态与元数据列**不在表单里** ——
 * 新建草稿永远是 `draft`，发布状态只能通过“提交待批 → 批准”流转。
 *
 * 三种用法共用这一张表单（差异只有文案与编号是否只读）：
 *   · `create` —— 空白草稿，提交走 `POST /seasons`；
 *   · `copy`   —— 以上一季为模板，同样提交走 `POST /seasons`；
 *   · `edit`   —— 回填当前赛季，提交走更新（`PATCH` + 若干 `PUT`）。
 * 具体发什么请求由调用方通过 `onSubmit` 决定 —— 表单只负责校验、pending 与
 * 把后端错误摆到字段上，这样三种语义共用同一套校验，不会出现「新建拦住了、
 * 编辑没拦住」的偏差。
 *
 * 弹窗背面是主办方后台外壳，不做焦点陷阱：Esc 与“取消”都能关闭，
 * 关闭后焦点回到触发按钮（由调用方负责）。
 */

/**
 * 提交结果。`ok: false` 时由表单负责落位：
 *   · `code === 'SEASON_CODE_TAKEN'` → 编号字段单独提示；
 *   · `field` 有值 → 把 `message` 挂到对应字段；
 *   · 其余 → 表单级错误条原样展示后端文案。
 */
export type SeasonDraftSubmitResult =
  | { ok: true }
  | { ok: false; message: string; field?: string; code?: string }

/**
 * 计分口径三项的输入转换：空串 = `null`（本季不计分），其余转数字。
 *
 * 不用 `Number('')`（= 0）是因为「留空」和「填 0」在语义上都表示不计分，
 * 但留空必须是 `null`，否则输入框会被 `0` 填满，看起来像已经配了 0 分上限。
 */
function emptyOrNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return Number(trimmed)
}

/** 只读控件：编辑模式下编号不可改（后端 `PATCH` 不接受 `code`）。 */
function ReadOnlyInput({
  id,
  name,
  value,
}: {
  id: string
  name: string
  value: string
}) {
  const describedBy = useFieldDescription()
  return (
    <input
      id={id}
      name={name}
      value={value}
      readOnly
      aria-readonly
      className="ui-input cursor-not-allowed opacity-70"
      {...describedBy}
    />
  )
}

export function SeasonDraftForm({
  value,
  onChange,
  organizerOrgOptions,
  mode,
  sourceSeasonName,
  onSubmit,
  onCancel,
}: {
  value: SeasonDraftValues
  onChange: (next: SeasonDraftValues) => void
  organizerOrgOptions: OrganizerOrg[]
  /** `create` 新建空白草稿；`copy` 以上一季为模板；`edit` 更新当前赛季。 */
  mode: 'create' | 'copy' | 'edit'
  sourceSeasonName?: string
  /**
   * 真正的提交动作（发什么请求由调用方决定）。
   *
   * 不传时退化成「只校验不发请求」—— 这是给纯表单测试与将来嵌入其它流程留的
   * 安全默认值；Header 与草稿编辑弹窗都显式传了它。
   */
  onSubmit?: (values: SeasonDraftValues) => Promise<SeasonDraftSubmitResult>
  onCancel: () => void
}) {
  const uid = useId()
  const [themeInput, setThemeInput] = useState('')
  const [errors, setErrors] = useState<SeasonDraftErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const allowedOrgIds = useMemo(
    () => organizerOrgOptions.map((org) => org.id),
    [organizerOrgOptions],
  )

  const set = <K extends keyof SeasonDraftValues>(key: K, next: SeasonDraftValues[K]) => {
    onChange({ ...value, [key]: next })
  }
  const setSchedule = (key: keyof SeasonDraftValues['schedule'], next: string) => {
    onChange({ ...value, schedule: { ...value.schedule, [key]: next } })
  }
  const setRule = <K extends keyof SeasonDraftValues['rules']>(
    key: K,
    next: SeasonDraftValues['rules'][K],
  ) => {
    onChange({ ...value, rules: { ...value.rules, [key]: next } })
  }
  /** 错误值是空串时不要当成“有错误”，FormField 只认非空文案。 */
  const errorOf = (key: string) => errors[key] || undefined

  function addTheme() {
    const theme = themeInput.trim()
    if (!theme) return
    setThemeInput('')
    if (value.themes.includes(theme)) return
    if (value.themes.length >= 20) {
      setErrors((current) => ({ ...current, themes: '主题最多 20 个' }))
      return
    }
    set('themes', [...value.themes, theme])
    setErrors((current) => ({ ...current, themes: '' }))
  }

  function toggleOrg(orgId: number) {
    set(
      'organizerOrgIds',
      value.organizerOrgIds.includes(orgId)
        ? value.organizerOrgIds.filter((item) => item !== orgId)
        : [...value.organizerOrgIds, orgId],
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateSeasonDraft(value, { organizerOrgOptions: allowedOrgIds })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先补全表单中标红的字段')
      return
    }

    setPending(true)
    const result = await onSubmit?.(value)
    setPending(false)

    // 没有传 onSubmit：校验通过就算「完成」，不制造假的成功提示。
    if (!result || result.ok) return

    if (result.code === 'SEASON_CODE_TAKEN') {
      setErrors((current) => ({ ...current, code: '该赛季编号已存在，换一个' }))
      setFormError('赛季编号已被占用')
      return
    }
    if (result.field) {
      setErrors((current) => ({ ...current, [result.field!]: result.message }))
    }
    // 后端文案原样展示，不吞错误、也不改写成泛泛的「保存失败」。
    setFormError(result.message)
  }

  const id = (name: string) => `${uid}-${name}`

  return (
    <form onSubmit={handleSubmit} className="grid gap-6" noValidate aria-label="赛季草稿表单">
      <p className="rounded-md border border-brand bg-brand-wash px-4 py-3 text-body-sm text-brand-text">
        {mode === 'edit' ? (
          <>
            保存后<strong>直接更新当前赛季</strong>，不会新建赛季；赛程与规则有变化时会一并提交，
            并自动生成公告与规则版本。
          </>
        ) : (
          <>
            新建的赛季会存为<strong>草稿</strong>，不会直接发布；赛程、命题、预算可以之后再补。
            {mode === 'copy' && sourceSeasonName
              ? `当前以上一季「${sourceSeasonName}」为模板，编号与赛程需要重新填写。`
              : null}
          </>
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="赛季编号"
          htmlFor={id('code')}
          required
          error={errorOf('code')}
          hint={
            mode === 'edit'
              ? '编号创建后不可修改'
              : '字母 / 数字 / 下划线 / 连字符，创建后不可修改'
          }
        >
          {mode === 'edit' ? (
            <ReadOnlyInput id={id('code')} name="code" value={value.code} />
          ) : (
            <TextInput
              id={id('code')}
              name="code"
              value={value.code}
              onChange={(next) => set('code', next)}
              placeholder="BL2027A"
              maxLength={32}
            />
          )}
        </FormField>
        <FormField label="赛季名称" htmlFor={id('name')} required error={errorOf('name')}>
          <TextInput
            id={id('name')}
            name="name"
            value={value.name}
            onChange={(next) => set('name', next)}
            placeholder="2027 春季赛季"
            maxLength={255}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="赛季类型" htmlFor={id('type')} required>
          <SelectInput
            id={id('type')}
            name="type"
            value={value.type}
            onChange={(next) => set('type', next === 'hackathon' ? 'hackathon' : 'season')}
            options={[
              { value: 'season', label: '赛季' },
              { value: 'hackathon', label: '黑客松' },
            ]}
          />
        </FormField>
        <FormField
          label={value.type === 'hackathon' ? '城市（黑客松必填）' : '城市'}
          htmlFor={id('city')}
          required={value.type === 'hackathon'}
          error={errorOf('city')}
        >
          <TextInput
            id={id('city')}
            name="city"
            value={value.city}
            onChange={(next) => set('city', next)}
            placeholder="上海"
            maxLength={100}
          />
        </FormField>
      </div>

      <FormField label="赛季介绍" htmlFor={id('intro')} hint="公开页展示的简介，最多 5000 字">
        <TextArea
          id={id('intro')}
          name="intro"
          value={value.intro}
          onChange={(next) => set('intro', next)}
          rows={3}
          maxLength={5000}
        />
      </FormField>

      <FormField
        label="赛季主题"
        htmlFor={id('themes')}
        group
        error={errorOf('themes')}
        hint="报名时可以选择的主题方向，最多 20 个"
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={id('themes')}
            name="theme"
            value={themeInput}
            onChange={(event) => setThemeInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              // 回车加主题，而不是提交整个表单。
              event.preventDefault()
              addTheme()
            }}
            className="ui-input max-w-60"
            placeholder="输入后按回车添加"
            maxLength={50}
          />
          <Button variant="secondary" size="sm" onClick={addTheme} disabled={!themeInput.trim()}>
            添加
          </Button>
        </div>
        {value.themes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {value.themes.map((theme) => (
              <ChipButton
                key={theme}
                tone="accent"
                aria-label={`移除主题 ${theme}`}
                onClick={() => set('themes', value.themes.filter((item) => item !== theme))}
              >
                {theme} <span aria-hidden>×</span>
              </ChipButton>
            ))}
          </div>
        ) : (
          <p className="ui-hint">还没有主题</p>
        )}
      </FormField>

      <FormField
        label="主办方组织"
        htmlFor={id('organizer-orgs')}
        group
        required
        error={errorOf('organizerOrgIds')}
        hint="可以多选；普通主办方只能选择自己是成员的组织"
      >
        {organizerOrgOptions.length === 0 ? (
          <p className="ui-hint">你还不属于任何主办方组织，请联系平台管理员加入后再建赛季。</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {organizerOrgOptions.map((org) => (
              <ChipButton
                key={org.id}
                aria-pressed={value.organizerOrgIds.includes(org.id)}
                tone={value.organizerOrgIds.includes(org.id) ? 'accent' : 'neutral'}
                onClick={() => toggleOrg(org.id)}
              >
                {org.name}
              </ChipButton>
            ))}
          </div>
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="协议版本" htmlFor={id('agreement')} required error={errorOf('agreementVersion')}>
          <TextInput
            id={id('agreement')}
            name="agreementVersion"
            value={value.agreementVersion}
            onChange={(next) => set('agreementVersion', next)}
            placeholder="v1"
            maxLength={32}
          />
        </FormField>
        <FormField label="授奖主体" htmlFor={id('awarding')} error={errorOf('awardingEntity')}>
          <TextInput
            id={id('awarding')}
            name="awardingEntity"
            value={value.awardingEntity}
            onChange={(next) => set('awardingEntity', next)}
            placeholder="SheNicest 基金会"
            maxLength={255}
          />
        </FormField>
        <FormField
          label="选手名额"
          htmlFor={id('capacity')}
          error={errorOf('participantCapacity')}
          hint="留空表示不限"
        >
          <TextInput
            id={id('capacity')}
            name="participantCapacity"
            type="number"
            value={value.participantCapacity}
            onChange={(next) => set('participantCapacity', next)}
            placeholder="不限"
            min={1}
            max={100000}
          />
        </FormField>
      </div>

      <fieldset className="grid gap-4">
        <legend className="ui-label mb-1">赛程（可稍后填写）</legend>
        <p className="ui-hint -mt-2">要么全部留空，要么八个节点都填；时间必须严格递增。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCHEDULE_FIELDS.map((field) => (
            <FormField
              key={field.key}
              label={field.label}
              htmlFor={id(`schedule-${field.key}`)}
              error={errorOf(`schedule.${field.key}`)}
            >
              <TextInput
                id={id(`schedule-${field.key}`)}
                name={field.key}
                type="datetime-local"
                value={value.schedule[field.key]}
                onChange={(next) => setSchedule(field.key, next)}
              />
            </FormField>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="ui-label mb-1">规则</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="每个项目可选命题上限"
            htmlFor={id('rule-challenges')}
            error={errorOf('rules.maxChallengesPerProject')}
          >
            <TextInput
              id={id('rule-challenges')}
              name="maxChallengesPerProject"
              type="number"
              value={String(value.rules.maxChallengesPerProject)}
              onChange={(next) => setRule('maxChallengesPerProject', Number(next))}
              min={SEASON_RULE_LIMITS.maxChallengesPerProject.min}
              max={SEASON_RULE_LIMITS.maxChallengesPerProject.max}
            />
          </FormField>
          <FormField
            label="每人最多参与项目数"
            htmlFor={id('rule-projects')}
            error={errorOf('rules.maxProjectsPerParticipant')}
          >
            <TextInput
              id={id('rule-projects')}
              name="maxProjectsPerParticipant"
              type="number"
              value={String(value.rules.maxProjectsPerParticipant)}
              onChange={(next) => setRule('maxProjectsPerParticipant', Number(next))}
              min={SEASON_RULE_LIMITS.maxProjectsPerParticipant.min}
              max={SEASON_RULE_LIMITS.maxProjectsPerParticipant.max}
            />
          </FormField>
          <FormField
            label="团队核心成员上限"
            htmlFor={id('rule-members')}
            error={errorOf('rules.maxCoreMembers')}
          >
            <TextInput
              id={id('rule-members')}
              name="maxCoreMembers"
              type="number"
              value={String(value.rules.maxCoreMembers)}
              onChange={(next) => setRule('maxCoreMembers', Number(next))}
              min={SEASON_RULE_LIMITS.maxCoreMembers.min}
              max={SEASON_RULE_LIMITS.maxCoreMembers.max}
            />
          </FormField>
          <FormField
            label="单次评分上限"
            htmlFor={id('rule-cap')}
            hint="留空或填 0 表示本季不计分"
            error={errorOf('rules.singleWorkCap')}
          >
            <TextInput
              id={id('rule-cap')}
              name="singleWorkCap"
              type="number"
              value={value.rules.singleWorkCap === null ? '' : String(value.rules.singleWorkCap)}
              onChange={(next) => setRule('singleWorkCap', emptyOrNumber(next))}
              min={SEASON_RULE_LIMITS.singleWorkCap.min}
              max={SEASON_RULE_LIMITS.singleWorkCap.max}
            />
          </FormField>
          <FormField
            label="积分兑换比例"
            htmlFor={id('rule-ratio')}
            hint="留空或填 0 表示本季不计分"
            error={errorOf('rules.exchangeRatio')}
          >
            <TextInput
              id={id('rule-ratio')}
              name="exchangeRatio"
              type="number"
              value={value.rules.exchangeRatio === null ? '' : String(value.rules.exchangeRatio)}
              onChange={(next) => setRule('exchangeRatio', emptyOrNumber(next))}
              min={SEASON_RULE_LIMITS.exchangeRatio.min}
              max={SEASON_RULE_LIMITS.exchangeRatio.max}
            />
          </FormField>
          <FormField
            label="大额复核阈值"
            htmlFor={id('rule-threshold')}
            hint="留空或填 0 表示本季不计分"
            error={errorOf('rules.reviewThreshold')}
          >
            <TextInput
              id={id('rule-threshold')}
              name="reviewThreshold"
              type="number"
              value={value.rules.reviewThreshold === null ? '' : String(value.rules.reviewThreshold)}
              onChange={(next) => setRule('reviewThreshold', emptyOrNumber(next))}
              min={SEASON_RULE_LIMITS.reviewThreshold.min}
              max={SEASON_RULE_LIMITS.reviewThreshold.max}
            />
          </FormField>
        </div>
        <div className="ui-field">
          <CheckboxInput
            id={id('rule-quota')}
            name="dailyQuotaEnabled"
            checked={value.rules.dailyQuotaEnabled}
            onChange={(next) => setRule('dailyQuotaEnabled', next)}
          >
            启用每日评分限额
          </CheckboxInput>
        </div>
      </fieldset>

      <FieldError>{formError}</FieldError>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === 'edit' ? '保存中…' : '创建中…'
            : mode === 'edit' ? '保存修改' : '创建草稿'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          取消
        </Button>
      </div>
    </form>
  )
}
