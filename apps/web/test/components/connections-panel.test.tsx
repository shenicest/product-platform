import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionsPanel } from '@/components/talent/talent-ui'
import type { TalentConnection } from '@/lib/talent'

vi.mock('@/lib/client-api', () => ({
  acceptTalentConnection: vi.fn(), getConnections: vi.fn(), ignoreTalentConnection: vi.fn(),
  pauseTalent: vi.fn(), saveTalent: vi.fn(), sendTalentConnection: vi.fn(), suspendTalent: vi.fn(),
}))
vi.mock('@/components/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const party = { userId: '2', identity: { nickname: '对方' }, hasPublishedTalentProfile: false, talentProfile: null }
function connection(status: number, contacts?: TalentConnection['contacts']): TalentConnection {
  return { id: status + 1, senderUserId: '2', receiverUserId: '1', projectId: null, purpose: '一起做产品', message: '希望聊聊合作', status, sender: party, receiver: { ...party, userId: '1' }, project: null, contacts, createdAt: '', acceptedAt: null, handledAt: null }
}

describe('ConnectionsPanel', () => {
  it('shows contacts only for accepted requests and validates accept contacts', async () => {
    render(<ConnectionsPanel userId="1" initial={{ pendingReceived: 1, data: [connection(0), connection(1, { mine: { email: 'mine@example.com', wechat: null }, other: { email: 'other@example.com', wechat: null } })] }} />)
    expect(screen.getAllByText('该用户暂未公开介绍')).toHaveLength(2)
    expect(screen.getByText(/other@example.com/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '接受' }))
    await userEvent.click(screen.getByRole('button', { name: '接受连接' }))
    expect(screen.getByText('至少提供微信或邮箱')).toBeInTheDocument()
  })
})
