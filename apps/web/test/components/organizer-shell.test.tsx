import { act, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizerShell } from '@/components/organizer/organizer-shell'
import { getPendingApplicationCount } from '@/lib/organizer-api'
import { ORGANIZER_APPLICATIONS_REFRESH_EVENT } from '@/lib/organizer-applications'

// 外壳挂载后会为「报名审核」红点取一次待处理条数：这里把它挡在门外，
// 组件测试不该真的发请求（MSW 对未打桩请求是直接失败的）。
vi.mock('@/lib/organizer-api', () => ({
  getPendingApplicationCount: vi.fn(),
  createSeasonDraft: vi.fn(),
  getSeasonManageDetail: vi.fn(),
}))

// 路由是 mock 出来的常量：这个文件只验证「默认赛季」的口径，不需要切路径。
const pathname = '/organizer/applications'
let search = ''

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

const SEASONS = [
  { id: 31, name: '2027 春季赛季', code: 'BL2027A', status: 'draft', approvedAt: null },
  { id: 21, name: '2026 春季赛季', code: 'BL2026A', status: 'active', approvedAt: '2026-01-01T00:00:00.000Z' },
]

const picker = () => screen.getByLabelText('赛季') as HTMLSelectElement

beforeEach(() => {
  vi.mocked(getPendingApplicationCount).mockResolvedValue(0)
})

async function renderShell(seasons = SEASONS, seasonIdFromUrl: string | null = null) {
  search = seasonIdFromUrl === null ? '' : `season=${seasonIdFromUrl}`
  const view = render(
    <OrganizerShell seasons={seasons} organizerOrgs={[]}>
      <p>页面内容</p>
    </OrganizerShell>,
  )
  // 等红点的取数落定：不 await 的话，它会在测试结束后再触发一次 setState
  // （React 会报 act 警告，而且断言可能跑在旧数字上）。
  await act(async () => {})
  return view
}

/**
 * 主办方后台外壳的默认赛季。
 *
 * 核心口径：**没有 `?season=` 时默认选最新赛季**（列表按 updatedAt 倒序，
 * 第一项就是最近动过的那个），而不是停在「未选中」的空态。
 */
describe('OrganizerShell · default season', () => {
  it('selects the newest season when the URL carries no season', async () => {
    await renderShell()
    expect(picker().value).toBe('31')
    expect(picker().selectedOptions[0]).toHaveTextContent('2027 春季赛季')
  })

  it('offers no “all seasons” option at all', async () => {
    await renderShell()
    expect(within(picker()).queryByRole('option', { name: '全部赛季' })).not.toBeInTheDocument()
    expect(within(picker()).getAllByRole('option')).toHaveLength(SEASONS.length)
  })

  it('keeps an explicit season from the URL', async () => {
    await renderShell(SEASONS, '21')
    expect(picker().value).toBe('21')
  })

  it('points the tabs at the defaulted season, so switching tabs keeps it', async () => {
    await renderShell()
    expect(screen.getByRole('link', { name: '报名审核' })).toHaveAttribute(
      'href',
      '/organizer/applications?season=31',
    )
  })

  it('stays disabled when there is no season to default to', async () => {
    await renderShell([])
    expect(picker()).toBeDisabled()
    expect(screen.getByRole('option', { name: '暂无赛季' })).toBeInTheDocument()
  })
})

/**
 * 「报名审核」的红点。
 *
 * 数字跟着**当前选中的赛季**走（默认赛季 / URL 里的赛季各验一次），
 * 审核成功后靠 `ORGANIZER_APPLICATIONS_REFRESH_EVENT` 重拉 —— 这条事件是
 * `router.refresh()` 之外唯一的更新路径，断了红点就会停在旧数字上。
 */
describe('OrganizerShell · pending review badge', () => {
  it('reads the pending count of the season the tabs point at', async () => {
    vi.mocked(getPendingApplicationCount).mockResolvedValue(4)
    await renderShell()

    expect(getPendingApplicationCount).toHaveBeenCalledWith(31)
    expect(screen.getByTestId('pending-review-badge')).toHaveTextContent('4')
  })

  it('follows an explicit season from the URL', async () => {
    vi.mocked(getPendingApplicationCount).mockResolvedValue(2)
    await renderShell(SEASONS, '21')

    expect(getPendingApplicationCount).toHaveBeenCalledWith(21)
    expect(screen.getByTestId('pending-review-badge')).toHaveTextContent('2')
  })

  it('re-reads the count after an application is reviewed', async () => {
    vi.mocked(getPendingApplicationCount).mockResolvedValue(4)
    await renderShell()
    expect(screen.getByTestId('pending-review-badge')).toHaveTextContent('4')

    // `router.refresh()` 只重渲染服务端组件，不会重跑外壳的 effect；
    // 审核视图发的那条事件才是让红点跟着减一的原因。
    vi.mocked(getPendingApplicationCount).mockResolvedValue(3)
    await act(async () => {
      window.dispatchEvent(new Event(ORGANIZER_APPLICATIONS_REFRESH_EVENT))
    })

    expect(screen.getByTestId('pending-review-badge')).toHaveTextContent('3')
  })

  it('shows no red dot when the queue has nothing waiting', async () => {
    await renderShell()
    expect(screen.queryByTestId('pending-review-badge')).not.toBeInTheDocument()
  })
})
