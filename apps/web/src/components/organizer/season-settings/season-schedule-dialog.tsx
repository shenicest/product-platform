'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { SeasonSchedule } from '@shenicest/shared'
import { Button } from '@/components/ui/button'
import { FieldError, FormField, TextArea, TextInput } from '@/components/submit/form-fields'
import { SCHEDULE_FIELDS, validateScheduleDraft, type SeasonScheduleDraft } from '@/lib/organizer'
import { toScheduleDraft, toSchedulePayload, validateScheduleChange } from '@/lib/organizer-settings'
import { updateSeasonSchedule } from '@/lib/organizer-settings-api'

/**
 * 「改赛程」弹窗：八个 `datetime-local` 输入 + 可选的公告标题 / 内容。
 *
 * 三条关键约束（都来自后端 `updateSchedule`，前端提前拦住）：
 *   1. 要么八格全空（= 不排期），要么八格齐全；
 *   2. 时间必须严格递增，且作品截止 ≤ 评分截止、命题冻结 ≤ 组队截止；
 *   3. 时间按**北京时间**解释 —— 输入框里填的就是北京墙上时间，
 *      转换由 `lib/organizer-settings.ts` 的 `toSchedulePayload` 完成。
 *
 * 公告是可选的：填了就随 `announcement` 一起提交（后端会用它替换自动摘要），
 * 不填则由后端生成默认公告。
 */
export function SeasonScheduleDialog({
  seasonId,
  schedule,
  onCancel,
  onSaved,
}: {
  seasonId: number
  schedule: SeasonSchedule | null
  onCancel: () => void
  /** 保存成功回调：父级负责关闭弹窗并刷新数据。 */
  onSaved: () => void
}) {
  const uid = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const titleId = `${uid}-title`

  const [draft, setDraft] = useState<SeasonScheduleDraft>(() => toScheduleDraft(schedule))
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementContent, setAnnouncementContent] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
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

  function setField(key: keyof SeasonScheduleDraft, next: string) {
    setDraft((current) => ({ ...current, [key]: next }))
  }

  function validate(): Record<string, string | undefined> {
    const next: Record<string, string | undefined> = { ...validateScheduleDraft(draft) }
    // 先后顺序先过一遍；只有顺序没问题时再谈「已过去 / 缩短 48h」，
    // 否则同一格会同时冒出两条互相矛盾的红字。
    if (Object.keys(next).length === 0) {
      const payload = toSchedulePayload(draft)
      if (payload) Object.assign(next, validateScheduleChange(schedule, payload))
    }
    const title = announcementTitle.trim()
    const content = announcementContent.trim()
    if (title || content) {
      if (title.length < 2) next.announcementTitle = '公告标题至少 2 个字符'
      else if (title.length > 255) next.announcementTitle = '公告标题最多 255 个字符'
      if (!content) next.announcementContent = '请填写公告内容'
      else if (content.length > 5000) next.announcementContent = '公告内容最多 5000 个字符'
    }
    return next
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('请先修正赛程里标红的字段')
      return
    }

    const payload = toSchedulePayload(draft)
    if (!payload) {
      // 后端 `PUT /seasons/:id/schedule` 的 `schedule` 是必填对象：可以改时间，
      // 但不能把整个赛程清空（赛季一旦排过期，就没有“回到未排期”这条路）。
      setFormError('赛程不能全部留空：八个节点都需要填写时间')
      return
    }

    const title = announcementTitle.trim()
    const content = announcementContent.trim()

    setPending(true)
    const { data, error } = await updateSeasonSchedule(seasonId, {
      schedule: payload,
      ...(title || content ? { announcement: { title, content } } : {}),
    })
    setPending(false)

    if (error || !data) {
      const bundle = error?.body.error
      setFormError(bundle?.message || '保存赛程失败，请稍后重试')
      return
    }
    onSaved()
  }

  /** 放弃本地改动，回到打开弹窗时的那份赛程。 */
  function resetToSaved() {
    setDraft(toScheduleDraft(schedule))
    setAnnouncementTitle('')
    setAnnouncementContent('')
    setErrors({})
    setFormError(null)
  }

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
              改赛程
            </h2>
            <p className="mt-2 text-body-sm text-muted-foreground">
              全部时间按<strong>北京时间</strong>填写。已过去的截止不能再改；缩短的截止至少在公告发出
              48 小时之后。
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

        <form onSubmit={onSubmit} className="grid gap-5" noValidate aria-label="赛季赛程表单">
          <div className="grid gap-4 sm:grid-cols-2">
            {SCHEDULE_FIELDS.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                htmlFor={id(`schedule-${field.key}`)}
                error={errors[`schedule.${field.key}`]}
              >
                <TextInput
                  id={id(`schedule-${field.key}`)}
                  name={field.key}
                  type="datetime-local"
                  value={draft[field.key]}
                  onChange={(next) => setField(field.key, next)}
                />
              </FormField>
            ))}
          </div>

          <p className="ui-hint">
            {schedule
              ? '八个节点都要填，且时间严格递增；已经排期的赛季不能整体清空赛程。'
              : '要么八格全部留空（= 暂不排期），要么八个节点都填，且时间严格递增。'}
          </p>

          <fieldset className="grid gap-4">
            <legend className="ui-label mb-1">公告（可选）</legend>
            <p className="ui-hint -mt-2">留空时由系统自动生成「赛程已更新」公告。</p>
            <FormField
              label="公告标题"
              htmlFor={id('announcement-title')}
              error={errors.announcementTitle}
            >
              <TextInput
                id={id('announcement-title')}
                name="announcementTitle"
                value={announcementTitle}
                onChange={setAnnouncementTitle}
                placeholder="赛程已更新"
                maxLength={255}
              />
            </FormField>
            <FormField
              label="公告内容"
              htmlFor={id('announcement-content')}
              error={errors.announcementContent}
            >
              <TextArea
                id={id('announcement-content')}
                name="announcementContent"
                value={announcementContent}
                onChange={setAnnouncementContent}
                rows={3}
                maxLength={5000}
              />
            </FormField>
          </fieldset>

          <FieldError>{formError}</FieldError>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : '保存赛程'}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              取消
            </Button>
            <Button variant="text" onClick={resetToSaved} disabled={pending}>
              重置
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
