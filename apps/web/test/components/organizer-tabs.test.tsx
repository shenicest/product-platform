import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ORGANIZER_TABS, OrganizerTabs } from '@/components/organizer/organizer-tabs'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

let pathname = '/organizer/overview'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

describe('OrganizerTabs', () => {
  it('renders every tab in the agreed order', () => {
    pathname = '/organizer/overview'
    render(<OrganizerTabs seasonId={null} />)

    const links = within(screen.getByRole('navigation', { name: '主办方后台导航' })).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      '总览',
      '赛季设置',
      '规则归档',
      '报名审核',
      '项目与进度',
      '人工拉群',
      '命题与资源',
      '评委与积分池',
      '里程碑',
      '核验与异议',
      '预算与结算',
      '审计',
    ])
  })

  it('marks the current tab and carries the selected season across tabs', () => {
    pathname = '/organizer/manual-group'
    render(<OrganizerTabs seasonId={21} />)

    const active = screen.getByRole('link', { name: '人工拉群' })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active).toHaveAttribute('href', '/organizer/manual-group?season=21')
    expect(screen.getByRole('link', { name: '审计' })).toHaveAttribute('href', '/organizer/audit?season=21')
    expect(screen.queryByRole('link', { name: '总览', current: 'page' })).not.toBeInTheDocument()
  })

  it('drops the query when no season is selected', () => {
    pathname = '/organizer/applications'
    render(<OrganizerTabs seasonId={null} />)
    expect(screen.getByRole('link', { name: '报名审核' })).toHaveAttribute('href', '/organizer/applications')
  })

  it('uses the flat button variant so hover does not lift the tabs', () => {
    // tab 只切路由，不是页内动作：`.ui-btn--flat` 关掉 `.ui-btn:hover` 的
    // translateY(-2px)，视觉上不再「浮起来」。
    pathname = '/organizer/overview'
    render(<OrganizerTabs seasonId={null} />)
    for (const link of within(screen.getByRole('navigation', { name: '主办方后台导航' })).getAllByRole('link')) {
      expect(link.className).toContain('ui-btn--flat')
    }
  })

  it('exports a tab definition for every route segment', () => {
    expect(ORGANIZER_TABS.map((tab) => tab.slug)).toEqual([
      'overview',
      'season-settings',
      'rules',
      'applications',
      'projects',
      'manual-group',
      'challenges',
      'scoring',
      'milestones',
      'verification',
      'budget',
      'audit',
    ])
  })
})

/**
 * 「报名审核」的红点：数字来自 `pendingReviewCount`（外壳按当前赛季取好），
 * 这里只验证画法 —— 有数字才画、只画在报名审核上、文案和无障碍名一致。
 */
describe('OrganizerTabs · pending review badge', () => {
  it('puts the pending count on the applications tab only', () => {
    pathname = '/organizer/overview'
    render(<OrganizerTabs seasonId={21} pendingReviewCount={3} />)

    const applications = screen.getByRole('link', { name: /报名审核/ })
    const badge = within(applications).getByTestId('pending-review-badge')
    expect(badge).toHaveTextContent('3')
    // 红点在无障碍树上不是纯装饰：读屏能念出「3 条待处理报名」。
    expect(badge).toHaveAttribute('aria-label', '3 条待处理报名')

    // 其余 tab 不带红点（这个数只属于报名审核队列）。
    const others = within(screen.getByRole('navigation', { name: '主办方后台导航' }))
      .getAllByRole('link')
      .filter((link) => !link.textContent?.includes('报名审核'))
    for (const link of others) {
      expect(within(link).queryByTestId('pending-review-badge')).not.toBeInTheDocument()
    }
  })

  it('keeps the tab clean when nothing is waiting', () => {
    pathname = '/organizer/overview'
    render(<OrganizerTabs seasonId={21} pendingReviewCount={0} />)

    // 0 条不画红点：没有待办就该是一个安静的 tab，名字也还是原来的四个字。
    expect(screen.getByRole('link', { name: '报名审核' })).toBeInTheDocument()
    expect(screen.queryByTestId('pending-review-badge')).not.toBeInTheDocument()
  })

  it('caps the visible number at 99+ but keeps the real count for screen readers', () => {
    pathname = '/organizer/applications'
    render(<OrganizerTabs seasonId={21} pendingReviewCount={128} />)

    const badge = screen.getByTestId('pending-review-badge')
    expect(badge).toHaveTextContent('99+')
    expect(badge).toHaveAttribute('aria-label', '128 条待处理报名')
  })
})

describe('WorkInProgress', () => {
  it('states that the tab is under development and what it will hold', () => {
    render(<WorkInProgress tab="budget" title="预算与结算" scope="预算版本与结算法式。" />)
    expect(screen.getByRole('heading', { name: '预算与结算' })).toBeInTheDocument()
    expect(screen.getByText('开发中')).toBeInTheDocument()
    expect(screen.getByText('预算版本与结算法式。')).toBeInTheDocument()
  })})
