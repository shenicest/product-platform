'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { SeasonType } from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import { ChipButton } from '@/components/ui/chip'
import {
  FieldError,
  FormField,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import { updateSeasonCore, updateSeasonOrganizers } from '@/lib/organizer-settings-api'
import { MAX_SEASON_THEMES, MAX_SEASON_THEME_LENGTH } from '@/lib/organizer-themes'
import type { OrganizerOrg, SeasonManageDetail } from '@/lib/organizer'

/**
 * 「编辑赛季信息」弹窗：草稿阶段的核心字段 + 主办方组织。
 *
 * 为什么合成一个弹窗：这两块都属于「赛季身份」，主办方改完名称常常顺手
 * 调整组织，分成两个入口只会让人来回点。后端仍然是两条接口
 * （`PATCH /seasons/:id` 与 `PUT /seasons/:id/organizers`），这里按需分别调用 ——
 * 只改了组织就只发组织那条。
 *
 * 边界：
 *   · 编号（`code`）创建后不可改，这里只读展示；
 *   · 类型化规则不在这里（走「修改规则」弹窗），规则卡也不在这里；
 *   · 提交后只有平台管理员能改组织，按钮可见性由父级决定。
 *
 * 交互沿用 `organizer-header.tsx` 的弹窗写法：`fixed inset-0 bg-overlay`、
 * `ui-panel` 内容、Esc 关闭、`role="dialog" aria-modal aria-labelledby`。
 */
export function SeasonCoreDialog({
  detail,
  organizerOrgs,
  canEditCore,
  canEditOrganizers,
  onCancel,
  onSaved,
}: {
  detail: SeasonManageDetail
  organizerOrgs: OrganizerOrg[]
  /** 核心字段只有草稿可改（后端 `updateCore` 同口径）；为 false 时这些控件只读。 */
  canEditCore: boolean
  /** 提交后仅平台管理员可改主办方组织；为 false 时组织选择区只读。 */
  canEditOrganizers: boolean
  onCancel: () => void
  /** 保存成功回调：父级负责关闭弹窗并刷新数据。 */
  onSaved: () => void
}) {
  const uid = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const titleId = `${uid}-title`

  const [name, setName] = useState(detail.name)
  const [type, setType] = useState<SeasonType>(
    detail.type === 'hackathon' ? 'hackathon' : 'season',
  )
  const [city, setCity] = useState(detail.city ?? '')
  const [intro, setIntro] = useState(detail.intro ?? '')
  const [themes, setThemes] = useState<string[]>(detail.themes)
  const [themeInput, setThemeInput] = useState('')
  const [agreementVersion, setAgreementVersion] = useState(detail.agreementVersion)
  const [awardingEntity, setAwardingEntity] = useState(detail.awardingEntity ?? '')
  const [capacity, setCapacity] = useState(
    detail.participantCapacity === null ? '' : String(detail.participantCapacity),
  )
  const [orgIds, setOrgIds] = useState<number[]>(detail.organizerOrgIds)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const id = (name: string) => `${uid}-${name}`

  function addTheme() {
    const theme = themeInput.trim()
    if (!theme) return
    setThemeInput('')
    if (themes.includes(theme)) return
    if (themes.length >= MAX_SEASON_THEMES) {
      setErrors((current) => ({ ...current, themes: `主题最多 ${MAX_SEASON_THEMES} 个` }))
      return
    }
    setThemes([...themes, theme])
    setErrors((current) => ({ ...current, themes: '' }))
  }

  function toggleOrg(orgId: number) {
    if (!canEditOrganizers) return
    setOrgIds((current) =>
      current.includes(orgId) ? current.filter((item) => item !== orgId) : [...current, orgId],
    )
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    const trimmedName = name.trim()
    if (trimmedName.length < 2) next.name = '赛季名称至少 2 个字符'
    else if (trimmedName.length > 255) next.name = '赛季名称最多 255 个字符'
    if (type === 'hackathon' && !city.trim()) next.city = '黑客松必须填写城市'
    if (city.trim().length > 100) next.city = '城市最多 100 个字符'
    if (agreementVersion.trim().length === 0) next.agreementVersion = '请填写协议版本'
    else if (agreementVersion.trim().length > 32) next.agreementVersion = '协议版本最多 32 个字符'
    if (themes.length > MAX_SEASON_THEMES) next.themes = `主题最多 ${MAX_SEASON_THEMES} 个`
    else if (themes.some((theme) => theme.length > MAX_SEASON_THEME_LENGTH)) {
      next.themes = `单个主题不能超过 ${MAX_SEASON_THEME_LENGTH} 个字符`
    }
    const capacityText = capacity.trim()
    if (capacityText) {
      if (!/^\d+$/.test(capacityText)) next.participantCapacity = '选手名额必须是正整数'
      else if (Number(capacityText) < 1 || Number(capacityText) > 100_000) {
        next.participantCapacity = '选手名额必须在 1–100000 之间'
      }
    }
    if (canEditOrganizers && orgIds.length === 0) next.organizerOrgIds = '请至少选择一个主办方组织'
    return next
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先修正表单里标红的字段')
      return
    }

    const orgsChanged = canEditOrganizers
      && (orgIds.length !== detail.organizerOrgIds.length
        || orgIds.some((orgId) => !detail.organizerOrgIds.includes(orgId)))

    // 非草稿赛季：核心字段后端不让改（只有组织可能由管理员调整），
    // 所以不发 PATCH，避免一个必然 409 的请求。
    if (!canEditCore) {
      if (!orgsChanged) {
        setFormError('这个赛季已经提交，只有主办方组织可以调整')
        return
      }
      setPending(true)
      const organizers = await updateSeasonOrganizers(detail.id, { organizerOrgIds: orgIds })
      setPending(false)
      if (organizers.error || !organizers.data) {
        setFormError(organizers.error?.body.error.message || '保存主办方组织失败，请稍后重试')
        return
      }
      onSaved()
      return
    }

    setPending(true)
    const capacityText = capacity.trim()
    const core = await updateSeasonCore(detail.id, {
      name: name.trim(),
      type,
      city: city.trim() || null,
      intro: intro.trim() || null,
      themes,
      agreementVersion: agreementVersion.trim(),
      awardingEntity: awardingEntity.trim() || null,
      participantCapacity: capacityText ? Number(capacityText) : null,
    })

    if (core.error || !core.data) {
      setPending(false)
      const bundle = core.error?.body.error
      if (bundle?.field) setErrors((current) => ({ ...current, [bundle.field!]: bundle.message }))
      setFormError(bundle?.message || '保存失败，请稍后重试')
      return
    }

    if (orgsChanged) {
      const organizers = await updateSeasonOrganizers(detail.id, { organizerOrgIds: orgIds })
      if (organizers.error || !organizers.data) {
        setPending(false)
        const bundle = organizers.error?.body.error
        setFormError(
          bundle?.message
            ? `基础信息已保存，但主办方组织保存失败：${bundle.message}`
            : '基础信息已保存，但主办方组织保存失败',
        )
        return
      }
    }

    setPending(false)
    onSaved()
  }

  const readOnlyOrganizers = !canEditOrganizers

  return (
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
              编辑赛季信息
            </h2>
            <p className="mt-2 text-body-sm text-muted-foreground">
              赛季编号 <span className="font-mono">{detail.code}</span> 创建后不可修改；
              类型化规则与规则卡在各自的区块里改。
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

        <form onSubmit={onSubmit} className="grid gap-5" noValidate aria-label="赛季信息表单">
          {!canEditCore ? (
            <p className="ui-note ui-note--warning">
              赛季已提交，基础字段（名称、类型、主题、名额等）不能再改；只有主办方组织可能由平台管理员调整。
            </p>
          ) : null}

          {/* fieldset[disabled] 一次性把整组控件变成只读，避免逐个传 disabled。 */}
          <fieldset className="grid gap-4 sm:grid-cols-2" disabled={!canEditCore}>
            <FormField label="赛季名称" htmlFor={id('name')} required error={errors.name}>
              <TextInput
                id={id('name')}
                name="name"
                value={name}
                onChange={setName}
                maxLength={255}
              />
            </FormField>
            <FormField label="赛季类型" htmlFor={id('type')} required>
              <SelectInput
                id={id('type')}
                name="type"
                value={type}
                onChange={(next) => setType(next === 'hackathon' ? 'hackathon' : 'season')}
                options={[
                  { value: 'season', label: '赛季' },
                  { value: 'hackathon', label: '黑客松' },
                ]}
              />
            </FormField>
            <FormField
              label={type === 'hackathon' ? '城市（黑客松必填）' : '城市'}
              htmlFor={id('city')}
              error={errors.city}
            >
              <TextInput
                id={id('city')}
                name="city"
                value={city}
                onChange={setCity}
                maxLength={100}
              />
            </FormField>
            <FormField
              label="协议版本"
              htmlFor={id('agreement')}
              required
              error={errors.agreementVersion}
            >
              <TextInput
                id={id('agreement')}
                name="agreementVersion"
                value={agreementVersion}
                onChange={setAgreementVersion}
                maxLength={32}
              />
            </FormField>
            <FormField label="发奖主体" htmlFor={id('awarding')} error={errors.awardingEntity}>
              <TextInput
                id={id('awarding')}
                name="awardingEntity"
                value={awardingEntity}
                onChange={setAwardingEntity}
                placeholder="SheNicest 基金会"
                maxLength={255}
              />
            </FormField>
            <FormField
              label="选手名额"
              htmlFor={id('capacity')}
              hint="留空表示不限"
              error={errors.participantCapacity}
            >
              <TextInput
                id={id('capacity')}
                name="participantCapacity"
                type="number"
                value={capacity}
                onChange={setCapacity}
                placeholder="不限"
                min={1}
                max={100_000}
              />
            </FormField>
          </fieldset>

          <fieldset className="grid gap-4" disabled={!canEditCore}>
            <legend className="ui-label mb-1">赛季介绍与主题</legend>
            <FormField label="赛季介绍" htmlFor={id('intro')} hint="公开页展示的简介，最多 5000 字">
              <TextArea
                id={id('intro')}
                name="intro"
                value={intro}
                onChange={setIntro}
                rows={3}
                maxLength={5000}
              />
            </FormField>

            <FormField
              label="赛季主题"
              htmlFor={id('themes')}
              group
              error={errors.themes}
              hint={`报名时可以选择的主题方向，最多 ${MAX_SEASON_THEMES} 个。这里只做增删；排序与单独保存请用页面上的「赛季主题」区块。`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={id('themes')}
                  name="theme"
                  value={themeInput}
                  onChange={(event) => setThemeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addTheme()
                  }}
                  className="ui-input max-w-60"
                  placeholder="输入后按回车添加"
                  maxLength={MAX_SEASON_THEME_LENGTH}
                />
                <Button variant="secondary" size="sm" onClick={addTheme} disabled={!themeInput.trim()}>
                  添加
                </Button>
              </div>
              {themes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {themes.map((theme) => (
                    <ChipButton
                      key={theme}
                      tone="accent"
                      aria-label={`移除主题 ${theme}`}
                      onClick={() => setThemes(themes.filter((item) => item !== theme))}
                    >
                      {theme} <span aria-hidden>×</span>
                    </ChipButton>
                  ))}
                </div>
              ) : (
                <p className="ui-hint">还没有主题</p>
              )}
            </FormField>
          </fieldset>

          <FormField
            label="主办方组织"
            htmlFor={id('organizer-orgs')}
            group
            error={errors.organizerOrgIds}
            hint={
              readOnlyOrganizers
                ? '赛季已提交，只有平台管理员可以调整主办方组织'
                : '可以多选；普通主办方只能选择自己是成员的组织'
            }
          >
            {organizerOrgs.length === 0 ? (
              <p className="ui-hint">你还不属于任何主办方组织，请联系平台管理员加入后再建赛季。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {organizerOrgs.map((org) => (
                  <ChipButton
                    key={org.id}
                    aria-pressed={orgIds.includes(org.id)}
                    tone={orgIds.includes(org.id) ? 'accent' : 'neutral'}
                    onClick={() => toggleOrg(org.id)}
                    disabled={readOnlyOrganizers}
                  >
                    {org.name}
                  </ChipButton>
                ))}
              </div>
            )}
          </FormField>

          <FieldError>{formError}</FieldError>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : '保存'}
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
