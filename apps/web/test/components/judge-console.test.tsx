import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { JudgeConsole } from '@/components/judge/judge-console'
import { getDemoState, resetDemoState } from '@/lib/season-demo-store'

/** 按作品标题定位评分队列表格里的那一行。 */
function rowFor(title: string): HTMLElement {
  const queue = screen.getByRole('table', { name: '评委评分队列' })
  const row = within(queue).getByText(title).closest('tr')
  if (!row) throw new Error(`未找到作品行：${title}`)
  return row
}

describe('JudgeConsole · 评分权限', () => {
  beforeEach(() => {
    resetDemoState()
  })

  it('同一评委对同一作品版本只能评分一次', async () => {
    const user = userEvent.setup()
    render(<JudgeConsole />)

    // 评审甲在 mock 数据里已经评过 v2，页面应显示「已评分」而不是再给一个评分按钮。
    const reviewedRow = rowFor('M2 客户访谈复盘')
    expect(within(reviewedRow).queryByRole('button', { name: '评分' })).not.toBeInTheDocument()
    expect(within(reviewedRow).getAllByText('已评分').length).toBeGreaterThan(0)

    // 另一份尚未评过的作品可以正常打分；提交后也会变成「已评分」。
    const freshRow = rowFor('边缘调度原型 v0.2')
    await user.click(within(freshRow).getByRole('button', { name: '评分' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/分值/), '12')
    await user.type(
      within(dialog).getByLabelText(/评分理由/),
      '原型已经跑通峰谷电价与节点负载，建议补一次真实现场验证。',
    )
    await user.click(within(dialog).getByRole('button', { name: '确认评分' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const updatedRow = rowFor('边缘调度原型 v0.2')
    expect(within(updatedRow).queryByRole('button', { name: '评分' })).not.toBeInTheDocument()
  })

  it('不予赋分会记录 0 分结论并退回作品，但不占用评分额度', async () => {
    const user = userEvent.setup()
    render(<JudgeConsole />)

    const freshRow = rowFor('边缘调度原型 v0.2')
    await user.click(within(freshRow).getByRole('button', { name: '评分' }))

    const dialog = screen.getByRole('dialog')
    await user.type(
      within(dialog).getByLabelText(/评分理由/),
      '本版本缺少可核验的客户证据，暂不予赋分，请补充后重新提交。',
    )
    await user.click(within(dialog).getByRole('button', { name: '不予赋分' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const state = getDemoState()
    const work = state.works.find((item) => item.title === '边缘调度原型 v0.2')
    expect(work?.status).toBe('changes_requested')
    expect(work?.reviews.at(-1)?.status).toBe('不予赋分')
    expect(state.allocations.find((item) => item.judgeName === '评审甲')?.usedAmount).toBe(88)
  })
})
