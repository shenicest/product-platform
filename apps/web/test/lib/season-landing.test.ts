import { describe, expect, it } from 'vitest'
import {
  SeasonApplicationStatus,
  SeasonStatus,
  SeasonType,
  type SeasonSchedule,
} from '@shenicest/shared'
import type { SeasonDetail } from '@/lib/boomland'
import { seasonGroup, sortCardsByStage, toSeasonCard } from '@/lib/season-landing'

/** 报名窗口 10-12 10:00 开放，10-26 23:59 截止（北京时间）。 */
function schedule(overrides: Partial<SeasonSchedule> = {}): SeasonSchedule {
  return {
    applyOpen: '2026-10-12T02:00:00.000Z',
    applyClose: '2026-10-26T15:59:00.000Z',
    startAt: '2026-11-01T01:00:00.000Z',
    teamDeadline: '2026-11-10T15:59:00.000Z',
    challengeFreezeAt: '2026-11-15T15:59:00.000Z',
    workDeadline: '2026-12-01T15:59:00.000Z',
    scoreDeadline: '2026-12-10T15:59:00.000Z',
    settleDate: '2026-12-20T15:59:00.000Z',
    ...overrides,
  }
}

/**
 * 详情对象。`applicationWindow` 在真实响应里由后端按 `schedule` 算好；
 * 为了让测试里的时间点可控，这里用「已过 open / 未过 close」的写法直接用
 * 日期构造，而不是依赖渲染时刻。
 */
function detail(overrides: Partial<SeasonDetail> = {}): SeasonDetail {
  const now = Date.now()
  const window = {
    opensAt: new Date(now - 86_400_000).toISOString(),
    closesAt: new Date(now + 86_400_000).toISOString(),
    isOpen: true,
  }
  return {
    id: 502,
    code: '502',
    name: 'BoomLand A4BBS 产业商业赛季',
    type: SeasonType.Season,
    city: '上海',
    status: SeasonStatus.Active,
    themes: ['AI 应用'],
    schedule: schedule(),
    organizerOrgs: [{ id: 1, name: 'A4BBS' }],
    pinned: false,
    approvedAt: '2026-09-01T00:00:00.000Z',
    participantCapacity: 20,
    participantCount: 19,
    publishedChallengeCount: 3,
    intro: '把真实问题做成可交付的服务',
    ruleCard: [],
    rulesVersion: 1,
    awardingEntity: 'A4BBS',
    agreementVersion: 'v1',
    agreementContent: null,
    startedAt: null,
    applicationWindow: window,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('sortCardsByStage', () => {
  it('puts earlier phases first', () => {
    const cards = [
      { id: 1, group: '进行中' as const },
      { id: 2, group: '即将开始' as const },
      { id: 3, group: '报名中' as const },
    ]

    expect(sortCardsByStage(cards).map((card) => card.id)).toEqual([2, 3, 1])
  })

  it('keeps the original order inside the same phase', () => {
    const cards = [
      { id: 1, group: '进行中' as const },
      { id: 2, group: '进行中' as const },
      { id: 3, group: '即将开始' as const },
    ]

    expect(sortCardsByStage(cards).map((card) => card.id)).toEqual([3, 1, 2])
  })

  it('does not mutate the input', () => {
    const cards = [
      { id: 1, group: '进行中' as const },
      { id: 2, group: '即将开始' as const },
    ]

    sortCardsByStage(cards)
    expect(cards.map((card) => card.id)).toEqual([1, 2])
  })
})

describe('seasonGroup', () => {
  it('groups an open registration window under 报名中', () => {
    expect(seasonGroup(detail())).toBe('报名中')
  })

  it('falls back to the season status when the window is not open', () => {
    expect(
      seasonGroup(
        detail({
          status: SeasonStatus.Upcoming,
          applicationWindow: {
            opensAt: '2020-01-01T00:00:00.000Z',
            closesAt: '2020-02-01T00:00:00.000Z',
            isOpen: false,
          },
        }),
      ),
    ).toBe('即将开始')
  })
})

describe('toSeasonCard', () => {
  it('labels the registration status on the card', () => {
    const card = toSeasonCard(detail())
    expect(card.registrationState).toBe('open')
    expect(card.registrationLabel).toBe('报名中')
    expect(card.registrationOpen).toBe(true)
  })

  it('drops the CTA when registration is not open', () => {
    const card = toSeasonCard(
      detail({
        applicationWindow: {
          opensAt: '2020-01-01T00:00:00.000Z',
          closesAt: '2020-02-01T00:00:00.000Z',
          isOpen: false,
        },
      }),
      { isLoggedIn: true },
    )
    expect(card.registrationState).toBe('closed')
    expect(card.registrationLabel).toBe('报名已截止')
    expect(card.registrationOpen).toBe(false)
    // 非报名中的票券卡不给按钮：整卡仍是详情入口。
    expect(card.ctaLabel).toBeNull()
    expect(card.ctaHref).toBeNull()
  })

  it('keeps the CTA for an application that is still being reviewed while the window is open', () => {
    const card = toSeasonCard(detail(), {
      isLoggedIn: true,
      applicationStatus: SeasonApplicationStatus.Waitlisted,
    })
    expect(card.ctaLabel).toBe('候补中')
    expect(card.ctaHref).toBe('/me/applications')
  })

  it('asks a viewer without an application to apply', () => {
    const card = toSeasonCard(detail(), { isLoggedIn: true, applicationStatus: null })
    expect(card.applicationLabel).toBeNull()
    expect(card.ctaLabel).toBe('立即报名')
    expect(card.ctaHref).toBe('/seasons/502/apply')
  })

  it('shows the review state and the review CTA once applied', () => {
    const card = toSeasonCard(detail(), {
      isLoggedIn: true,
      applicationStatus: SeasonApplicationStatus.Submitted,
    })
    expect(card.applicationLabel).toBe('审核中')
    expect(card.ctaLabel).toBe('报名审核中')
    expect(card.ctaHref).toBe('/me/applications')
  })

  it('offers a re-apply entry for a withdrawn application', () => {
    const card = toSeasonCard(detail(), {
      isLoggedIn: true,
      applicationStatus: SeasonApplicationStatus.Withdrawn,
    })
    expect(card.applicationLabel).toBe('已撤回')
    expect(card.ctaLabel).toBe('重新报名')
    expect(card.ctaHref).toBe('/seasons/502/apply')
  })

  it('points a rejected applicant at the rejection reason', () => {
    const card = toSeasonCard(detail(), {
      isLoggedIn: true,
      applicationStatus: SeasonApplicationStatus.Rejected,
    })
    expect(card.applicationLabel).toBe('未通过')
    expect(card.ctaLabel).toBe('查看未通过原因')
    expect(card.ctaHref).toBe('/me/applications')
  })

  it('keeps the season name and organizer slots', () => {
    const card = toSeasonCard(detail())
    expect(card.name).toBe('BoomLand A4BBS 产业商业赛季')
    expect(card.organizer).toBe('A4BBS')
    expect(card.href).toBe('/seasons/502')
  })
})
