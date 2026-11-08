'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { cn } from '@/lib/utils'
import { OrganizerActionIcon } from '@/components/organizer/action-icon'
import { RuleCardItemDialog, type RuleCardDialogMode } from '@/components/organizer/season-settings/rule-card-dialogs'
import {
  appendRuleCardItem,
  MAX_RULE_CARD_ITEMS,
  reorderRuleCardItems,
  updateRuleCardItem,
  type RuleCardDraftItem,
} from '@/lib/organizer-rules'

/**
 * 规则卡编辑器。
 *
 * 一行 = 一条规则卡条目，顺序即保存顺序（后端按下标写 `sortOrder`）。
 *
 * 交互口径（与产品截图一致）：
 *   · 新增 / 修改都走弹窗（`rule-card-dialogs.tsx`）：取消不改草稿，确认才回写；
 *   · 排序靠**拖动**：整行 `draggable`，把手是可聚焦的 `<button>`，
 *     键盘聚焦把手后 Alt+↑ / Alt+↓ 等价移动（无障碍底线：不能只支持鼠标）；
 *   · 必要项（key 在 `SEASON_REQUIRED_RULE_CARD_KEYS` 里）由赛季配置生成：
 *     名称与内容都只读，带「必要 · 锁定」chip，没有修改 / 删除 / 隐藏入口。
 *
 * 操作列用**图标按钮**（`ui-icon-btn ui-icon-btn--sm` + `OrganizerActionIcon`）：
 * 这张表已经够宽（条目 / 内容 / 操作），三个中文按钮并排会把「内容」列挤扁。
 * 语义不丢 —— 每个按钮都带完整中文 `aria-label` 与 `title`，读屏与悬停拿到
 * 的都是文字，视觉用户拿到的是形状。
 *
 * 组件本身不发请求，也不做保存校验：调用方拿到新数组后自己决定何时保存。
 */
export function RuleCardEditor({
  items,
  onChange,
  disabled = false,
}: {
  items: RuleCardDraftItem[]
  onChange: (next: RuleCardDraftItem[]) => void
  disabled?: boolean
}) {
  const canAdd = !disabled && items.length < MAX_RULE_CARD_ITEMS

  /** 打开中的弹窗：新增，或修改第 index 行。 */
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; index: number } | null
  >(null)
  /** 触发弹窗的按钮：关闭后把焦点还回去。 */
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  /** 拖动状态：从哪一行开始、当前插入到哪个下标（`to` 语义，见 reorderRuleCardItems）。 */
  const [dragging, setDragging] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  /** 键盘重排后的读屏播报（拖动对键盘用户没有反馈，用 status 补上）。 */
  const [announcement, setAnnouncement] = useState('')

  /** 用名称（没填时退回 key）拼无障碍名，读屏能听出操作的是哪一行。 */
  const nameOf = (item: RuleCardDraftItem) => item.label.trim() || item.key

  function reorder(from: number, to: number) {
    const next = reorderRuleCardItems(items, from, to)
    if (next === items) return
    onChange(next)
    const moved = items[from]
    const position = next.indexOf(moved) + 1
    setAnnouncement(`「${nameOf(moved)}」已移动到第 ${position} 条`)
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

  function openDialog(mode: RuleCardDialogMode, index: number | null, trigger: HTMLButtonElement) {
    if (disabled) return
    triggerRef.current = trigger
    setDialog(mode === 'create' ? { mode: 'create' } : { mode: 'edit', index: index ?? 0 })
  }

  /** 关闭弹窗并把焦点还给触发按钮（`aria-modal` 弹窗的焦点契约）。 */
  function closeDialog() {
    setDialog(null)
    triggerRef.current?.focus()
  }

  function confirmDialog(input: { label: string; value: string; visible: boolean }) {
    if (!dialog) return
    onChange(
      dialog.mode === 'create'
        ? appendRuleCardItem(items, input)
        : updateRuleCardItem(items, dialog.index, input),
    )
    closeDialog()
  }

  const editing = dialog?.mode === 'edit' ? items[dialog.index] : undefined

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ui-hint">
          必要条目由赛季配置生成，不能手写也不能隐藏；可选条目可以新增、修改、删除、隐藏与拖动排序，最多{' '}
          {MAX_RULE_CARD_ITEMS} 条。拖动把手可排序，键盘聚焦把手后按 Alt+↑ / Alt+↓ 也能移动。
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={(event) => openDialog('create', null, event.currentTarget)}
          disabled={!canAdd}
          aria-label="新增规则"
        >
          新增规则
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="ui-hint">还没有规则卡条目。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="console-table">
            <caption className="sr-only">
              规则卡条目（按显示顺序排列；拖动把手或用 Alt+↑ / Alt+↓ 调整顺序）
            </caption>
            <thead>
              <tr>
                <th scope="col">顺序</th>
                <th scope="col">#</th>
                <th scope="col">条目</th>
                <th scope="col">内容</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const hidden = item.visible === false
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
                    key={item.key || `row-${index}`}
                    data-testid={`rule-card-row-${index}`}
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
                      hidden && 'opacity-60',
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
                      {/* 条目列只留名称与状态 chip：字段名（如 max_project_challenges）
                          是后端标识，主办方看不懂，放在这里只会挤占宽度。 */}
                      <div className="grid gap-2">
                        <span className="text-body-sm font-bold text-foreground">
                          {item.label.trim() || item.key}
                        </span>
                        {item.required || hidden ? (
                          <span className="flex flex-wrap items-center gap-2">
                            {item.required ? (
                              <Chip tone="accent" className="text-meta">
                                必要 · 锁定
                              </Chip>
                            ) : null}
                            {hidden ? (
                              <Chip tone="neutral" className="text-meta">
                                已隐藏
                              </Chip>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="min-w-64">
                      <p className="text-body-sm leading-relaxed text-foreground">
                        {item.value.trim() || <span className="text-muted-foreground">（未填写）</span>}
                      </p>
                    </td>

                    <td className="whitespace-nowrap">
                      {item.required ? (
                        <span className="ui-hint">由赛季配置生成，不可编辑</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="ui-icon-btn ui-icon-btn--sm"
                            onClick={(event) => openDialog('edit', index, event.currentTarget)}
                            disabled={disabled}
                            aria-label={`修改条目 ${name}`}
                            title="修改"
                          >
                            <OrganizerActionIcon name="edit" />
                          </button>
                          <button
                            type="button"
                            className="ui-icon-btn ui-icon-btn--sm"
                            onClick={() => onChange(items.filter((_, i) => i !== index))}
                            disabled={disabled}
                            aria-label={`删除条目 ${name}`}
                            title="删除"
                          >
                            <OrganizerActionIcon name="delete" />
                          </button>
                          <button
                            type="button"
                            className="ui-icon-btn ui-icon-btn--sm"
                            onClick={() =>
                              onChange(
                                items.map((current, i) =>
                                  i === index ? { ...current, visible: hidden } : current,
                                ),
                              )
                            }
                            disabled={disabled}
                            aria-pressed={!hidden}
                            aria-label={hidden ? `显示条目 ${name}` : `隐藏条目 ${name}`}
                            title={hidden ? '显示' : '隐藏'}
                          >
                            <OrganizerActionIcon name={hidden ? 'show' : 'hide'} />
                          </button>
                        </div>
                      )}
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
        <RuleCardItemDialog
          mode={dialog.mode}
          initial={
            dialog.mode === 'edit' && editing
              ? { label: editing.label, value: editing.value, visible: editing.visible }
              : undefined
          }
          onCancel={closeDialog}
          onConfirm={confirmDialog}
        />
      ) : null}
    </div>
  )
}
