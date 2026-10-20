import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TalentEditor } from '@/components/talent/talent-ui'

vi.mock('@/lib/client-api', () => ({
  acceptTalentConnection: vi.fn(),
  getConnections: vi.fn(),
  ignoreTalentConnection: vi.fn(),
  pauseTalent: vi.fn(),
  saveTalent: vi.fn(),
  sendTalentConnection: vi.fn(),
  suspendTalent: vi.fn(),
}))
vi.mock('@/components/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('TalentEditor (v2 dual-state skill wall)', () => {
  it('renders four sections with the six-item required counter and four anchors', () => {
    render(<TalentEditor initial={null} userId="1" />)

    expect(screen.getByRole('heading', { name: '告诉大家，你擅长做什么。' })).toBeInTheDocument()
    expect(screen.getByText('档案完成度')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0 / 6 REQUIRED ITEMS')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: '档案填写进度' })
    for (const label of ['01 基础介绍', '02 关于我和作品', '03 技能墙', '04 合作意向']) {
      expect(nav).toHaveTextContent(label)
    }
    expect(screen.getByRole('heading', { name: '先让别人快速认识你' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '讲讲你的经历和作品' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '一面技能墙，两个状态' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '说明你想遇见怎样的合作' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('例如：擅长从 0 到 1 的 AI 产品经理')).toBeInTheDocument()
    expect(screen.getByText('让做过的产品替你说话')).toBeInTheDocument()
    expect(screen.getByText('积极寻找合作')).toBeInTheDocument()
    expect(screen.getByText('开放聊聊')).toBeInTheDocument()
    expect(screen.getByText('仅接受一次咨询')).toBeInTheDocument()
    expect(screen.queryByText('方向（至少 1 个）')).not.toBeInTheDocument()
  })

  it('cycles a wall tag through 未选 → 我能提供 → 我想寻找 → 未选 with distinct visuals', async () => {
    const user = userEvent.setup()
    render(<TalentEditor initial={null} userId="1" />)

    const provide = screen.getByRole('button', { name: '产品策略' })
    expect(provide).toHaveAttribute('data-state', 'none')
    await user.click(provide)
    const providing = screen.getByRole('button', { name: '产品策略，我能提供' })
    expect(providing).toHaveAttribute('data-state', 'provide')
    expect(providing).toHaveClass('ui-chip--active')
    await user.click(screen.getByRole('button', { name: '产品策略，我能提供' }))
    const seeking = screen.getByRole('button', { name: '产品策略，我想寻找' })
    expect(seeking).toHaveAttribute('data-state', 'seeking')
    // Seeking must not inherit the pressed/active brand look.
    expect(seeking).toHaveClass('ui-chip--seeking')
    expect(seeking).not.toHaveClass('ui-chip--active')
    await user.click(screen.getByRole('button', { name: '产品策略，我想寻找' }))
    expect(screen.getByRole('button', { name: '产品策略' })).toHaveAttribute('data-state', 'none')

    expect(screen.getByText('我能提供 0 / 10（至少 3 项）')).toBeInTheDocument()
    expect(screen.getByText('我想寻找 0 / 5（可选）')).toBeInTheDocument()
  })

  it('enforces the provide/seek caps: provide stops at 10, a capped seeking wall drops back to 未选', async () => {
    const user = userEvent.setup()
    render(<TalentEditor initial={null} userId="1" />)

    const wall = ['产品策略', '需求分析', '用户研究', '项目管理', 'UI', 'UX', '视觉', '品牌', '动效', '增长策略']
    // 未选 → 我能提供 for ten tags; an 11th stays unselected (provide cap).
    for (const skill of wall) await user.click(screen.getByRole('button', { name: skill }))
    expect(screen.getByText('我能提供 10 / 10（至少 3 项）')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '内容策划' }))
    expect(screen.queryByRole('button', { name: '内容策划，我能提供' })).not.toBeInTheDocument()
    expect(screen.getByText('我能提供 10 / 10（至少 3 项）')).toBeInTheDocument()

    // 我能提供 → 我想寻找 for the first five; once seek is full the remaining
    // providing tags cycle straight back to 未选.
    for (const skill of wall) await user.click(screen.getByRole('button', { name: `${skill}，我能提供` }))
    expect(screen.getByText('我想寻找 5 / 5（可选）')).toBeInTheDocument()
    expect(screen.getByText('我能提供 0 / 10（至少 3 项）')).toBeInTheDocument()
  })

  it('grows and shrinks the work links list between 0 and 3', async () => {
    const user = userEvent.setup()
    render(<TalentEditor initial={null} userId="1" />)

    expect(screen.queryByLabelText('作品链接 1')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ 添加作品链接' }))
    expect(screen.getByLabelText('作品链接 1')).toBeInTheDocument()
    await user.type(screen.getByLabelText('作品链接 1'), 'https://github.com/me')
    await user.click(screen.getByRole('button', { name: '+ 添加作品链接' }))
    await user.click(screen.getByRole('button', { name: '+ 添加作品链接' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '移除作品链接 2' }))
    expect(screen.queryByLabelText('作品链接 3')).not.toBeInTheDocument()
    expect(screen.getByLabelText('作品链接 2')).toBeInTheDocument()
  })

  it('picks exactly one availability state', async () => {
    const user = userEvent.setup()
    render(<TalentEditor initial={null} userId="1" />)

    const consult = screen.getByRole('button', { name: '仅接受一次咨询' })
    expect(consult).toHaveAttribute('aria-pressed', 'false')
    await user.click(consult)
    expect(consult).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '开放聊聊' }))
    expect(screen.getByRole('button', { name: '开放聊聊' })).toHaveAttribute('aria-pressed', 'true')
    expect(consult).toHaveAttribute('aria-pressed', 'false')
  })
})
