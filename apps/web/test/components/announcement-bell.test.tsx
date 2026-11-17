import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnouncementBell } from '@/components/announcement-bell'

const getAnnouncementSummary = vi.fn()
const getAnnouncements = vi.fn()
const markAllAnnouncementsRead = vi.fn()

type TestAuth = {
  user: { user_id: number; email: string | null } | null
  loading: boolean
}

let auth: TestAuth = { user: { user_id: 7, email: 'name@example.com' }, loading: false }

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => auth,
}))
vi.mock('@/lib/client-api', () => ({
  getAnnouncementSummary: () => getAnnouncementSummary(),
  getAnnouncements: (query: unknown) => getAnnouncements(query),
  markAllAnnouncementsRead: () => markAllAnnouncementsRead(),
}))

function summaryResponse(unreadCount: number) {
  return { data: { unreadCount, lastReadAt: null }, error: null }
}

const ITEMS = [
  {
    id: 2,
    type: 'application',
    level: 'success',
    title: '报名已通过审核',
    content: '请尽快完成组队',
    linkPath: '/me/applications',
    seasonId: 1,
    publishedAt: '2026-11-15T11:59:00+08:00',
    isRead: false,
  },
  {
    id: 1,
    type: 'season',
    level: 'info',
    title: '赛程调整通知',
    content: '原定 11/20 的评审延后到 11/22',
    linkPath: null,
    seasonId: 1,
    publishedAt: '2026-11-15T09:00:00+08:00',
    isRead: true,
  },
]

function listResponse(items = ITEMS, unreadCount = 1) {
  return { data: { items, nextCursor: null, unreadCount }, error: null }
}

describe('AnnouncementBell', () => {
  beforeEach(() => {
    auth = { user: { user_id: 7, email: 'name@example.com' }, loading: false }
    getAnnouncementSummary.mockReset().mockResolvedValue(summaryResponse(0))
    getAnnouncements.mockReset().mockResolvedValue(listResponse())
    markAllAnnouncementsRead
      .mockReset()
      .mockResolvedValue({ data: { lastReadAt: '2026-11-15T12:00:00+08:00', unreadCount: 0 }, error: null })
  })

  it('renders nothing for a signed-out visitor and skips the request', () => {
    auth = { user: null, loading: false }
    render(<AnnouncementBell />)
    expect(screen.queryByRole('button', { name: /公告/ })).not.toBeInTheDocument()
    expect(getAnnouncementSummary).not.toHaveBeenCalled()
  })

  it('shows the unread count and caps it at 99+', async () => {
    getAnnouncementSummary.mockResolvedValue(summaryResponse(120))
    render(<AnnouncementBell />)

    const button = await screen.findByRole('button', { name: '公告，120 条未读' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.getByTestId('announcement-badge')).toHaveTextContent('99+'))
  })

  it('hides the badge when nothing is unread', async () => {
    render(<AnnouncementBell />)
    await waitFor(() => expect(getAnnouncementSummary).toHaveBeenCalled())
    expect(screen.queryByTestId('announcement-badge')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '公告' })).toBeInTheDocument()
  })

  it('loads the inbox when opened and does not mark anything read by opening', async () => {
    const user = userEvent.setup()
    getAnnouncementSummary.mockResolvedValue(summaryResponse(1))
    render(<AnnouncementBell />)

    await user.click(await screen.findByRole('button', { name: '公告，1 条未读' }))

    await waitFor(() => expect(getAnnouncements).toHaveBeenCalledWith({ limit: 20 }))
    expect(await screen.findByText('报名已通过审核')).toBeInTheDocument()
    expect(screen.getByText('报名')).toBeInTheDocument()
    expect(screen.getByText('赛程调整通知')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /报名已通过审核/ })).toHaveAttribute(
      'href',
      '/me/applications',
    )
    expect(screen.getByRole('link', { name: '查看全部 →' })).toHaveAttribute(
      'href',
      '/me/announcements',
    )
    expect(markAllAnnouncementsRead).not.toHaveBeenCalled()
  })

  it('marks everything read and clears the badge', async () => {
    const user = userEvent.setup()
    getAnnouncementSummary.mockResolvedValue(summaryResponse(1))
    render(<AnnouncementBell />)

    await user.click(await screen.findByRole('button', { name: '公告，1 条未读' }))
    // 服务端在一键已读之后就不再返回未读数；用 mock 模拟这个翻转，
    // 组件内部刷新角标时读到的才是真实状态。
    getAnnouncementSummary.mockResolvedValue(summaryResponse(0))
    await user.click(await screen.findByRole('button', { name: '全部已读' }))

    expect(markAllAnnouncementsRead).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByTestId('announcement-badge')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '公告' })).toBeInTheDocument()
  })

  it('rolls the badge back when marking read fails', async () => {
    const user = userEvent.setup()
    getAnnouncementSummary.mockResolvedValue(summaryResponse(1))
    markAllAnnouncementsRead.mockResolvedValue({
      data: null,
      error: { status: 500, body: { error: { code: 'UNKNOWN', message: 'boom' } } },
    })
    render(<AnnouncementBell />)

    await user.click(await screen.findByRole('button', { name: '公告，1 条未读' }))
    await user.click(await screen.findByRole('button', { name: '全部已读' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '公告，1 条未读' })).toBeInTheDocument(),
    )
  })

  it('closes on outside pointerdown and on Escape', async () => {
    const user = userEvent.setup()
    render(<AnnouncementBell />)

    const trigger = screen.getByRole('button', { name: '公告' })
    await user.click(trigger)
    expect(screen.getByRole('region', { name: '公告' })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(screen.queryByRole('region', { name: '公告' })).not.toBeInTheDocument())

    await user.click(trigger)
    expect(screen.getByRole('region', { name: '公告' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('region', { name: '公告' })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('resets the badge and closes the panel when the account changes', async () => {
    const user = userEvent.setup()
    getAnnouncementSummary.mockResolvedValue(summaryResponse(2))
    const { rerender } = render(<AnnouncementBell />)

    await user.click(await screen.findByRole('button', { name: '公告，2 条未读' }))
    expect(screen.getByRole('region', { name: '公告' })).toBeInTheDocument()

    // 模拟右下角切换到另一个 mock 用户：AuthProvider 重渲染，userId 变化。
    auth = { user: { user_id: 8, email: 'other@example.com' }, loading: false }
    getAnnouncementSummary.mockResolvedValue(summaryResponse(0))
    rerender(<AnnouncementBell />)

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: '公告' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByRole('button', { name: '公告' })).toBeInTheDocument()
    expect(screen.queryByTestId('announcement-badge')).not.toBeInTheDocument()
  })

  it('shows an empty state when there is no announcement', async () => {
    const user = userEvent.setup()
    getAnnouncements.mockResolvedValue(listResponse([], 0))
    render(<AnnouncementBell />)

    await user.click(screen.getByRole('button', { name: '公告' }))
    expect(await screen.findByText('暂时没有公告')).toBeInTheDocument()
  })
})
