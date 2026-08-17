import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionNav } from '@/components/talent/connection-nav'

vi.mock('next/navigation', () => ({ usePathname: () => '/talents' }))
vi.mock('@/components/auth-provider', () => ({ useAuth: () => ({ user: { user_id: 1 } }) }))
vi.mock('@/lib/client-api', () => ({ getConnections: vi.fn(async () => ({ data: { pendingReceived: 120 } })) }))

describe('ConnectionNav', () => {
  beforeEach(() => vi.clearAllMocks())
  it('caps the pending badge at 99+', async () => {
    render(<ConnectionNav />)
    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument())
    expect(screen.getByLabelText('120 个待处理连接')).toBeInTheDocument()
  })
})
