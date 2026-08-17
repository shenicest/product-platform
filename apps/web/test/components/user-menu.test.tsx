import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Role } from '@shenicest/shared'
import { UserMenu } from '@/components/user-menu'

const logout = vi.fn()
const getConnections = vi.fn()
let auth = {
  user: { user_id: 7, email: 'name@example.com', role: 'founder', roles: [Role.Founder] },
  loading: false,
}

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ ...auth, logout }),
}))
vi.mock('@/lib/client-api', () => ({
  getConnections: () => getConnections(),
}))

describe('UserMenu', () => {
  beforeEach(() => {
    logout.mockClear()
    getConnections.mockReset()
    getConnections.mockResolvedValue({ data: { pendingReceived: 120 } })
    auth = {
      user: { user_id: 7, email: 'name@example.com', role: 'founder', roles: [Role.Founder] },
      loading: false,
    }
  })

  it('shows the username and account actions', async () => {
    render(<UserMenu />)

    expect(screen.getByText('name@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /连接记录/ })).toHaveAttribute('href', '/connections')
    expect(screen.getByRole('link', { name: '编辑我的档案' })).toHaveAttribute('href', '/talents/me/edit')
    expect(screen.getByRole('link', { name: '创始人后台' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '运营后台' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument())
  })

  it('logs out from the menu', async () => {
    const user = userEvent.setup()
    render(<UserMenu />)

    await user.click(screen.getByRole('button', { name: '退出登录' }))
    expect(logout).toHaveBeenCalledOnce()
  })
})
