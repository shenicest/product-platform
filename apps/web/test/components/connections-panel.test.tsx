import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionsPanel } from '@/components/connections/connections-panel'
import { acceptHackathonConnection, ignoreHackathonConnection } from '@/lib/client-api'
import type { ConnectionItem, ConnectionsResult } from '@/lib/connections'
import { ConnectionRequestStatus } from '@shenicest/shared'

const searchParamValue = vi.hoisted(() => ({ value: null as string | null }))
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
const authState = vi.hoisted(() => ({ user: null as { user_id: string } | null }))

vi.mock('@/lib/client-api', () => ({
  getConnections: vi.fn(),
  acceptHackathonConnection: vi.fn(),
  ignoreHackathonConnection: vi.fn(),
  acceptTalentConnection: vi.fn(),
  ignoreTalentConnection: vi.fn(),
}))
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ user: authState.user, loading: false, isAuthenticated: !!authState.user, refresh: vi.fn(), logout: vi.fn() }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => (key === 'request' ? searchParamValue.value : null) }),
}))

let requestCount = 0
function item(overrides: Partial<ConnectionItem> = {}): ConnectionItem {
  requestCount += 1
  const party = { userId: '9001', nickname: '平台用户', avatarUrl: null, hasPublishedTalentProfile: false }
  return {
    id: requestCount,
    source: 'hackathon',
    status: ConnectionRequestStatus.Pending,
    senderUserId: '9001',
    receiverUserId: 'viewer',
    sender: party,
    receiver: { ...party, userId: 'viewer' },
    target: { type: 'hackathon_project', projectId: 71, eventId: 4, name: '月事轻记', url: 'https://shenicest.test/hackathon/projects/71' },
    purpose: '试用产品与交流设计',
    message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待合作。',
    createdAt: `2026-09-07T0${(requestCount % 9) + 1}:00:00.000Z`,
    acceptedAt: null,
    handledAt: null,
    ...overrides,
  }
}

function result(items: ConnectionItem[], pendingReceived = 1): ConnectionsResult {
  return { data: items, pendingReceived }
}

const contacts = { mine: { wechat: 'mine-wx', email: null }, other: { wechat: null, email: 'other@example.com' } }

beforeAll(() => {
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  searchParamValue.value = null
  authState.user = { user_id: 'viewer' }
  vi.mocked(acceptHackathonConnection).mockResolvedValue({ data: item({ status: ConnectionRequestStatus.Accepted }), error: null })
  vi.mocked(ignoreHackathonConnection).mockResolvedValue({ data: item({ status: ConnectionRequestStatus.Ignored }), error: null })
})

describe('ConnectionsPanel (unified)', () => {
  it('renders source labels, project links, and pending-received ordering', () => {
    const pendinghackathon = item({ status: ConnectionRequestStatus.Pending, createdAt: '2026-09-07T01:00:00.000Z' })
    const acceptedTalent = item({
      id: 500,
      source: 'talent',
      status: ConnectionRequestStatus.Accepted,
      contacts: { mine: contacts.mine, other: { wechat: 'other-wx', email: null } },
      sender: { userId: '9002', nickname: '人才方', avatarUrl: null, hasPublishedTalentProfile: true },
      createdAt: '2026-09-07T10:00:00.000Z',
    })
    render(<ConnectionsPanel initial={{ data: [acceptedTalent, pendinghackathon], pendingReceived: 1 }} userId="viewer" />)

    const sourceChips = screen.getAllByText('黑客松项目')
    expect(sourceChips.length).toBeGreaterThan(0)
    expect(screen.getAllByText('人才').length).toBeGreaterThan(0)

    const cards = screen.getAllByRole('article')

    // Pending-received hackathon card comes first despite being older.
    expect(cards[0]).toHaveTextContent('等待对方回应')
    expect(cards[0].textContent).toContain('试用产品与交流')
    expect(cards.length).toBe(2)

    expect(screen.getByRole('link', { name: '月事轻记' })).toHaveAttribute('href', 'https://shenicest.test/hackathon/projects/71')
  })

  it('filters by source and direction views', async () => {
    const user = userEvent.setup()
    const hackathonItems = [
      item({ id: 501, status: ConnectionRequestStatus.Accepted, receiverUserId: 'other', senderUserId: 'viewer' }), // sent
      item({ id: 502, status: ConnectionRequestStatus.Pending }), // received
    ]
    render(<ConnectionsPanel initial={result(hackathonItems, 1)} userId="viewer" />)
    expect(screen.getAllByRole('article')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '我发起的' }))
    expect(await screen.findAllByRole('article')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '人才' }))
    expect(screen.getByText('这里还没有连接记录')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '全部' }))
    await user.click(screen.getByRole('button', { name: '收到的申请' }))
    expect((await screen.findAllByRole('article'))[0]).toBeInTheDocument()
  })

  it('accepts a hackathon request after contact authorization and shows both contacts', async () => {
    vi.mocked(acceptHackathonConnection).mockResolvedValue({ data: item({ status: ConnectionRequestStatus.Accepted }), error: null })
    // Refetch after accept returns the accepted pair with contacts.
    const connectionsResult: ConnectionsResult = {
      data: [item({ status: ConnectionRequestStatus.Accepted, contacts })],
      pendingReceived: 0,
    }
    const { getConnections } = await import('@/lib/client-api')
    vi.mocked(getConnections).mockResolvedValue({ data: connectionsResult, error: null })

    const user = userEvent.setup()
    render(<ConnectionsPanel initial={result([item({ status: ConnectionRequestStatus.Pending })])} userId="viewer" />)

    await user.click(screen.getByRole('button', { name: '接受' }))
    await user.type(screen.getByLabelText('微信'), 'receiver-wx')
    await user.click(screen.getByRole('button', { name: '接受连接' }))

    expect(acceptHackathonConnection).toHaveBeenCalledWith(expect.any(Number), { wechat: 'receiver-wx', email: undefined })
    await waitFor(() => {
      expect(screen.getAllByText('微信：mine-wx · 复制').length).toBeGreaterThan(0)
      expect(screen.getByText('邮箱：other@example.com · 复制')).toBeInTheDocument()
      expect(screen.getByText('已建立连接')).toBeInTheDocument()
    })
  })

  it('keeps pane navigation cheap when the authorize form is cancelled', async () => {
    const user = userEvent.setup()
    render(<ConnectionsPanel initial={result([item({ status: ConnectionRequestStatus.Pending })])} userId="viewer" />)
    await user.click(screen.getByRole('button', { name: '接受' }))
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByText('接受后双方才能查看授权联系方式。')).not.toBeInTheDocument()
  })

  it('ignores hackathon requests and surfaces backend errors, no contacts anywhere', async () => {
    vi.mocked(ignoreHackathonConnection).mockResolvedValue({ data: item({ status: ConnectionRequestStatus.Ignored }), error: null })
    const connectionsResult: ConnectionsResult = {
      data: [item({ status: ConnectionRequestStatus.Ignored })],
      pendingReceived: 0,
    }
    const { getConnections } = await import('@/lib/client-api')
    vi.mocked(getConnections).mockResolvedValue({ data: connectionsResult, error: null })

    const user = userEvent.setup()
    render(<ConnectionsPanel initial={result([{ ...item(), status: ConnectionRequestStatus.Pending }])} userId="viewer" />)
    await user.click(screen.getByRole('button', { name: '忽略' }))

    expect(ignoreHackathonConnection).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('已被忽略')).toBeInTheDocument())
    expect(screen.queryByText(/微信号|邮箱/)).not.toBeInTheDocument()
  })

  it('labels ignored sent requests from the sender perspective as 暂未建立连接', async () => {
    const user = userEvent.setup()
    render(
      <ConnectionsPanel
        initial={result([item({ id: 900, status: ConnectionRequestStatus.Ignored, senderUserId: 'viewer', receiverUserId: '9001' })])}
        userId="viewer"
      />,
    )
    await user.click(screen.getByRole('button', { name: '我发起的' }))
    expect(screen.getByText('暂未建立连接')).toBeInTheDocument()
  })

  it('shows error messages from ignored-rejected actions without discarding the list', async () => {
    vi.mocked(ignoreHackathonConnection).mockResolvedValue({
      data: null,
      error: { status: 409, body: { error: { code: 'REQUEST_NOT_PENDING', message: '申请状态已变化' } } },
    })
    const user = userEvent.setup()
    render(<ConnectionsPanel initial={result([item({ status: ConnectionRequestStatus.Pending })])} userId="viewer" />)
    await user.click(screen.getByRole('button', { name: '忽略' }))
    expect(await screen.findByText('申请状态已变化')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('requires a contact method in the authorize form', async () => {
    vi.mocked(acceptHackathonConnection).mockResolvedValue({ data: item({ status: ConnectionRequestStatus.Accepted }), error: null })
    const user = userEvent.setup()
    render(<ConnectionsPanel initial={result([item()])} userId="viewer" />)
    await user.click(screen.getByRole('button', { name: '接受' }))
    await user.click(screen.getByRole('button', { name: '接受连接' }))
    expect(screen.getByText('至少提供微信或邮箱')).toBeInTheDocument()
    expect(acceptHackathonConnection).not.toHaveBeenCalled()
  })

  it('renders talent rows with the talent status chip and no contact leaks for pending rows', () => {
    render(<ConnectionsPanel initial={result([item({ id: 778, source: 'talent', status: ConnectionRequestStatus.Pending, target: { type: 'talent_user' }, sender: { userId: '9002', nickname: '人才方', avatarUrl: null, hasPublishedTalentProfile: true } })])} userId="viewer" />)
    const card = screen.getByRole('article')
    expect(card.textContent).toContain('公开人才档案')
    expect(screen.queryByText(/微信：/)).not.toBeInTheDocument()
    expect(screen.queryByText(/邮箱：/)).not.toBeInTheDocument()
    expect(card).not.toHaveAttribute('data-hackathon-request')
  })

  it('highlights the matching hackathon card from the ?request= mail return link', () => {
    const target = item({ status: ConnectionRequestStatus.Pending })
    searchParamValue.value = String(target.id)
    render(<ConnectionsPanel initial={result([target], 1)} userId="viewer" />)
    const card = screen.getByRole('article')
    expect(card).toHaveAttribute('data-hackathon-request', searchParamValue.value!)
    expect(card.className).toContain('border-primary')
    // The param id is only a locator — no changed data or credentials.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
