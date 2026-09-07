import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionNav } from '@/components/talent/connection-nav'

const getConnections = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => '/talents' }))
vi.mock('@/components/auth-provider', () => ({ useAuth: () => ({ user: { user_id: 1 } }) }))
vi.mock('@/lib/client-api', () => ({ getConnections: () => getConnections() }))

describe('ConnectionNav', () => {
  beforeEach(() => vi.clearAllMocks())

  it('caps the pending badge at 99+', async () => {
    getConnections.mockResolvedValue({ data: { data: [], pendingReceived: 120 } })
    render(<ConnectionNav />)
    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument())
    expect(screen.getByLabelText('120 个待处理连接')).toBeInTheDocument()
  })

  it('hides the badge when pendingReceived is 0', async () => {
    getConnections.mockResolvedValue({ data: { data: [], pendingReceived: 0 } })
    render(<ConnectionNav />)
    await waitFor(() => expect(screen.getByRole('link', { name: '连接记录' })).toBeInTheDocument())
    expect(screen.queryByLabelText(/个待处理连接/)).not.toBeInTheDocument()
    expect(getConnections).toHaveBeenCalledWith()
  })
})
