'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField, TextInput } from '@/components/submit/form-fields'
import { MAX_SEASON_THEME_LENGTH } from '@/lib/organizer-themes'

/**
 * 赛季主题的新增 / 修改弹窗。
 *
 * 为什么是弹窗而不是行内输入：主题只有「一个名字」这一个字段，塞进表格单元格
 * 里会变成一整排小输入框，说不清「什么时候生效」；弹窗把「确认」变成一个明确的
 * 提交动作 —— 取消不改变草稿，确认才回写一行。交互与 `rule-card-dialogs.tsx`
 * 完全同口径，两个编辑器的操作手感必须一致。
 *
 * 无障碍契约（与同目录其它弹窗同口径）：
 *   · `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 指向标题；
 *   · Esc 关闭；Tab / Shift+Tab 在弹窗内循环，不会跑到遮罩后面的页面；
 *   · 打开时焦点落在输入框；关闭后由调用方把焦点还给触发按钮。
 */

export type ThemeDialogMode = 'create' | 'edit'

const COPY: Record<ThemeDialogMode, { title: string; description: string; submit: string }> = {
  create: {
    title: '新增主题',
    description: '填写一个报名者可以选择的主题方向，确认后追加到列表末尾；保存仍需点「保存主题」。',
    submit: '确认新增',
  },
  edit: {
    title: '修改主题',
    description: '修改这条主题的名称；确认后只更新草稿，保存仍需点「保存主题」。',
    submit: '保存修改',
  },
}

/** 弹窗内可聚焦元素的选择器（Tab 循环用）。 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ThemeItemDialog({
  mode,
  initial,
  takenThemes = [],
  onCancel,
  onConfirm,
}: {
  mode: ThemeDialogMode
  /** 修改时预填的当前主题；新增时省略（空表单）。 */
  initial?: string
  /**
   * 已经被别的行占用的主题（修改时应由调用方排除当前行）。
   * 只用来做「重复」的即时提示 —— 真正拦住重复的是保存前的草稿校验，
   * 这里早一步说清楚，省得用户填完点保存才被拒。
   */
  takenThemes?: string[]
  onCancel: () => void
  onConfirm: (theme: string) => void
}) {
  const uid = useId()
  const titleId = `${uid}-title`
  const themeId = `${uid}-theme`
  const panelRef = useRef<HTMLDivElement | null>(null)
  const cancelRef = useRef(onCancel)

  const [theme, setTheme] = useState(initial ?? '')
  const [error, setError] = useState<string | undefined>(undefined)

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
    const next = theme.trim()
    if (!next) {
      setError('请填写主题名称')
      return
    }
    if (next.length > MAX_SEASON_THEME_LENGTH) {
      setError(`单个主题最多 ${MAX_SEASON_THEME_LENGTH} 个字符`)
      return
    }
    if (takenThemes.includes(next)) {
      setError(`主题「${next}」已经存在`)
      return
    }
    setError(undefined)
    onConfirm(next)
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
            label="主题名称"
            htmlFor={themeId}
            required
            hint={`报名者会看到这个方向名，最多 ${MAX_SEASON_THEME_LENGTH} 个字符`}
            error={error}
          >
            <TextInput
              id={themeId}
              name="theme"
              value={theme}
              onChange={(next) => {
                setTheme(next)
                // 用户一开始改就把上一次的报错撤掉，避免「已经改对了还在标红」。
                setError(undefined)
              }}
              placeholder="例如：新型储能基建"
              maxLength={MAX_SEASON_THEME_LENGTH}
            />
          </FormField>

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
