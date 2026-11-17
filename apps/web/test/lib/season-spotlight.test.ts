import { describe, expect, it } from 'vitest'
import { SeasonStatus, SeasonType, type SeasonSchedule } from '@shenicest/shared'
import type { SeasonDetail, SeasonSummary } from '@/lib/boomland'
import { pickCurrentSeason, toSeasonSpotlight } from '@/lib/season-spotlight'

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

function summary(overrides: Partial<SeasonSummary> = {}): SeasonSummary {
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
    ...overrides,
  }
}

function detail(overrides: Partial<SeasonDetail> = {}): SeasonDetail {
  const now = Date.now()
  return {
    ...summary(),
    intro: '把真实问题做成可交付的服务',
    ruleCard: [],
    rulesVersion: 1,
    awardingEntity: 'A4BBS',
    agreementVersion: 'v1',
    agreementContent: null,
    startedAt: null,
    applicationWindow: {
      opensAt: new Date(now - 86_400_000).toISOString(),
      closesAt: new Date(now + 86_400_000).toISOString(),
      isOpen: true,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('pickCurrentSeason', () => {
  it('returns null when there is no public season', () => {
    expect(pickCurrentSeason([])).toBeNull()
    expect(
      pickCurrentSeason([summary({ status: SeasonStatus.Suspended })]),
    ).toBeNull()
  })

  it('puts the platform-pinned season first even if it is upcoming', () => {
    const upcoming = summary({ id: 1, status: SeasonStatus.Upcoming, pinned: true })
    const active = summary({ id: 2, status: SeasonStatus.Active })

    expect(pickCurrentSeason([active, upcoming])?.id).toBe(1)
  })

  it('prefers an active season over an upcoming one', () => {
    const upcoming = summary({ id: 1, status: SeasonStatus.Upcoming })
    const active = summary({ id: 2, status: SeasonStatus.Active })

    expect(pickCurrentSeason([upcoming, active])?.id).toBe(2)
  })

  it('falls back to an upcoming season', () => {
    const upcoming = summary({ id: 1, status: SeasonStatus.Upcoming })
    expect(pickCurrentSeason([upcoming])?.id).toBe(1)
  })
})

describe('toSeasonSpotlight', () => {
  it('maps a season to the homepage entry view', () => {
    const view = toSeasonSpotlight(summary(), detail())

    expect(view).toMatchObject({
      id: 502,
      code: '502',
      displayName: 'A4BBS 产业商业赛季',
      organizer: 'A4BBS',
      intro: '把真实问题做成可交付的服务',
      href: '/seasons/502',
      typeLabel: '赛季',
      statusLabel: '进行中',
      registrationLabel: '报名中',
      registrationOpen: true,
      challengeCount: 3,
      participantLabel: '19 / 20 人',
      activityRange: '2026.11.01 — 2026.12.01',
    })
  })

  it('falls back to themes when the detail intro is missing', () => {
    const view = toSeasonSpotlight(
      summary({ themes: ['AI 应用', '创作者经济'] }),
      detail({ intro: '   ' }),
    )

    expect(view.intro).toBe('AI 应用 / 创作者经济')
  })

  it('works with the list payload only, without a detail request', () => {
    const view = toSeasonSpotlight(
      summary({
        status: SeasonStatus.Upcoming,
        schedule: schedule({ applyOpen: '2020-01-01T00:00:00.000Z', applyClose: '2020-02-01T00:00:00.000Z' }),
      }),
    )

    expect(view.registrationLabel).toBe('报名已截止')
    expect(view.registrationOpen).toBe(false)
    expect(view.registrationNote).toBe('报名已截止')
    expect(view.statusLabel).toBe('即将开始')
    // 没有详情时用列表赛程推导报名窗口，而不是等详情接口。
    expect(view.registrationRange).toBe('2020.01.01 — 2020.02.01')
  })

  it('explains when registration has not opened yet', () => {
    const opensAt = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const view = toSeasonSpotlight(
      summary({
        status: SeasonStatus.Upcoming,
        schedule: schedule({ applyOpen: opensAt }),
      }),
      detail({
        status: SeasonStatus.Upcoming,
        applicationWindow: { opensAt, closesAt: null, isOpen: false },
      }),
    )

    expect(view.registrationLabel).toBe('未开放')
    expect(view.registrationOpen).toBe(false)
    expect(view.registrationNote).toMatch(/^报名 .+ 开放$/)
  })

  it('labels an unlimited capacity without inventing a number', () => {
    const view = toSeasonSpotlight(
      summary({ participantCapacity: null, participantCount: 12 }),
      detail({ participantCapacity: null, participantCount: 12 }),
    )

    expect(view.participantLabel).toBe('12 人参与 · 不限名额')
  })
})
