'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  SEASON_RULE_CARD_SCORELESS,
  SEASON_RULE_LIMITS,
  type SeasonRules,
} from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import {
  CheckboxInput,
  FormField,
  TextInput,
} from '@/components/submit/form-fields'
import { validateRulesForm } from '@/lib/organizer-rules'

/** 规则里的数值字段（`dailyQuotaEnabled` 之外的全部）。 */
type NumericRuleKey = {
  [K in keyof SeasonRules]: SeasonRules[K] extends number | null ? K : never
}[keyof SeasonRules]

/**
 * 计分口径三项：`null` 或 `0` 都表示「本季不计分」，所以输入可以留空。
 *
 * 其余四项（命题上限 / 每人项目数 / 团队人数）是必填整数，空串交给
 * `validateRulesForm` 报错，不静默变成 0。
 */
const SCORELESS_RULE_KEYS = ['singleWorkCap', 'exchangeRatio', 'reviewThreshold'] as const
type ScorelessRuleKey = (typeof SCORELESS_RULE_KEYS)[number]

function isScorelessRuleKey(key: NumericRuleKey): key is ScorelessRuleKey {
  return (SCORELESS_RULE_KEYS as readonly string[]).includes(key)
}

/**
 * 「修改规则」弹窗：编辑 `SeasonRules` 的七个类型化字段。
 *
 * 这些规则会被后端 `updateRules` 校验（开赛后不能再改），所以前端照
 * `SEASON_RULE_LIMITS` 做同一套范围校验，只负责把明显填错的挡在提交之前。
 *
 * 契约：保存走 `onSave(rules)`，返回 `{ ok, message? }`。
 *   · `ok: false` → 顶部 role="alert" 显示 message，弹窗保持打开；
 *   · `ok: true`  → 关闭由父级负责（父级在 onSave 里关闭），这里只清 pending。
 *
 * 公告不在这个弹窗里填：公告由父级在保存成功后统一处理，保持契约不变。
 */
export function SeasonRulesDialog({
  rules,
  onCancel,
  onSave,
}: {
  rules: SeasonRules
  onCancel: () => void
  onSave: (rules: SeasonRules) => Promise<{ ok: boolean; message?: string }>
}) {
  const uid = useId()
  const [draft, setDraft] = useState<SeasonRules>(rules)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const cancelRef = useRef(onCancel)
  const titleId = `${uid}-title`

  useEffect(() => {
    cancelRef.current = onCancel
  }, [onCancel])

  // Esc 关闭；打开时把焦点移到「关闭」按钮。
  // 依赖数组为空：父级每次渲染都可能传新的 onCancel，用 ref 取最新值，
  // 否则 effect 会重跑并把焦点从用户正在输入的控件上抢走。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const id = (name: string) => `${uid}-${name}`

  function setRule<K extends keyof SeasonRules>(key: K, next: SeasonRules[K]) {
    setDraft((current) => ({ ...current, [key]: next }))
  }

  /**
   * 数字输入统一走这里。
   *
   * 计分口径三项：空串 → `null`（= 本季不计分），0 原样保留（同样是「不计分」）。
   * 其余四项：空串给 NaN，交给 `validateRulesForm` 报「必须是整数」。
   */
  function setNumberRule(key: NumericRuleKey, raw: string) {
    const trimmed = raw.trim()
    if (isScorelessRuleKey(key)) {
      const next = trimmed === '' ? null : Number(trimmed)
      setDraft((current) => ({ ...current, [key]: next }))
      return
    }
    const value = trimmed === '' ? Number.NaN : Number(trimmed)
    setDraft((current) => ({ ...current, [key]: value }))
  }

  /** 输入框的回显值：null / 非有限数给空串，其余按数字显示。 */
  function numberInputValue(value: number | null): string {
    return value !== null && Number.isFinite(value) ? String(value) : ''
  }

  const errorOf = (key: string) => errors[`rules.${key}`] || undefined

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validateRulesForm(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先修正规则里的错误')
      return
    }

    setPending(true)
    try {
      const result = await onSave(draft)
      if (!result.ok) {
        setFormError(result.message || '保存失败，请稍后重试')
      }
    } catch {
      // 父级的 onSave 自己也会捕获网络错误；这里兜底，避免按钮永远停在「保存中…」。
      setFormError('保存失败，请稍后重试')
    } finally {
      setPending(false)
    }
  }

  const limits = SEASON_RULE_LIMITS
  /** 必填整数：下限 1，空串报错。 */
  const integerFields = [
    {
      key: 'maxChallengesPerProject' as const,
      label: '每个项目可选命题上限',
      limit: limits.maxChallengesPerProject,
      hint: '单个项目最多能挂几个命题（1—3）',
    },
    {
      key: 'maxProjectsPerParticipant' as const,
      label: '每人最多参与项目数',
      limit: limits.maxProjectsPerParticipant,
      hint: '同一参赛者同期最多参与几个项目（1—20）',
    },
    {
      key: 'maxCoreMembers' as const,
      label: '团队核心成员上限',
      limit: limits.maxCoreMembers,
      hint: '核心团队成员人数上限（1—3），外部共建者不计入',
    },
  ]

  /** 计分口径三项：留空或填 0 = 本季不计分。 */
  const scorelessFields = [
    {
      key: 'singleWorkCap' as const,
      label: '单次评分上限',
      limit: limits.singleWorkCap,
      hint: '单次评分最高可得积分；留空或填 0 表示本季不计分',
    },
    {
      key: 'exchangeRatio' as const,
      label: '积分兑换比例',
      limit: limits.exchangeRatio,
      hint: '1 积分可兑换的金额；留空或填 0 表示本季不计分',
    },
    {
      key: 'reviewThreshold' as const,
      label: '复核阈值',
      limit: limits.reviewThreshold,
      hint: '达到该分值需要人工复核；留空或填 0 表示本季不计分',
    },
  ]

  return (
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
              修改规则
            </h2>
            <p className="mt-2 text-body-sm text-muted-foreground">
              类型化规则会写进规则卡摘要，开赛后不能再改。
            </p>
            <p className="ui-hint mt-2">
              单次评分上限、兑换比例、复核阈值三项留空或填 0 表示{SEASON_RULE_CARD_SCORELESS}。
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            className="ui-btn ui-btn--ghost ui-btn--small"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-5" noValidate aria-label="赛季规则表单">
          <div className="grid gap-4 sm:grid-cols-2">
            {integerFields.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                htmlFor={id(field.key)}
                hint={field.hint}
                error={errorOf(field.key)}
              >
                <TextInput
                  id={id(field.key)}
                  name={field.key}
                  type="number"
                  value={numberInputValue(draft[field.key])}
                  onChange={(next) => setNumberRule(field.key, next)}
                  min={field.limit.min}
                  max={field.limit.max}
                />
              </FormField>
            ))}

            {scorelessFields.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                htmlFor={id(field.key)}
                hint={field.hint}
                error={errorOf(field.key)}
              >
                <TextInput
                  id={id(field.key)}
                  name={field.key}
                  type="number"
                  value={numberInputValue(draft[field.key])}
                  onChange={(next) => setNumberRule(field.key, next)}
                  min={field.limit.min}
                  max={field.limit.max}
                />
              </FormField>
            ))}
          </div>

          <div className="ui-field">
            <CheckboxInput
              id={id('dailyQuotaEnabled')}
              name="dailyQuotaEnabled"
              checked={draft.dailyQuotaEnabled}
              onChange={(next) => setRule('dailyQuotaEnabled', next)}
            >
              启用每日评分限额
            </CheckboxInput>
            <p className="ui-hint">开启后每名评委每天可评分的次数受限。</p>
          </div>

          {formError ? (
            <p role="alert" className="ui-field-error">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : '保存规则'}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
