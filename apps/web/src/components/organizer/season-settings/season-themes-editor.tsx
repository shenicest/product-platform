'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ThemeItemDialog,
  type ThemeDialogMode,
} from '@/components/organizer/season-settings/season-themes-dialogs'
import {
  appendThemeItem,
  MAX_SEASON_THEMES,
  MAX_SEASON_THEME_LENGTH,
  removeThemeItem,
  reorderThemeItems,
  updateThemeItem,
  type ThemeDraftItem,
} from '@/lib/organizer-themes'

/**
 * 赛季主题编辑器。
 *
 * 一行 = 一个主题，顺序即保存顺序（公开页与报名表单都按这个顺序展示）。
 *
 * 交互口径与 `rule-card-editor.tsx` **逐条对齐**（同一屏里两个列表手感必须一致）：
 *   · 新增 / 修改都走弹窗（`season-themes-dialogs.tsx`）：取消不改草稿，确认才回写；
 *   · 排序靠**拖动**：整行 `draggable`，把手是可聚焦的 `<button>`，
 *     键盘聚焦把手后 Alt+↑ / Alt+↓ 等价移动（无障碍底线：不能只支持鼠标）；
 *   · 键盘重排后用 `role="status"` 播报结果 —— 拖动对键盘用户没有视觉反馈。
 *
 * 与规则卡编辑器的差异只有一处：主题没有「必要项」，所以每一行都可改可删。
 *
 * 组件本身不发请求，也不做保存校验：调用方拿到新数组后自己决定何时保存。
 */
export function SeasonThemesEditor({
  items,
  onChange,
  disabled = false,
}: {
  items: ThemeDraftItem[]
  onChange: (next: ThemeDraftItem[]) => void
  disabled?: boolean
}) {
  const canAdd = !disabled && items.length < MAX_SEASON_THEMES

  /** 打开中的弹窗：新增，或修改第 index 行。 */
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; index: number } | null
  >(null)
  /** 触发弹窗的按钮：关闭后把焦点还回去。 */
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  /** 拖动状态：从哪一行开始、当前插入到哪个下标（`to` 语义，见 reorderThemeItems）。 */
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  /** 键盘重排后的读屏播报。 */
  const [announcement, setAnnouncement] = useState('')

  /** 无障碍名：主题没填时退回占位，读屏至少能听出是第几行。 */
  const nameOf = (item: ThemeDraftItem) => item.theme.trim() || '未命名主题'

  function reorder(from: number, to: number) {
    const next = reorderThemeItems(items, from, to)
    if (next === items) return
    onChange(next)
    const moved = items[from]
    const position = next.indexOf(moved) + 1
    setAnnouncement(`「${nameOf(moved)}」已移动到第 ${position} 个主题`)
  }

  /** Alt+↑ / Alt+↓：拖动把手的键盘等价操作。 */
  function onHandleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled || !event.altKey) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      reorder(index, index - 1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      reorder(index, index + 2)
    }
  }

  function openDialog(mode: ThemeDialogMode, index: number | null, trigger: HTMLButtonElement) {
    if (disabled) return
    triggerRef.current = trigger
    setDialog(mode === 'create' ? { mode: 'create' } : { mode: 'edit', index: index ?? 0 })
  }

  /** 关闭弹窗并把焦点还给触发按钮（`aria-modal` 弹窗的焦点契约）。 */
  function closeDialog() {
    setDialog(null)
    triggerRef.current?.focus()
  }

  function confirmDialog(theme: string) {
    if (!dialog) return
    onChange(
      dialog.mode === 'create'
        ? appendThemeItem(items, theme)
        : updateThemeItem(items, dialog.index, theme),
    )
    closeDialog()
  }

  const editing = dialog?.mode === 'edit' ? items[dialog.index] : undefined
  /** 弹窗里的「已存在」提示：修改时排除当前行，否则用户改不动自己的那一行。 */
  const takenThemes = items
    .filter((_, index) => !(dialog?.mode === 'edit' && dialog.index === index))
    .map((item) => item.theme.trim())
    .filter(Boolean)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ui-hint">
          报名者从这里挑方向，命题也可以标注属于哪个主题；顺序即展示顺序，最多{' '}
          {MAX_SEASON_THEMES} 个、每个不超过 {MAX_SEASON_THEME_LENGTH} 个字符。
          拖动把手可排序，键盘聚焦把手后按 Alt+↑ / Alt+↓ 也能移动。
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => openDialog('create', null, event.currentTarget)}
          disabled={!canAdd}
          aria-label="新增主题"
        >
          新增主题
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="ui-hint">还没有赛季主题。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="console-table">
            <caption className="sr-only">
              赛季主题（按展示顺序排列；拖动把手或用 Alt+↑ / Alt+↓ 调整顺序）
            </caption>
            <thead>
              <tr>
                <th scope="col">顺序</th>
                <th scope="col">#</th>
                <th scope="col">主题</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const name = nameOf(item)
                const isDragging = dragging === index
                const dropBefore = dragging !== null && dropIndex === index && dragging !== index
                const dropAfter =
                  dragging !== null
                  && dropIndex === items.length
                  && index === items.length - 1
                  && dragging !== index

                return (
                  <tr
                    // key 只认 item.key（不掺下标）：键盘重排后 DOM 节点跟着移动，
                    // 焦点留在把手上，用户能连续按 Alt+↑/↓ 调整多格。
                    key={item.key}
                    data-testid={`season-theme-row-${index}`}
                    draggable={!disabled}
                    onDragStart={() => {
                      if (disabled) return
                      setDragging(index)
                      setDropIndex(index)
                    }}
                    onDragOver={(event) => {
                      if (disabled || dragging === null) return
                      // 必须 preventDefault 才会触发 drop。
                      event.preventDefault()
                      const rect = event.currentTarget.getBoundingClientRect()
                      const after = event.clientY > rect.top + rect.height / 2
                      setDropIndex(after ? index + 1 : index)
                    }}
                    onDrop={(event) => {
                      if (disabled || dragging === null) return
                      event.preventDefault()
                      const to = dropIndex ?? index
                      const from = dragging
                      setDragging(null)
                      setDropIndex(null)
                      reorder(from, to)
                    }}
                    onDragEnd={() => {
                      setDragging(null)
                      setDropIndex(null)
                    }}
                    className={cn(
                      isDragging && 'opacity-50',
                      dropBefore && 'border-t-2 border-brand-line',
                      dropAfter && 'border-b-2 border-brand-line',
                    )}
                  >
                    <td className="w-10">
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost ui-btn--small cursor-grab"
                        aria-label={`拖动排序 ${name}（Alt+↑ / Alt+↓ 可键盘移动）`}
                        title="拖动排序；或聚焦后按 Alt+↑ / Alt+↓"
                        onKeyDown={(event) => onHandleKeyDown(event, index)}
                        disabled={disabled}
                      >
                        <span aria-hidden>⠿</span>
                      </button>
                    </td>

                    <td className="font-mono text-meta text-muted-foreground">{index + 1}</td>

                    <td className="min-w-48">
                      <span className="text-body-sm font-bold text-foreground">
                        {item.theme.trim() || (
                          <span className="text-muted-foreground">（未填写）</span>
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => openDialog('edit', index, event.currentTarget)}
                          disabled={disabled}
                          aria-label={`修改主题 ${name}`}
                        >
                          修改
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onChange(removeThemeItem(items, index))}
                          disabled={disabled}
                          aria-label={`删除主题 ${name}`}
                        >
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {dialog ? (
        <ThemeItemDialog
          mode={dialog.mode}
          initial={dialog.mode === 'edit' && editing ? editing.theme : undefined}
          takenThemes={takenThemes}
          onCancel={closeDialog}
          onConfirm={confirmDialog}
        />
      ) : null}
    </div>
  )
}
