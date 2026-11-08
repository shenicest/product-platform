import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SEASON_REQUIRED_RULE_CARD_KEYS } from '@shenicest/shared'
import { RuleCardEditor } from '@/components/organizer/season-settings/rule-card-editor'
import type { RuleCardDraftItem } from '@/lib/organizer-rules'

/** 三条必要项 + 两条可选条目，够覆盖锁定 / 弹窗修改 / 排序 / 删除。 */
const REQUIRED_KEYS = SEASON_REQUIRED_RULE_CARD_KEYS.slice(0, 3)

function initialItems(): RuleCardDraftItem[] {
  return [
    ...REQUIRED_KEYS.map((key, index) => ({
      key,
      label: `必要条目 ${index + 1}`,
      value: `必要内容 ${index + 1}`,
      required: true,
      visible: true,
    })),
    {
      key: 'custom_1',
      label: '自定义条目',
      value: '自定义内容',
      required: false,
      visible: true,
    },
    {
      key: 'custom_2',
      label: '第二条自定义',
      value: '第二条内容',
      required: false,
      visible: true,
    },
  ]
}

/** 受控包装：让排序 / 删除真的反映到 DOM 上。 */
function Harness({
  initial = initialItems(),
  disabled = false,
  onChange,
}: {
  initial?: RuleCardDraftItem[]
  disabled?: boolean
  onChange?: (next: RuleCardDraftItem[]) => void
}) {
  const [items, setItems] = useState(initial)
  return (
    <RuleCardEditor
      items={items}
      disabled={disabled}
      onChange={(next) => {
        onChange?.(next)
        setItems(next)
      }}
    />
  )
}

/** 表格里的行（排除表头）。 */
function bodyRows() {
  const table = screen.getByRole('table')
  return within(table).getAllByRole('row').slice(1)
}

/**
 * jsdom 没有 DragEvent 的坐标信息，`fireEvent.dragOver` 拿不到 `clientY`
 * （组件据此判断「插到目标行之前还是之后」）。这里直接派发带坐标的
 * MouseEvent，React 的 `onDragOver` / `onDrop` 一样会收到。
 */
function dragEvent(type: 'dragstart' | 'dragover' | 'drop' | 'dragend', element: Element, clientY = 0) {
  fireEvent(element, new MouseEvent(type, { bubbles: true, cancelable: true, clientY }))
}

describe('RuleCardEditor · 渲染与必要条目', () => {
  it('renders every item with its order number and content', () => {
    render(<Harness />)
    expect(screen.getAllByRole('row')).toHaveLength(initialItems().length + 1)
    expect(screen.getByText('必要条目 1')).toBeInTheDocument()
    expect(screen.getByText('必要内容 1')).toBeInTheDocument()
    expect(screen.getByText('自定义内容')).toBeInTheDocument()
    expect(screen.getAllByText('必要 · 锁定')).toHaveLength(REQUIRED_KEYS.length)
  })

  it('keeps required items fully read-only: no inputs and no edit/delete/hide buttons', () => {
    render(<Harness />)
    // 必要项不渲染任何 input / textarea。
    expect(screen.queryByLabelText('条目名称（第 1 行）')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('条目内容（第 1 行）')).not.toBeInTheDocument()
    // 也没有修改 / 删除 / 隐藏入口。
    expect(screen.queryByRole('button', { name: '修改条目 必要条目 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除条目 必要条目 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /隐藏条目 必要条目 1/ })).not.toBeInTheDocument()
    expect(screen.getAllByText('由赛季配置生成，不可编辑')).toHaveLength(REQUIRED_KEYS.length)
  })

  it('shows only the item label in the 条目 column, not the backend field key', () => {
    render(<Harness />)
    // 字段名（如 max_project_challenges）是后端标识，不再出现在表格里。
    for (const key of REQUIRED_KEYS) {
      expect(screen.queryByText(key)).not.toBeInTheDocument()
    }
    expect(screen.queryByText('custom_1')).not.toBeInTheDocument()
    // 名称与状态 chip 仍在。
    expect(screen.getByText('必要条目 1')).toBeInTheDocument()
    expect(screen.getByText('自定义条目')).toBeInTheDocument()
  })

  it('no longer offers 上移 / 下移 buttons', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /上移/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /下移/ })).not.toBeInTheDocument()
  })
})

describe('RuleCardEditor · 新增规则弹窗', () => {
  it('opens a dialog with the create title and an empty form', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: '新增规则' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('heading', { name: '新增规则' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/条目名称/)).toHaveValue('')
    expect(within(dialog).getByLabelText(/条目内容/)).toHaveValue('')
    expect(within(dialog).getByRole('checkbox', { name: '是否显示' })).toBeChecked()
    // 打开时焦点落在第一个输入框。
    expect(within(dialog).getByLabelText(/条目名称/)).toHaveFocus()
  })

  it('appends the item only after confirming', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '新增规则' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/条目名称/), '新的规则')
    await user.type(within(dialog).getByLabelText(/条目内容/), '新的内容')
    await user.click(within(dialog).getByRole('button', { name: '确认新增' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next).toHaveLength(initialItems().length + 1)
    expect(next[next.length - 1]).toMatchObject({
      key: 'custom_3',
      label: '新的规则',
      value: '新的内容',
      required: false,
      visible: true,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // 关闭后焦点回到触发按钮。
    expect(screen.getByRole('button', { name: '新增规则' })).toHaveFocus()
  })

  it('cancelling does not change the list', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '新增规则' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/条目名称/), '不保存的规则')
    await user.click(within(dialog).getByRole('button', { name: '取消' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('不保存的规则')).not.toBeInTheDocument()
  })

  it('validates required fields before appending', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '新增规则' }))
    await user.click(screen.getByRole('button', { name: '确认新增' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('请填写条目名称')).toBeInTheDocument()
    expect(screen.getByText('请填写条目内容')).toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: '新增规则' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

describe('RuleCardEditor · 修改规则弹窗', () => {
  it('prefills the dialog with the row values and updates that row', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '修改条目 自定义条目' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: '修改规则' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/条目名称/)).toHaveValue('自定义条目')
    expect(within(dialog).getByLabelText(/条目内容/)).toHaveValue('自定义内容')

    await user.clear(within(dialog).getByLabelText(/条目内容/))
    await user.type(within(dialog).getByLabelText(/条目内容/), '改过的内容')
    await user.click(within(dialog).getByRole('button', { name: '保存修改' }))

    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next).toHaveLength(initialItems().length)
    expect(next[REQUIRED_KEYS.length]).toMatchObject({
      key: 'custom_1',
      label: '自定义条目',
      value: '改过的内容',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('can hide an item from the dialog', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '修改条目 自定义条目' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('checkbox', { name: '是否显示' }))
    await user.click(within(dialog).getByRole('button', { name: '保存修改' }))

    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next[REQUIRED_KEYS.length].visible).toBe(false)
    expect(screen.getByText('已隐藏')).toBeInTheDocument()
  })
})

describe('RuleCardEditor · 排序', () => {
  it('moves a row down with Alt+↓ on the drag handle', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const handle = screen.getByRole('button', { name: /拖动排序 必要条目 1/ })
    fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true })

    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next.map((item) => item.key)).toEqual([
      REQUIRED_KEYS[1],
      REQUIRED_KEYS[0],
      REQUIRED_KEYS[2],
      'custom_1',
      'custom_2',
    ])
    // 键盘重排有读屏播报。
    expect(screen.getByRole('status')).toHaveTextContent('「必要条目 1」已移动到第 2 条')
  })

  it('moves a row up with Alt+↑ on the drag handle', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('button', { name: /拖动排序 自定义条目/ }), {
      key: 'ArrowUp',
      altKey: true,
    })

    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next.map((item) => item.key)).toEqual([
      REQUIRED_KEYS[0],
      REQUIRED_KEYS[1],
      'custom_1',
      REQUIRED_KEYS[2],
      'custom_2',
    ])
  })

  it('keeps focus on the handle so several keyboard moves can be chained', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const handle = screen.getByRole('button', { name: /拖动排序 自定义条目/ })
    handle.focus()
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')

    // 行跟着移动，但焦点仍在这一行的把手上，可以接着按。
    expect(screen.getByRole('button', { name: /拖动排序 自定义条目/ })).toHaveFocus()
    expect(bodyRows()[REQUIRED_KEYS.length - 1]).toHaveTextContent('自定义条目')
  })

  it('does nothing without Alt', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('button', { name: /拖动排序 自定义条目/ }), {
      key: 'ArrowUp',
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reorders on drop after dragging a row', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const rows = bodyRows()
    // 把第 1 行拖到第 2 行下半部 → 插到第 2 行之后。
    // （jsdom 里 getBoundingClientRect 全是 0，所以 clientY > 0 即「下半部」。）
    dragEvent('dragstart', rows[0])
    dragEvent('dragover', rows[1], 10)
    dragEvent('drop', rows[1], 10)

    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next.map((item) => item.key)).toEqual([
      REQUIRED_KEYS[1],
      REQUIRED_KEYS[0],
      REQUIRED_KEYS[2],
      'custom_1',
      'custom_2',
    ])
  })

  it('drops before the hovered row when hovering its upper half', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const rows = bodyRows()
    dragEvent('dragstart', rows[2])
    dragEvent('dragover', rows[0], -1)
    dragEvent('drop', rows[0], -1)

    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next.map((item) => item.key)).toEqual([
      REQUIRED_KEYS[2],
      REQUIRED_KEYS[0],
      REQUIRED_KEYS[1],
      'custom_1',
      'custom_2',
    ])
  })

  it('marks the dragging row and clears it on dragend', () => {
    render(<Harness />)

    const rows = bodyRows()
    dragEvent('dragstart', rows[0])
    expect(rows[0].className).toContain('opacity-50')

    dragEvent('dragend', rows[0])
    expect(rows[0].className).not.toContain('opacity-50')
  })
})

describe('RuleCardEditor · 可选条目其它操作', () => {
  it('renders the row actions as icon buttons that keep their accessible names', () => {
    render(<Harness />)
    for (const [label, title] of [
      ['修改条目 自定义条目', '修改'],
      ['删除条目 自定义条目', '删除'],
      ['隐藏条目 自定义条目', '隐藏'],
    ] as const) {
      const button = screen.getByRole('button', { name: label })
      // 图标按钮：语义全部由 aria-label / title 承担，视觉上只有图标。
      expect(button).toHaveClass('ui-icon-btn')
      expect(button).toHaveAttribute('title', title)
      expect(button.querySelector('svg')).not.toBeNull()
      expect(button).not.toHaveTextContent('修改')
      expect(button).not.toHaveTextContent('删除')
    }
  })

  it('deletes an optional item', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '删除条目 自定义条目' }))

    const next = onChange.mock.calls[0][0] as RuleCardDraftItem[]
    expect(next).toHaveLength(initialItems().length - 1)
    expect(next.some((item) => item.key === 'custom_1')).toBe(false)
    expect(screen.queryByText('自定义条目')).not.toBeInTheDocument()
  })

  it('hides and un-hides an optional item from the row', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: '隐藏条目 自定义条目' }))
    expect(screen.getByRole('button', { name: '显示条目 自定义条目' })).toBeInTheDocument()
    expect(screen.getByText('已隐藏')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '显示条目 自定义条目' }))
    expect(screen.getByRole('button', { name: '隐藏条目 自定义条目' })).toBeInTheDocument()
  })
})

describe('RuleCardEditor · 禁用态', () => {
  it('disables every interaction when disabled', () => {
    render(<Harness disabled />)
    expect(screen.getByRole('button', { name: '新增规则' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /拖动排序 必要条目 1/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '修改条目 自定义条目' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '删除条目 自定义条目' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '隐藏条目 自定义条目' })).toBeDisabled()
  })
})
