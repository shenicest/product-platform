import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  SeasonApplicationStatus,
  SeasonStatus,
  SeasonType,
  type SeasonSchedule,
} from '@shenicest/shared'
import { SeasonLanding } from '@/components/boomland/v26/season-landing'
import { SeasonPoster } from '@/components/boomland/v26/season-poster'
import { toSeasonCard } from '@/lib/season-landing'
import type { MySeasonApplication, SeasonDetail } from '@/lib/boomland'

/**
 * 赛事卡片与详情海报上的「报名状态 / 我的报名状态」。
 *
 * 这两块是纯展示：状态文案、CTA 文案与进度条的显隐全部来自
 * `lib/season-registration.ts`，组件只负责摆位置。所以这里的断言都是
 * 「用户能看见什么」——徽章文字、CTA 文字与进度条是否出现在 DOM 里。
 */

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

/** 报名窗口：一天前开放，一天后截止 —— 与渲染时刻无关地落在「报名中」。 */
const OPEN_WINDOW = {
  opensAt: new Date(Date.now() - 86_400_000).toISOString(),
  closesAt: new Date(Date.now() + 86_400_000).toISOString(),
  isOpen: true,
}

/** 报名窗口：早已截止。 */
const CLOSED_WINDOW = {
  opensAt: '2020-01-01T00:00:00.000Z',
  closesAt: '2020-02-01T00:00:00.000Z',
  isOpen: false,
}

function detail(overrides: Partial<SeasonDetail> = {}): SeasonDetail {
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
    intro: '把真实问题做成可交付的服务',
    ruleCard: [],
    rulesVersion: 1,
    awardingEntity: 'A4BBS',
    agreementVersion: 'v1',
    agreementContent: null,
    startedAt: null,
    applicationWindow: OPEN_WINDOW,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function application(
  overrides: Partial<MySeasonApplication['application']> = {},
): MySeasonApplication {
  return {
    application: {
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
    },
    season: {
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
    },
    wechatStatus: null,
  }
}

function ticket(overrides: Partial<SeasonDetail> = {}, applicationStatus?: string | null) {
  const card = toSeasonCard(detail(overrides), {
    isLoggedIn: true,
    applicationStatus: applicationStatus ?? null,
  })
  render(<SeasonLanding cards={[card]} />)
  // 首屏是 <section>，票券是 <article>；这里只断言票券。
  return screen.getByRole('article')
}

describe('SeasonLanding ticket', () => {
  it('shows the registration status, the quota and the progress bar while registration is open', () => {
    const card = ticket()
    expect(within(card).getByText('报名中')).toBeInTheDocument()
    expect(within(card).getByText('已通过 19')).toBeInTheDocument()
    expect(within(card).getByText('共 20 个名额')).toBeInTheDocument()
    expect(card.querySelector('.v26-ticket__track')).not.toBeNull()
    expect(within(card).getByRole('link', { name: /立即报名/ })).toHaveAttribute(
      'href',
      '/seasons/502/apply',
    )
  })

  it('drops the quota, the progress bar and the CTA once registration closed', () => {
    const card = ticket({ applicationWindow: CLOSED_WINDOW })
    expect(within(card).getByText('报名已截止')).toBeInTheDocument()
    expect(card.querySelector('.v26-ticket__track')).toBeNull()
    expect(card.querySelector('.v26-ticket__cta')).toBeNull()
    // 「已通过多少 / 多少个名额」也不再出现在卡片上。
    expect(within(card).queryByText(/已通过/)).toBeNull()
    expect(within(card).queryByText(/名额/)).toBeNull()
    // 整卡仍是详情入口。
    expect(within(card).getByRole('link', { name: /查看 .* 详情/ })).toHaveAttribute(
      'href',
      '/seasons/502',
    )
  })

  it('drops the CTA for an accepted application when the window is closed', () => {
    const card = ticket({ applicationWindow: CLOSED_WINDOW }, SeasonApplicationStatus.Accepted)
    expect(within(card).queryByRole('link', { name: /查看我的报名/ })).toBeNull()
    expect(card.querySelector('.v26-ticket__cta')).toBeNull()
  })

  it('shows the review copy for an application under review', () => {
    const card = ticket({}, SeasonApplicationStatus.Submitted)
    expect(within(card).getByRole('link', { name: /报名审核中/ })).toHaveAttribute(
      'href',
      '/me/applications',
    )
  })

  it('shows the waitlist copy for a waitlisted application', () => {
    const card = ticket({}, SeasonApplicationStatus.Waitlisted)
    expect(within(card).getByRole('link', { name: /候补中/ })).toHaveAttribute(
      'href',
      '/me/applications',
    )
  })

  it('reserves the CTA width so a long button never covers the progress bar', () => {
    const card = ticket({}, SeasonApplicationStatus.Rejected)
    // 占位元素与按钮同样宽（同一套盒模型），进度条到这里就结束。
    const spacer = card.querySelector('.v26-ticket__cta-spacer')
    expect(spacer).not.toBeNull()
    expect(spacer?.textContent).toContain('查看未通过原因')
    expect(card.querySelector('.v26-ticket__track')).not.toBeNull()
  })

  it('shows the applied copy for an accepted application', () => {
    const card = ticket({}, SeasonApplicationStatus.Accepted)
    expect(within(card).getByRole('link', { name: /查看我的报名/ })).toHaveAttribute(
      'href',
      '/me/applications',
    )
  })

  it('offers a re-apply entry for a withdrawn application', () => {
    const card = ticket({}, SeasonApplicationStatus.Withdrawn)
    expect(within(card).getByRole('link', { name: /重新报名/ })).toHaveAttribute(
      'href',
      '/seasons/502/apply',
    )
  })

  it('points a rejected applicant at the rejection reason', () => {
    const card = ticket({}, SeasonApplicationStatus.Rejected)
    expect(within(card).getByRole('link', { name: /查看未通过原因/ })).toHaveAttribute(
      'href',
      '/me/applications',
    )
  })
})

describe('SeasonPoster', () => {
  it('labels the registration status on the detail hero', () => {
    render(<SeasonPoster season={detail()} myApplication={null} isLoggedIn />)
    const hero = screen.getByRole('region')
    expect(within(hero).getByText('报名中')).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: /立即报名/ })).toHaveAttribute(
      'href',
      '/seasons/502/apply',
    )
  })

  it('shows my application status next to the season status', () => {
    render(
      <SeasonPoster
        season={detail()}
        myApplication={application()}
        isLoggedIn
      />,
    )
    const hero = screen.getByRole('region')
    expect(within(hero).getByText('审核中')).toBeInTheDocument()
    expect(within(hero).getByRole('link', { name: /报名审核中/ })).toHaveAttribute(
      'href',
      '/me/applications',
    )
  })

  it('disables the CTA with a clear reason while the window is closed', () => {
    render(
      <SeasonPoster
        season={detail({ applicationWindow: CLOSED_WINDOW })}
        myApplication={application({ status: SeasonApplicationStatus.Withdrawn })}
        isLoggedIn
      />,
    )
    const hero = screen.getByRole('region')
    expect(within(hero).getByText('已撤回')).toBeInTheDocument()
    expect(within(hero).queryByRole('link', { name: /重新报名/ })).toBeNull()
    const cta = hero.querySelector('.v26-ticket-cta[aria-disabled="true"]')
    expect(cta?.textContent).toContain('报名已截止')
  })
})
