'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CheckboxInput,
  FormField,
  TextArea,
  TextInput,
} from '@/components/submit/form-fields'
import {
  MAX_RULE_CARD_LABEL_LENGTH,
  MAX_RULE_CARD_VALUE_LENGTH,
  type RuleCardItemDraftInput,
} from '@/lib/organizer-rules'

/**
 * 规则卡条目的新增 / 修改弹窗。
 *
 * 为什么是弹窗而不是行内输入：规则卡条目是「名称 + 长文本内容 + 是否显示」
 * 三件套，塞进表格单元格里会把每一行撑得很高，也说不清「填完什么时候生效」。
 * 弹窗把「确认」变成一个明确的提交动作：取消不改变草稿，确认才回写一行。
 *
 * 无障碍契约（与同目录 `season-rules-dialog.tsx` 的弹窗外壳同口径）：
 *   · `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向标题；
 *   · Esc 关闭；Tab / Shift+Tab 在弹窗内循环，不会跑到遮罩后面的页面；
 *   · 打开时焦点落在第一个输入框；关闭后由调用方把焦点还给触发按钮。
 */

export type RuleCardDialogMode = 'create' | 'edit'

const COPY: Record<RuleCardDialogMode, { title: string; description: string; submit: string }> = {
  create: {
    title: '新增规则',
    description: '新增一条可选规则：填写条目名称与内容，确认后追加到规则卡末尾。',
    submit: '确认新增',
  },
  edit: {
    title: '修改规则',
    description: '修改这条可选规则的名称与内容；确认后只更新草稿，保存仍需点「保存规则卡」。',
    submit: '保存修改',
  },
}

/** 弹窗内可聚焦元素的选择器（Tab 循环用）。 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function RuleCardItemDialog({
  mode,
  initial,
  onCancel,
  onConfirm,
}: {
  mode: RuleCardDialogMode
  /** 修改时预填的当前值；新增时省略（空表单）。 */
  initial?: RuleCardItemDraftInput
  onCancel: () => void
  onConfirm: (input: RuleCardItemDraftInput) => void
}) {
  const uid = useId()
  const titleId = `${uid}-title`
  const labelId = `${uid}-label`
  const valueId = `${uid}-value`
  const visibleId = `${uid}-visible`
  const panelRef = useRef<HTMLDivElement | null>(null)
  const cancelRef = useRef(onCancel)

  const [label, setLabel] = useState(initial?.label ?? '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [visible, setVisible] = useState(initial?.visible ?? true)
  const [errors, setErrors] = useState<{ label?: string; value?: string }>({})

  const copy = COPY[mode]

  useEffect(() => {
    cancelRef.current = onCancel
  }, [onCancel])

  // 依赖数组为空：父级每次渲染都可能传新的 onCancel，用 ref 取最新值，
  // 否则 effect 会重跑并把焦点从用户正在输入的控件上抢走。
  useEffect(() => {
    const panel = panelRef.current
    panel?.querySelector<HTMLInputElement>('input')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        cancelRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextLabel = label.trim()
    const nextValue = value.trim()
    const nextErrors: { label?: string; value?: string } = {}
    if (!nextLabel) nextErrors.label = '请填写条目名称'
    if (!nextValue) nextErrors.value = '请填写条目内容'
    setErrors(nextErrors)
    if (nextErrors.label || nextErrors.value) return
    onConfirm({ label: nextLabel, value: nextValue, visible })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div ref={panelRef} className="ui-panel my-8 w-full max-w-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-h3 font-bold text-foreground">
              {copy.title}
            </h2>
            <p className="mt-2 text-body-sm text-muted-foreground">{copy.description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="ui-btn ui-btn--ghost ui-btn--small"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4" noValidate aria-label={`${copy.title}表单`}>
          <FormField
            label="条目名称"
            htmlFor={labelId}
            required
            hint="展示在规则卡里的短标题"
            error={errors.label}
          >
            <TextInput
              id={labelId}
              name="label"
              value={label}
              onChange={setLabel}
              placeholder="例如：作品提交要求"
              maxLength={MAX_RULE_CARD_LABEL_LENGTH}
            />
          </FormField>

          <FormField
            label="条目内容"
            htmlFor={valueId}
            required
            hint="一句话说清这条规则，公开页会原样展示"
            error={errors.value}
          >
            <TextArea
              id={valueId}
              name="value"
              value={value}
              onChange={setValue}
              rows={4}
              maxLength={MAX_RULE_CARD_VALUE_LENGTH}
            />
          </FormField>

          <div className="ui-field">
            <CheckboxInput
              id={visibleId}
              name="visible"
              checked={visible}
              onChange={setVisible}
            >
              是否显示
            </CheckboxInput>
            <p className="ui-hint">关闭后这条规则只留在后台，不出现在公开页。</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">{copy.submit}</Button>
            <Button variant="ghost" onClick={onCancel}>
              取消
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
