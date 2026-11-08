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
      '报名审核',
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
      'applications',
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

describe('WorkInProgress', () => {
  it('states that the tab is under development and what it will hold', () => {
    render(<WorkInProgress tab="budget" title="预算与结算" scope="预算版本与结算法式。" />)
    expect(screen.getByRole('heading', { name: '预算与结算' })).toBeInTheDocument()
    expect(screen.getByText('开发中')).toBeInTheDocument()
    expect(screen.getByText('预算版本与结算法式。')).toBeInTheDocument()
  })})
