import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApplicationReviewView } from '@/components/organizer/applications/application-review-view'
import { updateApplicationStatus } from '@/lib/organizer-api'
import type { ApplicationListItem, ApplicationReviewStats } from '@/lib/organizer-applications'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn(), back: vi.fn(), preload: vi.fn() }),
  usePathname: () => '/organizer/applications',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/organizer-api', () => ({
  updateApplicationStatus: vi.fn(),
  getApplicationDetail: vi.fn(),
  getApplicationAuditTrail: vi.fn(),
}))

function application(overrides: Partial<ApplicationListItem> = {}): ApplicationListItem {
  return {
    id: 101,
    seasonId: 7,
    userId: 'u-101',
    skills: '小程序、前端',
    experience: '独立开发者，做过微信小程序。',
    themes: ['全球 AI 基建'],
    teamIntent: '想找设计搭档',
    acceptsSolo: true,
    availability: '周末',
    cityMode: '上海',
    visibility: 'organizer_only',
    agreementVersion: 'v1',
    status: 'submitted',
    reviewedBy: null,
    reviewReason: null,
    reviewedAt: null,
    withdrawnAt: null,
    contactMasked: '微信 ba***_1',
    applicant: { userId: 'u-101', name: '柏舟', avatarUrl: null },
    createdAt: '2026-10-26T01:40:00.000Z',
    updatedAt: '2026-10-26T01:40:00.000Z',
    ...overrides,
  }
}

const STATS: ApplicationReviewStats = {
  approved: '19 / 20',
  approvedLabel: '已通过选手 · 名额',
  waitlisted: 0,
  window: { label: '报名已截止', range: '10月12日 — 10月26日', open: false },
}

function renderView(overrides: {
  items?: ApplicationListItem[]
  actionsLocked?: boolean
  statusFilter?: string
} = {}) {
  return render(
    <ApplicationReviewView
      seasonId={7}
      items={overrides.items ?? [application()]}
      stats={STATS}
      statusFilter={overrides.statusFilter ?? 'submitted'}
      actionsLocked={overrides.actionsLocked ?? false}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(updateApplicationStatus).mockResolvedValue({ data: {} as never, error: null })
})

describe('ApplicationReviewView · queue', () => {
  it('renders the stats, the hint and one row per application', () => {
    renderView()

    expect(screen.getByLabelText('已通过选手与名额')).toHaveTextContent('19 / 20')
    expect(screen.getByLabelText('候补人数')).toHaveTextContent('0')
    expect(screen.getByLabelText('报名窗口')).toHaveTextContent('报名已截止')
    expect(screen.getByText('10月12日 — 10月26日')).toBeInTheDocument()

    const table = screen.getByRole('table', { name: '报名审核队列' })
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getByText('柏舟')).toBeInTheDocument()
    expect(within(table).getByText('小程序、前端')).toBeInTheDocument()
    expect(within(table).getByText('全球 AI 基建')).toBeInTheDocument()
    expect(within(table).getByText('可单人开始')).toBeInTheDocument()
    expect(within(table).getByText('审核中')).toBeInTheDocument()
    // 列表只有掩码，明文联系方式不出现在队列里。
    expect(within(table).getByText('微信 ba***_1')).toBeInTheDocument()
  })

  it('offers the four review actions on a submitted application', () => {
    renderView()
    for (const label of ['通过', '待定', '候补', '不通过']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label} 柏舟$`) })).toBeEnabled()
    }
  })

  it('renders the actions as icon-only buttons that keep a text label for hover and AT', () => {
    renderView()
    const accept = screen.getByRole('button', { name: '通过 柏舟' })
    // 按钮里没有可见文字，只有一枚 aria-hidden 的图标。
    expect(accept).toHaveTextContent('')
    expect(accept.querySelector('svg')).not.toBeNull()
    expect(accept.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    // 悬停提示与可访问名都在，语义不因图标化丢失。
    expect(accept).toHaveAttribute('title', '通过')
    expect(screen.getByRole('button', { name: '不通过 柏舟' })).toHaveAttribute('title', '不通过')
  })

  it('colours the actions by tone so the primary and the dangerous one stand apart', () => {
    renderView()
    expect(screen.getByRole('button', { name: '通过 柏舟' })).toHaveClass('ui-icon-btn--brand-solid')
    expect(screen.getByRole('button', { name: '待定 柏舟' })).toHaveClass('ui-icon-btn--warning')
    expect(screen.getByRole('button', { name: '候补 柏舟' })).toHaveClass('ui-icon-btn--warning')
    expect(screen.getByRole('button', { name: '不通过 柏舟' })).toHaveClass('ui-icon-btn--danger')
  })

  it('freezes the action column so it stays reachable while scrolling sideways', () => {
    renderView()
    const table = screen.getByRole('table', { name: '报名审核队列' })
    expect(table).toHaveClass('console-table', 'console-table--sticky-actions')
    expect(table.parentElement).toHaveClass('overflow-x-auto')
  })

  it('keeps the table from widening the page shell', () => {
    // 外层是 `grid`，grid item 的 `min-width` 默认 `auto` —— 会取表格的
    // min-content 宽度，于是 `overflow-x-auto` 永远轮不到自己滚动，整张表
    // 直接把 `.shell--narrow` 的 1120px 顶开。这一格必须是 `min-w-0`。
    const { container } = renderView()
    const table = screen.getByRole('table', { name: '报名审核队列' })
    const scrollBox = table.parentElement as HTMLElement
    const panel = scrollBox.parentElement as HTMLElement

    expect(scrollBox).toHaveClass('overflow-x-auto')
    // 滚动容器本身不能带任何 min-width（否则它会先被内容撑开）。
    expect(scrollBox.className).not.toMatch(/\bmin-w-(?:full|max|screen)\b/)
    // 面板与它的外层 section 都归零最小宽度，滚动才发生在 scrollBox 里。
    expect(panel).toHaveClass('min-w-0')
    expect(panel.parentElement).toHaveClass('min-w-0')
    // 视图根节点同样要 min-w-0，避免它把 grid 的 auto 最小宽度传下去。
    expect(container.firstElementChild).toHaveClass('min-w-0')
  })

  it('shows a terminal row without actions', () => {
    renderView({ items: [application({ status: 'accepted' })] })
    expect(screen.getByText('已是终态')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /通过 柏舟/ })).not.toBeInTheDocument()
  })

  it('disables every action when the season is cancelled', () => {
    renderView({ actionsLocked: true })
    expect(screen.getByText(/赛季已取消，报名不可再审核/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '通过 柏舟' })).toBeDisabled()
  })
})

describe('ApplicationReviewView · review actions', () => {
  it('accepts directly and refreshes the queue', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: '通过 柏舟' }))

    expect(updateApplicationStatus).toHaveBeenCalledWith(101, { status: 'accepted' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent('已标记为「已通过」')
  })

  it('explains the capacity downgrade when the accept lands in the waitlist', async () => {
    vi.mocked(updateApplicationStatus).mockResolvedValue({
      data: { status: 'waitlisted' } as never,
      error: null,
    })

    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: '通过 柏舟' }))

    expect(await screen.findByRole('status')).toHaveTextContent('名额已满，该报名已进入候补队列。')
  })

  it('requires a reason before rejecting and sends it', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: '不通过 柏舟' }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: '确认不通过' }))
    expect(updateApplicationStatus).not.toHaveBeenCalled()
    expect(within(dialog).getByText('请填写至少 2 个字符的原因')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/原因/), '方向不匹配')
    await user.click(within(dialog).getByRole('button', { name: '确认不通过' }))

    expect(updateApplicationStatus).toHaveBeenCalledWith(101, {
      status: 'rejected',
      reason: '方向不匹配',
    })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('reports the backend message when an action fails and does not refresh', async () => {
    vi.mocked(updateApplicationStatus).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        body: { error: { code: 'CAPACITY_FULL', message: '赛季选手名额已满' } },
      },
    } as never)

    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: '通过 柏舟' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('赛季选手名额已满')
    expect(refresh).not.toHaveBeenCalled()
  })
})
