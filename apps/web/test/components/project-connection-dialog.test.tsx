import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectConnectButton, projectPendingConnectKey } from '@/components/project-connection-dialog'
import { sendProjectConnection } from '@/lib/client-api'

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
const authState = vi.hoisted(() => ({ user: null as { user_id: string } | null }))

vi.mock('@/lib/client-api', () => ({
  sendProjectConnection: vi.fn(),
  getMyProjectConnection: vi.fn(),
}))
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ user: authState.user, loading: false, isAuthenticated: !!authState.user, refresh: vi.fn(), logout: vi.fn() }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, back: vi.fn(), replace: vi.fn(), preload: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  authState.user = { user_id: '42' }
  sessionStorage.clear()
  vi.mocked(sendProjectConnection).mockResolvedValue({
    data: { id: 7, status: 0, createdAt: '2026-09-07T10:00:00.000Z' },
    error: null,
  })
})

describe('ProjectConnectButton', () => {
  it('hides the entry for owners and non-Live projects', () => {
    const { container } = render(
      <ProjectConnectButton projectId={63} initialStatus={envelope(null, { viewerIsReceiver: true })} />,
    )
    expect(container).toBeEmptyDOMElement()

    const disabled = render(
      <ProjectConnectButton projectId={63} initialStatus={envelope(null, { receiverConfigured: false })} />,
    )
    expect(disabled.container).toBeEmptyDOMElement()
  })

  it('redirects logged-out visitors to the project login return path', async () => {
    authState.user = null
    const user = userEvent.setup()
    render(<ProjectConnectButton projectId={63} initialStatus={null} />)
    await user.click(screen.getByRole('button', { name: /联系项目方/ }))

    expect(sessionStorage.getItem(projectPendingConnectKey(63))).toBe('63')
    expect(push).toHaveBeenCalledWith('/login?returnTo=/projects/63')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('auto-opens the dialog after login and submits through the project endpoint', async () => {
    sessionStorage.setItem(projectPendingConnectKey(63), '63')
    const user = userEvent.setup()
    render(<ProjectConnectButton projectId={63} initialStatus={null} />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('联系目的'), '寻求反馈')
    fireEvent.change(screen.getByLabelText(/留言/), {
      target: { value: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。' },
    })
    await user.type(screen.getByLabelText(/^手机号/), '138-0013-8000')
    await user.click(screen.getByRole('button', { name: '发送申请' }))

    await waitFor(() =>
      expect(sendProjectConnection).toHaveBeenCalledWith(63, {
        purpose: '寻求反馈',
        message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。',
        wechat: undefined,
        phone: '138-0013-8000',
        email: undefined,
      }),
    )
    expect(screen.getByText('等待项目方回应')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})

function envelope(
  data: { id: number; status: number; createdAt: string } | null,
  overrides: { receiverConfigured?: boolean; viewerIsReceiver?: boolean } = {},
) {
  return {
    data,
    receiverConfigured: overrides.receiverConfigured ?? true,
    viewerIsReceiver: overrides.viewerIsReceiver ?? false,
  }
}
