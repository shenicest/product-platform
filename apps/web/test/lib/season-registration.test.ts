import { describe, expect, it } from 'vitest'
import {
  SeasonApplicationStatus,
  SeasonStatus,
  SeasonType,
  type SeasonSchedule,
} from '@shenicest/shared'
import type { SeasonSummary } from '@/lib/boomland'
import {
  SEASON_REGISTRATION_META,
  registrationBlockedLabel,
  seasonApplicationCta,
  seasonRegistration,
} from '@/lib/season-registration'

/** 报名窗口 10-12 10:00 开放，10-26 23:59 截止（北京时间）。 */
type ScheduleOverrides = { [K in keyof SeasonSchedule]?: string | null }

function schedule(overrides: ScheduleOverrides = {}): SeasonSchedule {
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
  } as SeasonSchedule
}

function season(overrides: Partial<SeasonSummary> = {}): SeasonSummary {
  return {
    id: 502,
    code: '502',
    name: 'A4BBS 产业商业赛季',
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

const BEFORE_OPEN = new Date('2026-09-01T00:00:00.000Z')
const INSIDE_WINDOW = new Date('2026-10-20T00:00:00.000Z')
const AFTER_CLOSE = new Date('2026-11-08T04:00:00.000Z')

describe('seasonRegistration', () => {
  it('has exactly the three public labels', () => {
    expect(Object.keys(SEASON_REGISTRATION_META).sort()).toEqual([
      'closed',
      'not-open',
      'open',
    ])
    expect(SEASON_REGISTRATION_META['not-open'].label).toBe('未开放')
    expect(SEASON_REGISTRATION_META.open.label).toBe('报名中')
    expect(SEASON_REGISTRATION_META.closed.label).toBe('报名已截止')
  })

  it('reads the window from the schedule summary', () => {
    expect(seasonRegistration(season(), BEFORE_OPEN)).toMatchObject({
      state: 'not-open',
      label: '未开放',
    })
    expect(seasonRegistration(season(), INSIDE_WINDOW)).toMatchObject({
      state: 'open',
      label: '报名中',
    })
    expect(seasonRegistration(season(), AFTER_CLOSE)).toMatchObject({
      state: 'closed',
      label: '报名已截止',
    })
  })

  it('reads the same three states from a detail applicationWindow', () => {
    const window = {
      opensAt: '2026-10-12T02:00:00.000Z',
      closesAt: '2026-10-26T15:59:00.000Z',
    }
    expect(seasonRegistration({ applicationWindow: window }, BEFORE_OPEN).state).toBe(
      'not-open',
    )
    expect(seasonRegistration({ applicationWindow: window }, INSIDE_WINDOW).state).toBe(
      'open',
    )
    expect(seasonRegistration({ applicationWindow: window }, AFTER_CLOSE).state).toBe(
      'closed',
    )
  })

  it('treats a season without a schedule as 未开放', () => {
    expect(seasonRegistration(season({ schedule: null }), AFTER_CLOSE)).toMatchObject({
      state: 'not-open',
      label: '未开放',
    })
  })

  it('falls back to the backend isOpen flag when the dates are missing', () => {
    const window = { opensAt: null, closesAt: null, isOpen: true }
    expect(seasonRegistration({ applicationWindow: window }, AFTER_CLOSE).state).toBe('open')
  })

  it('closes registration once the open date passed and only the close date is known', () => {
    expect(
      seasonRegistration(
        season({ schedule: schedule({ applyOpen: null }) }),
        AFTER_CLOSE,
      ).state,
    ).toBe('closed')
  })

  it('keeps the window state independent of a suspended or cancelled season', () => {
    // 暂停 / 取消是赛季状态，不该让报名窗口在「报名中 / 已截止」之间来回跳；
    // 用户能不能点按钮由 CTA 和提示文案表达。
    expect(
      seasonRegistration(season({ status: SeasonStatus.Suspended }), INSIDE_WINDOW).state,
    ).toBe('open')
    expect(
      seasonRegistration(season({ status: SeasonStatus.Cancelled }), INSIDE_WINDOW).state,
    ).toBe('open')
  })

  it('ignores unparseable dates', () => {
    const broken = season({
      schedule: schedule({ applyOpen: 'not-a-date', applyClose: 'not-a-date' }),
    })
    expect(seasonRegistration(broken, AFTER_CLOSE).state).toBe('not-open')
  })
})

describe('registrationBlockedLabel', () => {
  it('says the window closed', () => {
    expect(registrationBlockedLabel(seasonRegistration(season(), AFTER_CLOSE))).toBe(
      '报名已截止',
    )
  })

  it('says when the window opens', () => {
    expect(registrationBlockedLabel(seasonRegistration(season(), BEFORE_OPEN))).toBe(
      '报名 10月12日 开放',
    )
  })

  it('says the opening time is not published yet', () => {
    expect(registrationBlockedLabel(seasonRegistration(season({ schedule: null })))).toBe(
      '报名时间待公布',
    )
  })
})

describe('seasonApplicationCta', () => {
  const registration = seasonRegistration(season(), INSIDE_WINDOW)
  const base = {
    seasonId: 502,
    seasonStatus: SeasonStatus.Active,
    isLoggedIn: true,
    registration,
  }

  function cta(applicationStatus: string | null) {
    return seasonApplicationCta({ ...base, applicationStatus })
  }

  it('invites a user who has not applied yet to apply', () => {
    expect(cta(null)).toEqual({
      label: '立即报名',
      href: '/seasons/502/apply',
      disabled: false,
    })
  })

  it('sends a logged-out visitor to login first', () => {
    expect(seasonApplicationCta({ ...base, isLoggedIn: false, applicationStatus: null }))
      .toEqual({
        label: '登录后报名',
        href: '/login?returnTo=/seasons/502/apply',
        disabled: false,
      })
  })

  it('distinguishes every application status by its own copy', () => {
    expect(cta(SeasonApplicationStatus.Submitted)).toEqual({
      label: '报名审核中',
      href: '/me/applications',
      disabled: false,
    })
    // pending 对报名者而言同样是「等结论」。
    expect(cta(SeasonApplicationStatus.Pending).label).toBe('报名审核中')
    expect(cta(SeasonApplicationStatus.Waitlisted)).toEqual({
      label: '候补中',
      href: '/me/applications',
      disabled: false,
    })
    expect(cta(SeasonApplicationStatus.Accepted)).toEqual({
      label: '查看我的报名',
      href: '/me/applications',
      disabled: false,
    })
    expect(cta(SeasonApplicationStatus.Rejected)).toEqual({
      label: '查看未通过原因',
      href: '/me/applications',
      disabled: false,
    })
    expect(cta(SeasonApplicationStatus.Withdrawn)).toEqual({
      label: '重新报名',
      href: '/seasons/502/apply',
      disabled: false,
    })
  })

  it('keeps the six labels mutually distinct', () => {
    const labels = [
      cta(null).label,
      cta(SeasonApplicationStatus.Submitted).label,
      cta(SeasonApplicationStatus.Waitlisted).label,
      cta(SeasonApplicationStatus.Accepted).label,
      cta(SeasonApplicationStatus.Withdrawn).label,
      cta(SeasonApplicationStatus.Rejected).label,
    ]
    expect(new Set(labels).size).toBe(6)
  })

  it('lets a withdrawn or reviewing user still reach their application after the window closed', () => {
    const closedBase = { ...base, registration: seasonRegistration(season(), AFTER_CLOSE) }
    expect(
      seasonApplicationCta({
        ...closedBase,
        applicationStatus: SeasonApplicationStatus.Submitted,
      }).href,
    ).toBe('/me/applications')
    // 已撤回但窗口已关：不能再报，禁用并说明原因。
    expect(
      seasonApplicationCta({
        ...closedBase,
        applicationStatus: SeasonApplicationStatus.Withdrawn,
      }),
    ).toEqual({ label: '报名已截止', href: null, disabled: true })
  })

  it('disables the CTA when the window has not opened yet', () => {
    expect(
      seasonApplicationCta({
        ...base,
        registration: seasonRegistration(season(), BEFORE_OPEN),
        applicationStatus: null,
      }),
    ).toEqual({ label: '报名 10月12日 开放', href: null, disabled: true })
  })

  it('disables the CTA on a suspended or cancelled season', () => {
    expect(
      seasonApplicationCta({ ...base, seasonStatus: SeasonStatus.Suspended, applicationStatus: null }),
    ).toEqual({ label: '报名已暂停', href: null, disabled: true })
    expect(
      seasonApplicationCta({ ...base, seasonStatus: SeasonStatus.Cancelled, applicationStatus: null }),
    ).toEqual({ label: '赛季已取消', href: null, disabled: true })
  })
})
