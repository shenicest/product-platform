import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SeasonApplicationStatus, SeasonStatus, SeasonType, WechatStatus } from '@shenicest/shared'
import { ApplicationsTable } from '@/components/me/applications-table'
import { PublicSeasonGrid } from '@/components/me/public-season-grid'
import { withdrawSeasonApplication } from '@/lib/boomland-api'
import type { MySeasonApplication, SeasonSummary } from '@/lib/boomland'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn(), back: vi.fn(), preload: vi.fn() }),
  usePathname: () => '/me/applications',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/boomland-api', () => ({
  withdrawSeasonApplication: vi.fn(),
}))

// 组件里没有 await `cookies()` 这类运行时依赖，可以直接渲染；
// 只有「撤回」那颗按钮是 Client Component，`next/navigation` 已经桩掉。
function season(overrides: Partial<SeasonSummary> = {}): SeasonSummary {
  return {
    id: 502,
    code: '502',
    name: 'A4BBS 产业商业赛季',
    type: SeasonType.Season,
    city: '上海',
    status: SeasonStatus.Active,
    themes: ['AI 应用'],
    schedule: {
      applyOpen: '2026-10-12T02:00:00.000Z',
      applyClose: '2026-10-26T15:59:00.000Z',
      startAt: '2026-11-01T01:00:00.000Z',
      teamDeadline: '2026-11-10T15:59:00.000Z',
      challengeFreezeAt: '2026-11-15T15:59:00.000Z',
      workDeadline: '2026-12-01T15:59:00.000Z',
      scoreDeadline: '2026-12-10T15:59:00.000Z',
      settleDate: '2026-12-20T15:59:00.000Z',
    },
    organizerOrgs: [{ id: 1, name: 'A4BBS' }],
    pinned: false,
    approvedAt: '2026-09-01T00:00:00.000Z',
    participantCapacity: 20,
    participantCount: 19,
    publishedChallengeCount: 3,
    ...overrides,
  }
}

function application(overrides: Partial<MySeasonApplication['application']> = {}) {
  return {
    id: 11,
    seasonId: 502,
    userId: 'u-1',
    skills: '前端',
    experience: '做过小程序',
    themes: ['AI 应用'],
    teamIntent: '找设计',
    acceptsSolo: true,
    availability: '周末',
    cityMode: '上海',
    visibility: 'organizer_only',
    agreementVersion: 'v3',
    status: SeasonApplicationStatus.Submitted,
    reviewedBy: null,
    reviewReason: null,
    reviewedAt: null,
    withdrawnAt: null,
    contact: null,
    createdAt: '2026-10-26T01:40:00.000Z',
    updatedAt: '2026-10-26T01:40:00.000Z',
    ...overrides,
  }
}

function item(overrides: Partial<MySeasonApplication> = {}): MySeasonApplication {
  return { application: application(), season: season(), wechatStatus: null, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(withdrawSeasonApplication).mockResolvedValue({ data: {} as never, error: null })
})

describe('ApplicationsTable', () => {
  it('renders the seven design columns in order', () => {
    render(<ApplicationsTable items={[item()]} />)
    const table = screen.getByRole('table', { name: '我提交过的赛季报名' })
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent)
    expect(headers).toEqual([
      '赛季',
      '提交时间',
      '审核状态',
      '审核说明',
      '微信群',
      '赛季标识',
      '条款版本',
    ])
  })

  it('fills every cell of a row', () => {
    render(
      <ApplicationsTable
        items={[
          item({
            application: application({ reviewReason: '方向不匹配' }),
            wechatStatus: WechatStatus.Joined,
          }),
        ]}
      />,
    )
    const table = screen.getByRole('table', { name: '我提交过的赛季报名' })
    const row = within(table).getAllByRole('row')[1]
    const cells = within(row).getAllByRole('cell')

    expect(cells).toHaveLength(7)
    expect(cells[0]).toHaveTextContent('A4BBS 产业商业赛季')
    expect(within(cells[0]).getByRole('link')).toHaveAttribute('href', '/seasons?season=502')
    expect(cells[1]).toHaveTextContent('2026.10.26 09:40')
    expect(cells[2]).toHaveTextContent('已提交')
    expect(cells[3]).toHaveTextContent('方向不匹配')
    expect(cells[4]).toHaveTextContent('已加入')
    expect(cells[5]).toHaveTextContent('502')
    expect(cells[6]).toHaveTextContent('v3')
  })

  it('shows an em dash for an empty review note and a non-participant', () => {
    render(<ApplicationsTable items={[item()]} />)
    const table = screen.getByRole('table', { name: '我提交过的赛季报名' })
    const cells = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')
    expect(cells[3]).toHaveTextContent('—')
    expect(cells[4]).toHaveTextContent('—')
  })

  it('renders the rule footnote under the table', () => {
    render(<ApplicationsTable items={[item()]} />)
    expect(screen.getByText(/审核前可以撤回/)).toBeInTheDocument()
    expect(screen.getByText(/Track Record（待定 15）/)).toBeInTheDocument()
    expect(screen.getByText(/只有主办方和平台管理员可见/)).toBeInTheDocument()
  })

  it('shows the empty state when there is no application', () => {
    render(<ApplicationsTable items={[]} />)
    expect(screen.getByText('NO APPLICATION')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /去看看火热赛季/ })).toHaveAttribute('href', '/seasons')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('offers withdraw only while the application is still under review', () => {
    render(
      <ApplicationsTable
        items={[
          item({ application: application({ id: 1, status: SeasonApplicationStatus.Submitted }) }),
          item({ application: application({ id: 2, status: SeasonApplicationStatus.Accepted }) }),
        ]}
      />,
    )
    expect(
      screen.getByRole('button', { name: '撤回 A4BBS 产业商业赛季 的报名' }),
    ).toBeInTheDocument()
    // 已通过的报名不能撤回 —— 只有一行出现撤回按钮。
    expect(screen.getAllByRole('button', { name: /撤回 .* 的报名$/ })).toHaveLength(1)
  })
})

describe('ApplicationsTable · withdraw', () => {
  it('asks for confirmation before withdrawing', async () => {
    const user = userEvent.setup()
    render(<ApplicationsTable items={[item()]} />)

    await user.click(screen.getByRole('button', { name: '撤回 A4BBS 产业商业赛季 的报名' }))
    expect(withdrawSeasonApplication).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '确认撤回 A4BBS 产业商业赛季 的报名' }))

    expect(withdrawSeasonApplication).toHaveBeenCalledWith(11)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('can be cancelled without touching the backend', async () => {
    const user = userEvent.setup()
    render(<ApplicationsTable items={[item()]} />)

    await user.click(screen.getByRole('button', { name: '撤回 A4BBS 产业商业赛季 的报名' }))
    await user.click(screen.getByRole('button', { name: '取消撤回 A4BBS 产业商业赛季 的报名' }))

    expect(withdrawSeasonApplication).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: '撤回 A4BBS 产业商业赛季 的报名' }),
    ).toBeInTheDocument()
  })

  it('reports the backend message and does not refresh on failure', async () => {
    vi.mocked(withdrawSeasonApplication).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        body: { error: { code: 'NOT_WITHDRAWABLE', message: '该报名已通过审核，无法撤回' } },
      },
    } as never)

    const user = userEvent.setup()
    render(<ApplicationsTable items={[item()]} />)
    await user.click(screen.getByRole('button', { name: '撤回 A4BBS 产业商业赛季 的报名' }))
    await user.click(screen.getByRole('button', { name: '确认撤回 A4BBS 产业商业赛季 的报名' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('该报名已通过审核，无法撤回')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('PublicSeasonGrid', () => {
  it('renders the badge, type, name, window, capacity and deadline hint', () => {
    render(<PublicSeasonGrid seasons={[season()]} />)

    const card = screen.getByRole('article')
    expect(within(card).getByText('502')).toBeInTheDocument()
    expect(within(card).getByText('赛季')).toBeInTheDocument()
    expect(within(card).getByText('进行中')).toBeInTheDocument()
    expect(within(card).getByText('报名已截止')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'A4BBS 产业商业赛季' }))
      .toHaveAttribute('href', '/seasons?season=502')
    expect(within(card).getByText('报名 10月12日 10:00 — 10月26日 23:59（北京时间）'))
      .toBeInTheDocument()
    expect(within(card).getByText('已通过 19 / 名额 20')).toBeInTheDocument()
    expect(within(card).getByText(/报名已于 10月26日 23:59 截止/)).toBeInTheDocument()
  })

  it('marks a pinned season', () => {
    render(<PublicSeasonGrid seasons={[season({ pinned: true })]} />)
    expect(screen.getByText('置顶')).toBeInTheDocument()
  })

  it('renders one article per season, pinned first', () => {
    render(
      <PublicSeasonGrid
        seasons={[
          season({ id: 1, code: '501', name: '普通赛季', pinned: false }),
          season({ id: 2, code: '502', name: '置顶赛季', pinned: true }),
        ]}
      />,
    )
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('置顶赛季')).toBeInTheDocument()
    expect(within(cards[1]).getByText('普通赛季')).toBeInTheDocument()
  })

  it('says 名额不限 when the season has no capacity', () => {
    render(<PublicSeasonGrid seasons={[season({ participantCapacity: null, participantCount: 7 })]} />)
    expect(screen.getByText('已通过 7 人 · 名额不限')).toBeInTheDocument()
  })

  it('shows the open state with its deadline while applications are still possible', () => {
    // applyClose 在 2026-10-26，用一个更早的 now 渲染不了 —— 组件内部用当前时间。
    // 这里改用「未截止」的赛程，断言卡片不会误挂 🔒。
    render(
      <PublicSeasonGrid
        seasons={[
          season({
            schedule: {
              applyOpen: '2020-01-01T00:00:00.000Z',
              applyClose: '2099-01-01T00:00:00.000Z',
              startAt: '2099-02-01T00:00:00.000Z',
              teamDeadline: '2099-02-10T00:00:00.000Z',
              challengeFreezeAt: '2099-02-15T00:00:00.000Z',
              workDeadline: '2099-03-01T00:00:00.000Z',
              scoreDeadline: '2099-03-10T00:00:00.000Z',
              settleDate: '2099-03-20T00:00:00.000Z',
            },
          }),
        ]}
      />,
    )
    expect(screen.getByText('报名中')).toBeInTheDocument()
    expect(screen.getByText(/报名截止 1月1日/)).toBeInTheDocument()
    expect(screen.queryByText(/报名已于/)).not.toBeInTheDocument()
  })

  it('shows the empty state when no season is open', () => {
    render(<PublicSeasonGrid seasons={[]} />)
    expect(screen.getByText('NO OPEN SEASON')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
