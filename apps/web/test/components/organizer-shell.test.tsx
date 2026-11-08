import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganizerShell } from '@/components/organizer/organizer-shell'

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

function renderShell(seasons = SEASONS, seasonIdFromUrl: string | null = null) {
  search = seasonIdFromUrl === null ? '' : `season=${seasonIdFromUrl}`
  return render(
    <OrganizerShell seasons={seasons} organizerOrgs={[]}>
      <p>页面内容</p>
    </OrganizerShell>,
  )
}

/**
 * 主办方后台外壳的默认赛季。
 *
 * 核心口径：**没有 `?season=` 时默认选最新赛季**（列表按 updatedAt 倒序，
 * 第一项就是最近动过的那个），而不是停在「未选中」的空态。
 */
describe('OrganizerShell · default season', () => {
  it('selects the newest season when the URL carries no season', () => {
    renderShell()
    expect(picker().value).toBe('31')
    expect(picker().selectedOptions[0]).toHaveTextContent('2027 春季赛季')
  })

  it('offers no “all seasons” option at all', () => {
    renderShell()
    expect(within(picker()).queryByRole('option', { name: '全部赛季' })).not.toBeInTheDocument()
    expect(within(picker()).getAllByRole('option')).toHaveLength(SEASONS.length)
  })

  it('keeps an explicit season from the URL', () => {
    renderShell(SEASONS, '21')
    expect(picker().value).toBe('21')
  })

  it('points the tabs at the defaulted season, so switching tabs keeps it', () => {
    renderShell()
    expect(screen.getByRole('link', { name: '报名审核' })).toHaveAttribute(
      'href',
      '/organizer/applications?season=31',
    )
  })

  it('stays disabled when there is no season to default to', () => {
    renderShell([])
    expect(picker()).toBeDisabled()
    expect(screen.getByRole('option', { name: '暂无赛季' })).toBeInTheDocument()
  })
})
