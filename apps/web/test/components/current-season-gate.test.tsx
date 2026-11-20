import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonStatus } from '@shenicest/shared'
import { CurrentSeasonGate } from '@/components/current-season-gate'
import type { SeasonSpotlight } from '@/lib/season-spotlight'

const DAY_MS = 86_400_000

function spotlight(overrides: Partial<SeasonSpotlight> = {}): SeasonSpotlight {
  return {
    id: 1,
    code: 'AI4BBS',
    name: 'AI4BBS 产业商业赛季',
    displayName: 'AI4BBS 产业商业赛季',
    organizer: 'BoomLand 组委会',
    intro: '把真实问题做成可交付、可核验的服务。',
    href: '/seasons/1',
    typeLabel: '赛季',
    statusLabel: '进行中',
    statusTone: 'accent',
    registrationLabel: '报名已截止',
    registrationTone: 'neutral',
    registrationOpen: false,
    registrationNote: '报名已截止',
    activityRange: '2026.11.11 — 2026.12.10',
    registrationRange: '2026.10.22 — 2026.10.30',
    participantLabel: '3 / 50 人',
    challengeCount: 4,
    status: SeasonStatus.Active,
    themes: ['新型储能基建', '全球 AI 基建'],
    pinned: true,
    workDeadline: new Date(Date.now() + 19 * DAY_MS).toISOString(),
    dayIndex: 10,
    dayTotal: 29,
    parallelSeasons: [
      {
        id: 2,
        name: 'H03 上海站 · 黑客松',
        city: '上海',
        typeLabel: '黑客松',
        statusLabel: '进行中',
        href: '/seasons/2',
      },
    ],
    ...overrides,
  }
}

describe('CurrentSeasonGate', () => {
  it('renders the live season as a ticket', () => {
    render(<CurrentSeasonGate season={spotlight()} />)

    expect(screen.getByText('AI4BBS')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'AI4BBS 产业商业赛季' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/BoomLand 组委会/)).toBeInTheDocument()
    expect(screen.getByText('新型储能基建')).toBeInTheDocument()
    expect(screen.getByText('全球 AI 基建')).toBeInTheDocument()
    expect(screen.getAllByText('进行中').length).toBeGreaterThan(0)
    expect(screen.getByText(/并行 1 个赛季/)).toBeInTheDocument()
    expect(screen.getByText('H03 上海站 · 黑客松')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /进入当前赛季/ })).toHaveAttribute(
      'href',
      '/seasons/1',
    )
    expect(screen.getByText('2026.11.11 — 2026.12.10')).toBeInTheDocument()
  })

  it('keeps the ticket shell and entry when there is no season', () => {
    render(<CurrentSeasonGate season={null} />)

    expect(
      screen.getByRole('heading', { name: '新一季正在筹备' }),
    ).toBeInTheDocument()
    expect(screen.getByText('NO ACTIVE SEASON')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /查看火热赛季/ })).toHaveAttribute(
      'href',
      '/seasons',
    )
  })
})
