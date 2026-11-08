'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CHALLENGE_CARD_LIMITS,
  CHALLENGE_SCORING_WEIGHT_MAX,
  CHALLENGE_SCORING_WEIGHT_TOTAL,
} from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import {
  FieldError,
  FormField,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import {
  CHALLENGE_RIGHTS_FORM_FIELDS,
  SCORING_WEIGHT_OPTIONS,
  challengeDetailDraftFromRow,
  scoringWeightsAreEmpty,
  scoringWeightsTotal,
  scoringWeightsTotalHint,
  toChallengeDetailPayload,
  validateChallengeDetailDraft,
  validateScoringWeights,
  type ChallengeDetailErrors,
  type ChallengeDetailValues,
  type ChallengeDto,
} from '@/lib/organizer-challenges'
import { updateChallenge } from '@/lib/organizer-challenges-api'

/**
 * 命题详情表单（命题卡内容 / 评分与奖励 / 公开与权益）。
 *
 * 三段与公开命题详情页的 tab 一一对应，方便主办方对照「选手会看到什么」：
 *   01 命题卡内容 → 02 评分与奖励 → 03 公开与权益。
 *
 * 几个刻意的取舍：
 *   · **没有必填项**：契约 §1.1 说这些字段都不进发布门槛（发布仍只看五件套），
 *     所以表单允许只填一半就保存 —— 详情是「逐步补全」的信息，不是门槛；
 *   · **权重用字符串**：输入框要保留「12 打了一半」的中间态；空串 = 该维 0；
 *     五维全空 = 未配置（保存时落 null，按等权），不伪造一份默认权重；
 *   · **合计 ≠ 100 时禁用保存**：后端会 400（`scoringWeights` 合计必须 100），
 *     提前拦住比提交后再解释一遍省事；提示里给出「还差 / 超出」多少；
 *   · **权益七项分开**：合成一段自由文本会让某一项在公开页里消失（CHG-006）；
 *   · **变更说明只写版本记录**：不进 `challenges` 表，留空时后端自动生成说明。
 */
export function ChallengeDetailForm({
  challenge,
  onCancel,
  onSaved,
}: {
  /** 编辑对象：命题库的一行（含新增字段；后端未上线时字段缺省）。 */
  challenge: ChallengeDto
  onCancel: () => void
  onSaved: () => void
}) {
  const router = useRouter()
  const uid = useId()

  const [values, setValues] = useState<ChallengeDetailValues>(() =>
    challengeDetailDraftFromRow(challenge),
  )
  const [errors, setErrors] = useState<ChallengeDetailErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const id = (name: string) => `${uid}-${name}`
  const set = <K extends keyof ChallengeDetailValues>(
    key: K,
    next: ChallengeDetailValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: next }))
  }
  /** 错误值是空串时不要当成「有错误」，FormField 只认非空文案。 */
  const errorOf = (key: keyof ChallengeDetailValues) => {
    const value = errors[key as keyof ChallengeDetailErrors]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  const weightsTotal = scoringWeightsTotal(values.weights)
  const weightsUnconfigured = scoringWeightsAreEmpty(values.weights)
  const weightsBalanced = weightsUnconfigured || weightsTotal === CHALLENGE_SCORING_WEIGHT_TOTAL
  const weightsHint = scoringWeightsTotalHint(values.weights)
  /**
   * 单维格式错误**实时**显示，不等提交。
   *
   * 合计 ≠ 100 时保存按钮本来就是禁用的 —— 如果格式错误也要等提交才出现，
   * 主办方会卡在「按钮点不动、又不知道哪一维填错了」的死角里。
   * 合计错误（`errors.weights`）仍然只在提交后出现：打字过程中报「合计不是 100」
   * 是噪音，合计提示行已经在说这件事了。
   */
  const liveWeightErrors = validateScoringWeights(values.weights).weightOf
  const canSubmit = !pending && weightsBalanced

  function setWeight(dimension: (typeof SCORING_WEIGHT_OPTIONS)[number]['dimension'], next: string) {
    setValues((current) => ({
      ...current,
      weights: { ...current.weights, [dimension]: next },
    }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateChallengeDetailDraft(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先补全表单中标红的字段')
      return
    }

    setPending(true)
    const { error } = await updateChallenge(challenge.id, toChallengeDetailPayload(values))
    setPending(false)

    if (error) {
      const bundle = error.body.error
      // 后端把字段级错误放在 `field` 里（`scoringWeights` / `summary` / ...）。
      // 能定位到控件时就只标红那个控件，不再重复一遍整表提示。
      if (bundle.field === 'scoringWeights') {
        setErrors({ weights: bundle.message })
        return
      }
      if (bundle.field && bundle.field in values) {
        setErrors({ [bundle.field]: bundle.message } as ChallengeDetailErrors)
        return
      }
      setFormError(bundle.message || '保存失败，请稍后重试')
      return
    }

    onSaved()
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate aria-label="命题详情表单">
      {/* ---------------- 01 命题卡内容 ---------------- */}
      <fieldset className="grid gap-4">
        <legend className="eyebrow eyebrow--accent">01 命题卡内容</legend>
        <p className="text-body-sm text-muted-foreground">
          选手在命题详情页「命题卡」里看到的正文。都不是发布必填项，可以先填一半再回来补。
        </p>

        <FormField
          label="简介"
          htmlFor={id('summary')}
          error={errorOf('summary')}
          hint={`标题下面那一句，最多 ${CHALLENGE_CARD_LIMITS.summary.max} 字`}
        >
          <TextInput
            id={id('summary')}
            name="summary"
            value={values.summary}
            onChange={(next) => set('summary', next)}
            placeholder="例如：谁会为一台 100–200 kWh 的储能柜付第一笔钱？"
            maxLength={CHALLENGE_CARD_LIMITS.summary.max}
          />
        </FormField>

        <FormField
          label="背景"
          htmlFor={id('background')}
          error={errorOf('background')}
          hint={`最多 ${CHALLENGE_CARD_LIMITS.background.max} 字`}
        >
          <TextArea
            id={id('background')}
            name="background"
            value={values.background}
            onChange={(next) => set('background', next)}
            rows={4}
            maxLength={CHALLENGE_CARD_LIMITS.background.max}
          />
        </FormField>

        <FormField
          label="目标客户 / 产业对象"
          htmlFor={id('industry')}
          error={errorOf('industry')}
          hint={`最多 ${CHALLENGE_CARD_LIMITS.industry.max} 字`}
        >
          <TextInput
            id={id('industry')}
            name="industry"
            value={values.industry}
            onChange={(next) => set('industry', next)}
            maxLength={CHALLENGE_CARD_LIMITS.industry.max}
          />
        </FormField>

        <FormField
          label="范围"
          htmlFor={id('scope')}
          error={errorOf('scope')}
          hint={`最多 ${CHALLENGE_CARD_LIMITS.scope.max} 字`}
        >
          <TextArea
            id={id('scope')}
            name="scope"
            value={values.scope}
            onChange={(next) => set('scope', next)}
            rows={3}
            maxLength={CHALLENGE_CARD_LIMITS.scope.max}
          />
        </FormField>

        <FormField
          label="不做什么"
          htmlFor={id('outOfScope')}
          error={errorOf('outOfScope')}
          hint={`把边界写清楚能挡掉一半跑偏的方案，最多 ${CHALLENGE_CARD_LIMITS.outOfScope.max} 字`}
        >
          <TextArea
            id={id('outOfScope')}
            name="outOfScope"
            value={values.outOfScope}
            onChange={(next) => set('outOfScope', next)}
            rows={3}
            maxLength={CHALLENGE_CARD_LIMITS.outOfScope.max}
          />
        </FormField>

        <FormField
          label="一个月最小成果"
          htmlFor={id('monthlyGoal')}
          error={errorOf('monthlyGoal')}
          hint={`第一个月要做到什么程度，最多 ${CHALLENGE_CARD_LIMITS.monthlyGoal.max} 字`}
        >
          <TextArea
            id={id('monthlyGoal')}
            name="monthlyGoal"
            value={values.monthlyGoal}
            onChange={(next) => set('monthlyGoal', next)}
            rows={3}
            maxLength={CHALLENGE_CARD_LIMITS.monthlyGoal.max}
          />
        </FormField>

        <FormField
          label="建议技能"
          htmlFor={id('suggestedSkills')}
          error={errorOf('suggestedSkills')}
          hint={`逗号或顿号分隔，最多 ${CHALLENGE_CARD_LIMITS.suggestedSkills.max} 条、每条 ${CHALLENGE_CARD_LIMITS.suggestedSkills.itemMax} 字`}
        >
          <TextInput
            id={id('suggestedSkills')}
            name="suggestedSkills"
            value={values.suggestedSkills}
            onChange={(next) => set('suggestedSkills', next)}
            placeholder="例如：储能系统、数据分析、硬件集成"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="团队容量"
            htmlFor={id('teamCapacity')}
            error={errorOf('teamCapacity')}
            hint="该命题下最多几个项目团队，留空表示不限"
          >
            <TextInput
              id={id('teamCapacity')}
              name="teamCapacity"
              type="number"
              value={values.teamCapacity}
              onChange={(next) => set('teamCapacity', next)}
              placeholder="不限"
              min={CHALLENGE_CARD_LIMITS.teamCapacity.min}
              max={CHALLENGE_CARD_LIMITS.teamCapacity.max}
            />
          </FormField>

          <FormField
            label="负责人"
            htmlFor={id('ownerName')}
            error={errorOf('ownerName')}
            hint="企业侧对接人"
          >
            <TextInput
              id={id('ownerName')}
              name="ownerName"
              value={values.ownerName}
              onChange={(next) => set('ownerName', next)}
              maxLength={CHALLENGE_CARD_LIMITS.ownerName.max}
            />
          </FormField>

          <FormField
            label="响应时限"
            htmlFor={id('responseSla')}
            error={errorOf('responseSla')}
            hint="例如：工作日 48 小时内"
          >
            <TextInput
              id={id('responseSla')}
              name="responseSla"
              value={values.responseSla}
              onChange={(next) => set('responseSla', next)}
              maxLength={CHALLENGE_CARD_LIMITS.responseSla.max}
            />
          </FormField>
        </div>
      </fieldset>

      {/* ---------------- 02 评分与奖励 ---------------- */}
      <fieldset className="grid gap-4 border-t border-border pt-6">
        <legend className="eyebrow eyebrow--accent">02 评分与奖励</legend>
        <p className="text-body-sm text-muted-foreground">
          五维权重合计必须等于 100；全部留空表示未配置，评分时按等权引导。
        </p>

        <div className="grid gap-3 sm:grid-cols-5">
          {SCORING_WEIGHT_OPTIONS.map((option) => (
            <FormField
              key={option.dimension}
              label={option.label}
              htmlFor={id(`weight-${option.dimension}`)}
              error={liveWeightErrors[option.dimension]}
            >
              <TextInput
                id={id(`weight-${option.dimension}`)}
                name={`weight-${option.dimension}`}
                type="number"
                value={values.weights[option.dimension]}
                onChange={(next) => setWeight(option.dimension, next)}
                min={0}
                max={CHALLENGE_SCORING_WEIGHT_MAX}
              />
            </FormField>
          ))}
        </div>

        {/* 实时合计：合计正确时只报数字，不等于 100 时用错误样式醒目提示。 */}
        <p
          role="status"
          aria-live="polite"
          className={
            weightsBalanced
              ? 'font-mono text-meta text-muted-foreground'
              : 'ui-field-error font-mono'
          }
          data-weights-total={weightsTotal}
        >
          {weightsUnconfigured
            ? '未配置权重（保存后按等权）'
            : `五维权重合计 ${weightsTotal} / ${CHALLENGE_SCORING_WEIGHT_TOTAL}`}
          {weightsHint ? ` · ${weightsHint}` : null}
        </p>
        <FieldError>{errors.weights}</FieldError>

        <FormField
          label="单次评分上限"
          htmlFor={id('singleWorkCap')}
          error={errorOf('singleWorkCap')}
          hint={`本命题一次评分的上限，留空则用赛季上限（${CHALLENGE_CARD_LIMITS.singleWorkCap.min}–${CHALLENGE_CARD_LIMITS.singleWorkCap.max}）`}
        >
          <TextInput
            id={id('singleWorkCap')}
            name="singleWorkCap"
            type="number"
            value={values.singleWorkCap}
            onChange={(next) => set('singleWorkCap', next)}
            placeholder="用赛季上限"
            min={CHALLENGE_CARD_LIMITS.singleWorkCap.min}
            max={CHALLENGE_CARD_LIMITS.singleWorkCap.max}
          />
        </FormField>
      </fieldset>

      {/* ---------------- 03 公开与权益 ---------------- */}
      <fieldset className="grid gap-4 border-t border-border pt-6">
        <legend className="eyebrow eyebrow--accent">03 公开与权益</legend>
        <p className="text-body-sm text-muted-foreground">
          七项分别记录、分别展示。合成一段自由文本会让某一项在公开页里消失，所以这里不合并。
        </p>

        {CHALLENGE_RIGHTS_FORM_FIELDS.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            htmlFor={id(field.key)}
            error={errorOf(field.key)}
            hint={`最多 ${CHALLENGE_CARD_LIMITS.rights.max} 字`}
          >
            <TextArea
              id={id(field.key)}
              name={field.key}
              value={values[field.key]}
              onChange={(next) => set(field.key, next)}
              rows={2}
              maxLength={CHALLENGE_CARD_LIMITS.rights.max}
            />
          </FormField>
        ))}
      </fieldset>

      {/* ---------------- 变更说明 + 提交 ---------------- */}
      <div className="grid gap-4 border-t border-border pt-6">
        <FormField
          label="变更说明"
          htmlFor={id('changeNote')}
          error={errorOf('changeNote')}
          hint="写进版本记录，方便选手看到「这次改了什么」；留空则由系统自动生成"
        >
          <TextInput
            id={id('changeNote')}
            name="changeNote"
            value={values.changeNote}
            onChange={(next) => set('changeNote', next)}
            maxLength={255}
          />
        </FormField>

        {/* 后端整表错误原样摆出来：`role="alert"` 让读屏用户在提交后立刻听到。 */}
        {formError ? (
          <p role="alert" className="ui-field-error">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSubmit}>
            {pending ? '保存中…' : '保存详情'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            取消
          </Button>
          {!weightsBalanced ? (
            <span className="text-meta text-muted-foreground">
              五维权重合计需为 {CHALLENGE_SCORING_WEIGHT_TOTAL} 才能保存
            </span>
          ) : null}
        </div>
      </div>
    </form>
  )
}
