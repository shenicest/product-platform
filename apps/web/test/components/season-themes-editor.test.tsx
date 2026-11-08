import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SeasonThemesEditor } from '@/components/organizer/season-settings/season-themes-editor'
import { MAX_SEASON_THEMES, toThemeDraft, type ThemeDraftItem } from '@/lib/organizer-themes'

const THEMES = ['新型储能基建', '全球 AI 基建', '新生产关系的人本基建']

function initialItems(): ThemeDraftItem[] {
  return toThemeDraft(THEMES)
}

/** 受控包装：让排序 / 删除真的反映到 DOM 上。 */
function Harness({
  initial = initialItems(),
  disabled = false,
  onChange,
}: {
  initial?: ThemeDraftItem[]
  disabled?: boolean
  onChange?: (next: ThemeDraftItem[]) => void
}) {
  const [items, setItems] = useState(initial)
  return (
    <SeasonThemesEditor
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
function dragEvent(
  type: 'dragstart' | 'dragover' | 'drop' | 'dragend',
  element: Element,
  clientY = 0,
) {
  fireEvent(element, new MouseEvent(type, { bubbles: true, cancelable: true, clientY }))
}

describe('SeasonThemesEditor · 渲染', () => {
  it('renders every theme with its order number', () => {
    render(<Harness />)
    expect(screen.getAllByRole('row')).toHaveLength(THEMES.length + 1)
    for (const theme of THEMES) {
      expect(screen.getByText(theme)).toBeInTheDocument()
    }
    expect(bodyRows()[0]).toHaveTextContent('1')
  })

  it('shows the four console-table columns', () => {
    render(<Harness />)
    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent)
    expect(headers).toEqual(['顺序', '#', '主题', '操作'])
  })

  it('renders the empty state when there are no themes', () => {
    render(<Harness initial={[]} />)
    expect(screen.getByText('还没有赛季主题。')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('offers no 上移 / 下移 buttons (drag + Alt+↑/↓ is the only reorder path)', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: /上移/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /下移/ })).not.toBeInTheDocument()
  })
})

describe('SeasonThemesEditor · 新增主题弹窗', () => {
  it('opens a dialog with the create title and an empty field', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: '新增主题' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('heading', { name: '新增主题' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/主题名称/)).toHaveValue('')
    // 打开时焦点落在输入框。
    expect(within(dialog).getByLabelText(/主题名称/)).toHaveFocus()
  })

  it('appends the theme only after confirming', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '新增主题' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/主题名称/), '机器人')
    await user.click(within(dialog).getByRole('button', { name: '确认新增' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as ThemeDraftItem[]
    expect(next).toHaveLength(THEMES.length + 1)
    expect(next.at(-1)).toEqual({ key: '机器人', theme: '机器人' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // 关闭后焦点回到触发按钮。
    expect(screen.getByRole('button', { name: '新增主题' })).toHaveFocus()
  })

  it('cancelling does not change the list', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '新增主题' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/主题名称/), '不保存的主题')
    await user.click(within(dialog).getByRole('button', { name: '取消' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('不保存的主题')).not.toBeInTheDocument()
  })

  it('rejects an empty theme before appending', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '新增主题' }))
    await user.click(screen.getByRole('button', { name: '确认新增' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('请填写主题名称')).toBeInTheDocument()
  })

  it('rejects a theme that already exists', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '新增主题' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/主题名称/), THEMES[0])
    await user.click(within(dialog).getByRole('button', { name: '确认新增' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(`主题「${THEMES[0]}」已经存在`)).toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: '新增主题' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('disables 新增主题 once the cap is reached', () => {
    const full = toThemeDraft(
      Array.from({ length: MAX_SEASON_THEMES }, (_, index) => `主题${index + 1}`),
    )
    render(<Harness initial={full} />)
    expect(screen.getByRole('button', { name: '新增主题' })).toBeDisabled()
  })
})

describe('SeasonThemesEditor · 修改主题弹窗', () => {
  it('prefills the dialog with the row value and updates that row', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: `修改主题 ${THEMES[1]}` }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: '修改主题' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/主题名称/)).toHaveValue(THEMES[1])

    await user.clear(within(dialog).getByLabelText(/主题名称/))
    await user.type(within(dialog).getByLabelText(/主题名称/), '全球 AI 与机器人')
    await user.click(within(dialog).getByRole('button', { name: '保存修改' }))

    const next = onChange.mock.calls[0][0] as ThemeDraftItem[]
    expect(next).toHaveLength(THEMES.length)
    expect(next[1]).toEqual({ key: '全球 AI 与机器人', theme: '全球 AI 与机器人' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('allows keeping the unchanged theme of the row being edited', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: `修改主题 ${THEMES[1]}` }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '保存修改' }))

    // 自己那一行的主题不算「已存在」。
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('SeasonThemesEditor · 排序', () => {
  it('moves a row down with Alt+↓ on the drag handle', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const handle = screen.getByRole('button', { name: new RegExp(`拖动排序 ${THEMES[0]}`) })
    fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true })

    const next = onChange.mock.calls[0][0] as ThemeDraftItem[]
    expect(next.map((item) => item.theme)).toEqual([THEMES[1], THEMES[0], THEMES[2]])
    // 键盘重排有读屏播报。
    expect(screen.getByRole('status')).toHaveTextContent(
      `「${THEMES[0]}」已移动到第 2 个主题`,
    )
  })

  it('moves a row up with Alt+↑ on the drag handle', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('button', { name: new RegExp(`拖动排序 ${THEMES[2]}`) }), {
      key: 'ArrowUp',
      altKey: true,
    })

    const next = onChange.mock.calls[0][0] as ThemeDraftItem[]
    expect(next.map((item) => item.theme)).toEqual([THEMES[0], THEMES[2], THEMES[1]])
  })

  it('keeps focus on the handle so several keyboard moves can be chained', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const handle = screen.getByRole('button', { name: new RegExp(`拖动排序 ${THEMES[2]}`) })
    handle.focus()
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')

    // 行跟着移动，但焦点仍在这一行的把手上，可以接着按。
    expect(screen.getByRole('button', { name: new RegExp(`拖动排序 ${THEMES[2]}`) })).toHaveFocus()
    expect(bodyRows()[1]).toHaveTextContent(THEMES[2])
  })

  it('does nothing without Alt', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('button', { name: new RegExp(`拖动排序 ${THEMES[2]}`) }), {
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

    const next = onChange.mock.calls[0][0] as ThemeDraftItem[]
    expect(next.map((item) => item.theme)).toEqual([THEMES[1], THEMES[0], THEMES[2]])
  })

  it('drops before the hovered row when hovering its upper half', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    const rows = bodyRows()
    dragEvent('dragstart', rows[2])
    dragEvent('dragover', rows[0], -1)
    dragEvent('drop', rows[0], -1)

    const next = onChange.mock.calls[0][0] as ThemeDraftItem[]
    expect(next.map((item) => item.theme)).toEqual([THEMES[2], THEMES[0], THEMES[1]])
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

describe('SeasonThemesEditor · 删除', () => {
  it('removes a theme', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: `删除主题 ${THEMES[0]}` }))

    const next = onChange.mock.calls[0][0] as ThemeDraftItem[]
    expect(next.map((item) => item.theme)).toEqual([THEMES[1], THEMES[2]])
    expect(screen.queryByText(THEMES[0])).not.toBeInTheDocument()
  })
})

describe('SeasonThemesEditor · 禁用态', () => {
  it('disables every interaction when disabled', () => {
    render(<Harness disabled />)
    expect(screen.getByRole('button', { name: '新增主题' })).toBeDisabled()
    expect(screen.getByRole('button', { name: new RegExp(`拖动排序 ${THEMES[0]}`) })).toBeDisabled()
    expect(screen.getByRole('button', { name: `修改主题 ${THEMES[0]}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: `删除主题 ${THEMES[0]}` })).toBeDisabled()
  })

  it('does not start a drag when disabled', () => {
    const onChange = vi.fn()
    render(<Harness disabled onChange={onChange} />)

    const rows = bodyRows()
    dragEvent('dragstart', rows[0])
    dragEvent('dragover', rows[1], 10)
    dragEvent('drop', rows[1], 10)
    expect(onChange).not.toHaveBeenCalled()
  })
})
