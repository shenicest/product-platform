import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HackathonConnectButton, hackathonPendingConnectKey } from '@/components/hackathon-connection-dialog'
import { sendHackathonConnection } from '@/lib/client-api'

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
const authState = vi.hoisted(() => ({ user: null as { user_id: number; email?: string } | null }))

vi.mock('@/lib/client-api', () => ({
  sendHackathonConnection: vi.fn(),
  getMyHackathonConnection: vi.fn(),
}))
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ user: authState.user, loading: false, isAuthenticated: !!authState.user, refresh: vi.fn(), logout: vi.fn() }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, back: vi.fn(), replace: vi.fn(), preload: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { user_id: 42, email: 'user@example.com' }
  sessionStorage.clear()
  vi.mocked(sendHackathonConnection).mockResolvedValue({
    data: { id: 7, status: 0, createdAt: '2026-09-07T10:00:00.000Z' },
    error: null,
  })
})

describe('HackathonConnectButton', () => {
  it('shows static Pending and Accepted states without a submit button', () => {
    const pendingRender = render(<HackathonConnectButton projectId={42} initialStatus={{ id: 7, status: 0, createdAt: '' }} />)
    expect(screen.getByText('等待项目方回应')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /查看连接记录/ })).toHaveAttribute('href', '/connections')
    expect(screen.queryByRole('button', { name: /联系项目方/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发送申请' })).not.toBeInTheDocument()
    pendingRender.unmount()

    // Fresh mount (each server render passes its own initial status).
    render(<HackathonConnectButton projectId={42} initialStatus={{ id: 8, status: 1, createdAt: '' }} />)
    expect(screen.getByText('已建立连接')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /联系项目方/ })).not.toBeInTheDocument()
  })

  it('stores the pending-connect marker and redirects with returnTo for logged-out visitors', async () => {
    authState.user = null
    const user = userEvent.setup()
    render(<HackathonConnectButton projectId={42} initialStatus={null} />)

    await user.click(screen.getByRole('button', { name: /联系项目方/ }))

    expect(sessionStorage.getItem(hackathonPendingConnectKey(42))).toBe('42')
    expect(push).toHaveBeenCalledWith('/login?returnTo=/hackathon/projects/42')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('auto-opens the dialog after login but never auto-submits', async () => {
    sessionStorage.setItem(hackathonPendingConnectKey(42), '42')
    render(<HackathonConnectButton projectId={42} initialStatus={null} />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('联系目的')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    expect(sendHackathonConnection).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '发送申请' })).toBeEnabled()
  })

  it('validates purpose, message, and contacts before submitting', async () => {
    const user = userEvent.setup()
    render(<HackathonConnectButton projectId={42} initialStatus={null} />)
    await user.click(screen.getByRole('button', { name: /联系项目方/ }))

    await user.click(screen.getByRole('button', { name: '发送申请' }))
    expect(screen.getByText('请选择联系目的', { selector: 'p' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('联系目的'), '合作交流')
    await user.type(screen.getByLabelText(/留言/), '太短')
    await user.click(screen.getByRole('button', { name: '发送申请' }))
    expect(screen.getByText('留言请输入 30-500 个字符')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/留言/), { target: { value: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。' } })
    await user.click(screen.getByRole('button', { name: '发送申请' }))
    expect(screen.getByText('至少提供微信或邮箱')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'not-an-email' } })
    await user.click(screen.getByRole('button', { name: '发送申请' }))
    expect(screen.getByText('邮箱格式不正确')).toBeInTheDocument()

    expect(sendHackathonConnection).not.toHaveBeenCalled()
  })

  it('submits through the client API, shows Pending, and refreshes', async () => {
    const user = userEvent.setup()
    const message = '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。'
    render(<HackathonConnectButton projectId={42} initialStatus={null} />)
    await user.click(screen.getByRole('button', { name: /联系项目方/ }))

    await user.selectOptions(screen.getByLabelText('联系目的'), '合作交流')
    fireEvent.change(screen.getByLabelText(/留言/), { target: { value: message } })
    await user.type(screen.getByLabelText(/^微信号/), 'viewer-wx')
    await user.click(screen.getByRole('button', { name: '发送申请' }))

    await waitFor(() => expect(sendHackathonConnection).toHaveBeenCalledWith(42, {
      purpose: '合作交流',
      message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。',
      wechat: 'viewer-wx',
      email: undefined,
    }))
    expect(screen.getByText('等待项目方回应')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('disables the submit button while sending', async () => {
    const user = userEvent.setup()
    vi.mocked(sendHackathonConnection).mockReturnValue(new Promise(() => {}))
    render(<HackathonConnectButton projectId={42} initialStatus={null} />)
    await user.click(screen.getByRole('button', { name: /联系项目方/ }))

    await user.selectOptions(screen.getByLabelText('联系目的'), '合作交流')
    fireEvent.change(screen.getByLabelText(/留言/), { target: { value: baseMessage() } })
    await user.type(screen.getByLabelText(/^微信号/), 'viewer-wx')

    await user.click(screen.getByRole('button', { name: '发送申请' }))
    expect(screen.getByRole('button', { name: '发送中...' })).toBeDisabled()
    expect(screen.getByText('发送中...')).toBeInTheDocument()
  })

  it('surfaces backend errors inside the dialog without leaving it', async () => {
    const user = userEvent.setup()
    vi.mocked(sendHackathonConnection).mockResolvedValue({
      data: null,
      error: { status: 409, body: { error: { code: 'NO_RECEIVER_CONFIGURED', message: '该项目暂未配置接收人' } } },
    })
    render(<HackathonConnectButton projectId={42} initialStatus={null} />)
    await user.click(screen.getByRole('button', { name: /联系项目方/ }))

    await user.selectOptions(screen.getByLabelText('联系目的'), '合作交流')
    fireEvent.change(screen.getByLabelText(/留言/), { target: { value: baseMessage() } })
    await user.type(screen.getByLabelText(/^微信号/), 'viewer-wx')
    await user.click(screen.getByRole('button', { name: '发送申请' }))

    expect(await screen.findByText('该项目暂未配置接收人')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送申请' })).toBeEnabled()
  })
})

function baseMessage() {
  return '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待长期合作。'
}
