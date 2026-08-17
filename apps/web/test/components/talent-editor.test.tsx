import { render, screen, within } from '@testing-library/react'
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

describe('TalentEditor choices', () => {
  it('groups skills by direction and disables new choices at each limit', async () => {
    const user = userEvent.setup()
    render(<TalentEditor initial={null} userId="1" />)

    expect(screen.getByText('让做过的产品替你说话')).toBeInTheDocument()
    expect(screen.getByText(/成功上线的项目，会自动展示在公开人才档案中/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /去提交项目/ })).toHaveAttribute('href', '/submit')
    const skills = screen.getByRole('group', { name: /技能（至少 3 项）/ })
    const seeking = screen.getByRole('group', { name: /希望一起做什么/ })
    expect(within(skills).getAllByText('产品')).toHaveLength(1)
    expect(within(skills).getAllByText('设计')).toHaveLength(1)
    expect(within(skills).getAllByText('开发')).toHaveLength(1)
    expect(within(skills).getAllByText('增长/内容')).toHaveLength(1)
    expect(within(skills).getAllByText('运营')).toHaveLength(1)
    expect(within(skills).getAllByText('数据')).toHaveLength(1)
    expect(within(skills).getAllByText('其他')).toHaveLength(1)

    const roleChoices = ['产品', '设计', '开发']
    for (const role of roleChoices) await user.click(screen.getByRole('button', { name: role }))
    expect(screen.getByRole('button', { name: '运营' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '开发' }))
    expect(screen.getByRole('button', { name: '运营' })).toBeEnabled()

    const skillChoices = ['产品策略', '需求分析', '用户研究', '产品设计', '原型设计', '项目管理', 'UI 设计', 'UX 设计', '交互设计', '视觉设计']
    for (const skill of skillChoices) await user.click(within(skills).getByRole('button', { name: skill }))
    expect(within(skills).getByRole('button', { name: '品牌设计' })).toBeDisabled()
    expect(within(skills).getByText('已选 10 / 10')).toBeInTheDocument()

    const seekingChoices = ['产品策略', '需求分析', '用户研究', '产品设计', '原型设计']
    for (const skill of seekingChoices) await user.click(within(seeking).getByRole('button', { name: skill }))
    expect(within(seeking).getByRole('button', { name: '项目管理' })).toBeDisabled()
    expect(within(seeking).getByText('已选 5 / 5')).toBeInTheDocument()
  })
})
