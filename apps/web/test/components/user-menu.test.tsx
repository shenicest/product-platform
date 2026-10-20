import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  // 菜单用原生 <details> 承载，打开/关闭由 open 属性决定，所以直接断言该属性。
  const details = (container: HTMLElement) => container.querySelector('details')!

  it('closes when clicking outside the menu', async () => {
    const user = userEvent.setup()
    const { container } = render(<UserMenu />)

    await user.click(screen.getByText('name@example.com'))
    expect(details(container).open).toBe(true)

    fireEvent.pointerDown(document.body)
    expect(details(container).open).toBe(false)
  })

  it('stays open when clicking inside the menu', async () => {
    const user = userEvent.setup()
    const { container } = render(<UserMenu />)

    await user.click(screen.getByText('name@example.com'))
    expect(details(container).open).toBe(true)

    // 用 pointerdown 而不是 click，避免真的触发一次路由跳转。
    fireEvent.pointerDown(screen.getByRole('link', { name: /连接记录/ }))
    expect(details(container).open).toBe(true)
  })
})
