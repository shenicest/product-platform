'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChipButton } from '@/components/ui/chip'
import { CheckboxInput, FieldError, FormField, TextArea, TextInput } from '@/components/submit/form-fields'
import { createSeasonApplication } from '@/lib/boomland-api'
import type { SeasonDetail } from '@/lib/boomland'

const MAX_THEMES = 3

export function SeasonApplicationForm({ season }: { season: SeasonDetail }) {
  const router = useRouter()
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [themes, setThemes] = useState<string[]>([])
  const [teamIntent, setTeamIntent] = useState('')
  const [acceptsSolo, setAcceptsSolo] = useState(true)
  const [availability, setAvailability] = useState('')
  const [cityMode, setCityMode] = useState('')
  const [wechat, setWechat] = useState('')
  const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function toggleTheme(theme: string) {
    setThemes((current) => {
      if (current.includes(theme)) return current.filter((item) => item !== theme)
      if (current.length >= MAX_THEMES) return current
      return [...current, theme]
    })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!skills.trim()) next.skills = '请填写你的技能'
    if (!experience.trim()) next.experience = '请填写相关经历'
    if (!themes.length) next.themes = '请至少选择一个赛季方向'
    if (!teamIntent.trim()) next.teamIntent = '请说明你的组队意向'
    if (!availability.trim()) next.availability = '请填写可投入时间'
    if (!cityMode.trim()) next.cityMode = '请填写参与方式'
    if (!wechat.trim() && !phone.trim()) next.contact = '微信号与手机号至少填写一项'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!validate()) {
      setFormError('请先补全表单中标红的字段')
      return
    }
    if (!agreed) {
      setFormError('提交前请确认已阅读并同意赛季协议')
      return
    }

    setPending(true)
    const { error: apiError } = await createSeasonApplication(season.id, {
      skills: skills.trim(),
      experience: experience.trim(),
      themes,
      teamIntent: teamIntent.trim(),
      acceptsSolo,
      availability: availability.trim(),
      cityMode: cityMode.trim(),
      contact: {
        ...(wechat.trim() ? { wechat: wechat.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      },
      agreementVersion: season.agreementVersion,
    })
    setPending(false)

    if (apiError) {
      const { code, message, field } = apiError.body.error
      if (code === 'AGREEMENT_VERSION_MISMATCH') {
        setFormError('赛季协议刚刚更新，请刷新页面后重新提交。')
        return
      }
      if (code === 'APPLICATION_DUPLICATED' || code === 'ALREADY_PARTICIPANT') {
        router.replace('/me/applications')
        router.refresh()
        return
      }
      setFormError(message || '提交失败，请稍后重试')
      if (field) {
        setFieldErrors((current) => ({ ...current, [field]: message }))
      }
      return
    }

    router.push('/me/applications?applied=1')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <FormField label="你的技能" htmlFor="apply-skills" required error={fieldErrors.skills}>
        <TextArea
          id="apply-skills"
          name="skills"
          value={skills}
          onChange={setSkills}
          placeholder="例如：储能 BMS 固件、React 前端、供应链 BD"
          rows={3}
          maxLength={2000}
        />
      </FormField>

      <FormField label="相关经历" htmlFor="apply-experience" required error={fieldErrors.experience}>
        <TextArea
          id="apply-experience"
          name="experience"
          value={experience}
          onChange={setExperience}
          placeholder="做过什么、做到什么程度，一两段即可"
          rows={4}
          maxLength={4000}
        />
      </FormField>

      <FormField
        label={`报名方向（最多 ${MAX_THEMES} 个）`}
        htmlFor="apply-themes"
        required
        group
        error={fieldErrors.themes}
        hint="必须在本赛季主题范围内选择"
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="选择报名方向">
          {season.themes.map((theme) => (
            <ChipButton
              key={theme}
              aria-pressed={themes.includes(theme)}
              tone={themes.includes(theme) ? 'accent' : 'neutral'}
              onClick={() => toggleTheme(theme)}
            >
              {theme}
            </ChipButton>
          ))}
        </div>
        {themes.length ? (
          <p className="ui-hint">已选 {themes.length} / {MAX_THEMES}：{themes.join('、')}</p>
        ) : null}
      </FormField>

      <FormField label="组队意向" htmlFor="apply-team-intent" required error={fieldErrors.teamIntent}>
        <TextArea
          id="apply-team-intent"
          name="teamIntent"
          value={teamIntent}
          onChange={setTeamIntent}
          placeholder="想加入什么方向的队伍、或者已经和谁约好"
          rows={2}
          maxLength={1000}
        />
      </FormField>

      <div className="ui-field">
        <CheckboxInput id="apply-accepts-solo" name="acceptsSolo" checked={acceptsSolo} onChange={setAcceptsSolo}>
          找不到队伍也愿意一个人参赛
        </CheckboxInput>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="可投入时间" htmlFor="apply-availability" required error={fieldErrors.availability}>
          <TextInput
            id="apply-availability"
            name="availability"
            value={availability}
            onChange={setAvailability}
            placeholder="例如：每周 15 小时 / 全职冲刺"
            maxLength={500}
          />
        </FormField>
        <FormField label="参与方式" htmlFor="apply-city-mode" required error={fieldErrors.cityMode}>
          <TextInput
            id="apply-city-mode"
            name="cityMode"
            value={cityMode}
            onChange={setCityMode}
            placeholder={season.city ? `线上 / ${season.city}线下` : '线上 / 线下'}
            maxLength={200}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="微信号" htmlFor="apply-wechat" hint="与手机号至少填一项，仅主办方可见" error={fieldErrors.contact}>
          <TextInput
            id="apply-wechat"
            name="wechat"
            value={wechat}
            onChange={setWechat}
            placeholder="wechat id"
            maxLength={100}
            invalid={Boolean(fieldErrors.contact)}
          />
        </FormField>
        <FormField label="手机号" htmlFor="apply-phone">
          <TextInput
            id="apply-phone"
            name="phone"
            value={phone}
            onChange={setPhone}
            placeholder="138 0000 0000"
            maxLength={50}
            invalid={Boolean(fieldErrors.contact)}
          />
        </FormField>
      </div>

      <div className="ui-field">
        <CheckboxInput id="apply-agreement" name="agreement" checked={agreed} onChange={setAgreed}>
          我已阅读并同意本赛季协议（{season.agreementVersion}）与规则卡
        </CheckboxInput>
      </div>

      <FieldError>{formError}</FieldError>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? '提交中…' : '提交报名'}
        </Button>
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
          返回
        </Button>
      </div>
    </form>
  )
}
