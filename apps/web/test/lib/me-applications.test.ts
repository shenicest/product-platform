import { describe, expect, it } from 'vitest'
import {
  SeasonApplicationStatus,
  SeasonStatus,
  SeasonType,
  WechatStatus,
  type SeasonSchedule,
} from '@shenicest/shared'
import type { MySeasonApplication, SeasonSummary } from '@/lib/boomland'
import {
  APPLICATIONS_FOOTNOTE,
  MY_APPLICATION_COLUMNS,
  MY_APPLICATIONS_PAGE_SIZE,
  PUBLIC_SEASON_LIMIT,
  applicationWindowLabel,
  applicationWindowMeta,
  applicationWindowState,
  applyDeadlineHint,
  canWithdrawApplication,
  monthDayTimeLabel,
  myApplicationRow,
  myApplicationRows,
  parseApplicationsPage,
  participantProgressLabel,
  publicSeasonCards,
  reviewNoteText,
  wechatCellLabel,
} from '@/lib/me-applications'

const NOW = new Date('2026-11-08T04:00:00.000Z')

/**
 * 赛程构造器。
 *
 * 允许把任意节点置空：赛程未排期时后端给出的就是空值，而 `SeasonSchedule`
 * 的字段类型声明为必填 string，所以这里显式放宽并在返回处断言回去。
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
  return {
    application: application(),
    season: season(),
    wechatStatus: null,
    ...overrides,
  }
}

describe('MY_APPLICATION_COLUMNS', () => {
  it('lists the seven design columns plus a dedicated action column', () => {
    expect(MY_APPLICATION_COLUMNS.map((column) => column.label)).toEqual([
      '赛季',
      '提交时间',
      '审核状态',
      '审核说明',
      '微信群',
      '赛季标识',
      '条款版本',
      '操作',
    ])
  })
})

describe('APPLICATIONS_FOOTNOTE', () => {
  it('spells out the withdraw and exit rules', () => {
    expect(APPLICATIONS_FOOTNOTE).toContain('审核前可以撤回')
    expect(APPLICATIONS_FOOTNOTE).toContain('退出不删除作品、积分与 Track Record')
    expect(APPLICATIONS_FOOTNOTE).toContain('只有主办方和平台管理员可见')
  })
})

describe('reviewNoteText', () => {
  it('falls back to an em dash when the organizer left no note', () => {
    expect(reviewNoteText(null)).toBe('—')
    expect(reviewNoteText(undefined)).toBe('—')
    expect(reviewNoteText('   ')).toBe('—')
  })

  it('keeps a real note', () => {
    expect(reviewNoteText(' 方向不匹配 ')).toBe('方向不匹配')
  })
})

describe('wechatCellLabel', () => {
  it('shows an em dash for a non-participant', () => {
    expect(wechatCellLabel(item({ wechatStatus: null }))).toBe('—')
  })

  it('maps the participant wechat status through the shared labels', () => {
    expect(wechatCellLabel(item({ wechatStatus: WechatStatus.Joined }))).toBe('已加入')
    expect(wechatCellLabel(item({ wechatStatus: WechatStatus.Invited }))).toBe('已邀请')
  })
})

describe('canWithdrawApplication', () => {
  it('allows withdrawing until the review lands', () => {
    expect(canWithdrawApplication(SeasonApplicationStatus.Submitted)).toBe(true)
    expect(canWithdrawApplication(SeasonApplicationStatus.Pending)).toBe(true)
    expect(canWithdrawApplication(SeasonApplicationStatus.Waitlisted)).toBe(true)
  })

  it('locks accepted, rejected and withdrawn applications', () => {
    expect(canWithdrawApplication(SeasonApplicationStatus.Accepted)).toBe(false)
    expect(canWithdrawApplication(SeasonApplicationStatus.Rejected)).toBe(false)
    expect(canWithdrawApplication(SeasonApplicationStatus.Withdrawn)).toBe(false)
  })
})

describe('myApplicationRow', () => {
  it('maps a full application into the seven table cells', () => {
    const row = myApplicationRow(
      item({
        application: application({
          reviewReason: '方向不匹配',
          status: SeasonApplicationStatus.Rejected,
        }),
        wechatStatus: WechatStatus.Joined,
      }),
    )

    expect(row).toMatchObject({
      applicationId: 11,
      seasonId: 502,
      seasonName: 'A4BBS 产业商业赛季',
      seasonCode: '502',
      seasonHref: '/seasons/502',
      statusLabel: '未通过',
      statusTone: 'danger',
      reviewNote: '方向不匹配',
      wechat: '已加入',
      agreementVersion: 'v3',
      canWithdraw: false,
    })
    // 2026-10-26T01:40Z = 北京 10月26日 09:40
    expect(row.submittedAt).toBe('2026.10.26 09:40')
  })

  it('uses em dashes for a missing review note and a missing wechat status', () => {
    const row = myApplicationRow(item())
    expect(row.reviewNote).toBe('—')
    expect(row.wechat).toBe('—')
    expect(row.wechatStatus).toBeNull()
    expect(row.canWithdraw).toBe(true)
  })

  it('uses an em dash for an empty agreement version', () => {
    expect(
      myApplicationRow(item({ application: application({ agreementVersion: '' }) }))
        .agreementVersion,
    ).toBe('—')
  })

  it('maps every item in a list, keeping order', () => {
    const rows = myApplicationRows([
      item({ application: application({ id: 1 }) }),
      item({ application: application({ id: 2 }) }),
    ])
    expect(rows.map((row) => row.applicationId)).toEqual([1, 2])
  })
})

describe('monthDayTimeLabel', () => {
  it('rewrites the shared formatter output into 月日 时:分', () => {
    // 2026-10-12T02:00Z = 北京 10月12日 10:00
    expect(monthDayTimeLabel('2026-10-12T02:00:00.000Z')).toBe('10月12日 10:00')
    // 2026-10-26T15:59Z = 北京 10月26日 23:59
    expect(monthDayTimeLabel('2026-10-26T15:59:00.000Z')).toBe('10月26日 23:59')
  })

  it('returns null for a missing or invalid value', () => {
    expect(monthDayTimeLabel(null)).toBeNull()
    expect(monthDayTimeLabel(undefined)).toBeNull()
    expect(monthDayTimeLabel('not-a-date')).toBeNull()
  })
})

describe('applicationWindowLabel', () => {
  it('builds the 报名 range with the Beijing time note', () => {
    expect(applicationWindowLabel(season())).toBe(
      '报名 10月12日 10:00 — 10月26日 23:59（北京时间）',
    )
  })

  it('says the window is unpublished when the schedule has no dates', () => {
    expect(applicationWindowLabel(season({ schedule: null }))).toBe('报名时间待公布')
    expect(
      applicationWindowLabel(
        season({ schedule: schedule({ applyOpen: null, applyClose: null }) }),
      ),
    ).toBe('报名时间待公布')
  })

  it('keeps a one-sided range instead of dropping the line', () => {
    expect(
      applicationWindowLabel(season({ schedule: schedule({ applyClose: null }) })),
    ).toBe('报名 10月12日 10:00 — 待定（北京时间）')
  })
})

describe('applicationWindowState', () => {
  it('reads an open window', () => {
    expect(applicationWindowState(season(), new Date('2026-10-20T00:00:00.000Z'))).toBe('open')
  })

  it('reads a closed window once applyClose has passed', () => {
    // NOW 是 2026-11-08，applyClose 是 2026-10-26 —— 已截止。
    expect(applicationWindowState(season(), NOW)).toBe('closed')
    // 窗口内（10-20）则是报名中。
    expect(applicationWindowState(season(), new Date('2026-10-20T00:00:00.000Z'))).toBe('open')
  })

  it('reads a not-yet-open window before applyOpen', () => {
    const early = new Date('2026-09-01T00:00:00.000Z')
    expect(applicationWindowState(season(), early)).toBe('not-open-yet')
  })

  it('reports the season state before the window state', () => {
    expect(applicationWindowState(season({ status: SeasonStatus.Suspended }), NOW)).toBe(
      'suspended',
    )
    expect(applicationWindowState(season({ status: SeasonStatus.Cancelled }), NOW)).toBe(
      'cancelled',
    )
  })

  it('reports an unpublished window when applyClose is missing', () => {
    expect(applicationWindowState(season({ schedule: null }), NOW)).toBe('unpublished')
    expect(
      applicationWindowState(season({ schedule: schedule({ applyClose: null }) }), NOW),
    ).toBe('unpublished')
  })
})

describe('applicationWindowMeta', () => {
  it('gives every state a label and a tone', () => {
    expect(applicationWindowMeta('open')).toEqual({ label: '报名中', tone: 'success' })
    expect(applicationWindowMeta('closed').label).toBe('报名已截止')
    expect(applicationWindowMeta('not-open-yet').label).toBe('报名未开始')
    expect(applicationWindowMeta('unpublished').label).toBe('报名时间待公布')
    expect(applicationWindowMeta('suspended').tone).toBe('warning')
    expect(applicationWindowMeta('cancelled').tone).toBe('danger')
  })
})

describe('applyDeadlineHint', () => {
  it('says a closed window closed at a specific time', () => {
    const hint = applyDeadlineHint(season(), NOW)
    expect(hint.closed).toBe(true)
    expect(hint.text).toBe('报名已于 10月26日 23:59 截止')
  })

  it('says when an upcoming window opens', () => {
    const hint = applyDeadlineHint(season(), new Date('2026-09-01T00:00:00.000Z'))
    expect(hint.closed).toBe(false)
    expect(hint.text).toBe('报名将于 10月12日 10:00 开放')
  })

  it('shows the deadline while the window is open', () => {
    const hint = applyDeadlineHint(season(), new Date('2026-10-20T00:00:00.000Z'))
    expect(hint.closed).toBe(false)
    expect(hint.text).toBe('报名截止 10月26日 23:59')
  })

  it('explains a suspended or cancelled season instead of quoting dates', () => {
    expect(applyDeadlineHint(season({ status: SeasonStatus.Suspended }), NOW)).toEqual({
      closed: true,
      text: '赛季已暂停，报名暂时关闭',
    })
    expect(applyDeadlineHint(season({ status: SeasonStatus.Cancelled }), NOW)).toEqual({
      closed: true,
      text: '赛季已取消，报名不再开放',
    })
  })

  it('never claims a deadline when the schedule is unpublished', () => {
    expect(applyDeadlineHint(season({ schedule: null }), NOW)).toEqual({
      closed: false,
      text: '报名时间待公布',
    })
  })
})

describe('participantProgressLabel', () => {
  it('writes 已通过 / 名额 against the capacity', () => {
    expect(participantProgressLabel({ participantCount: 19, participantCapacity: 20 })).toBe(
      '已通过 19 / 名额 20',
    )
  })

  it('writes 不限 when there is no capacity', () => {
    expect(participantProgressLabel({ participantCount: 7, participantCapacity: null })).toBe(
      '已通过 7 人 · 名额不限',
    )
  })
})

describe('publicSeasonCards', () => {
  it('maps a season into the card fields', () => {
    const [card] = publicSeasonCards([season()], NOW)
    expect(card).toMatchObject({
      id: 502,
      code: '502',
      name: 'A4BBS 产业商业赛季',
      typeLabel: '赛季',
      href: '/seasons/502',
      seasonStatusLabel: '进行中',
      windowState: 'closed',
      windowLabel: '报名已截止',
      applyWindow: '报名 10月12日 10:00 — 10月26日 23:59（北京时间）',
      participants: '已通过 19 / 名额 20',
      pinned: false,
    })
    expect(card.deadline).toEqual({ closed: true, text: '报名已于 10月26日 23:59 截止' })
  })

  it('labels a hackathon season type through the shared helper', () => {
    const [card] = publicSeasonCards([season({ type: SeasonType.Hackathon })], NOW)
    expect(card.typeLabel).toBe('黑客松')
  })

  it('sorts pinned seasons first without mutating the input', () => {
    const input = [
      season({ id: 1, code: '1', pinned: false }),
      season({ id: 2, code: '2', pinned: true }),
    ]
    const cards = publicSeasonCards(input, NOW)
    expect(cards.map((card) => card.id)).toEqual([2, 1])
    expect(input.map((entry) => entry.id)).toEqual([1, 2])
  })

  it('returns an empty list for no seasons', () => {
    expect(publicSeasonCards([], NOW)).toEqual([])
  })
})

describe('parseApplicationsPage', () => {
  it('defaults to the first page', () => {
    expect(parseApplicationsPage({})).toBe(1)
  })

  it('reads a numeric page and reads the first array entry', () => {
    expect(parseApplicationsPage({ page: '3' })).toBe(3)
    expect(parseApplicationsPage({ page: ['4', '9'] })).toBe(4)
  })

  it('floors fractions and rejects junk', () => {
    expect(parseApplicationsPage({ page: '2.9' })).toBe(2)
    expect(parseApplicationsPage({ page: '0' })).toBe(1)
    expect(parseApplicationsPage({ page: '-2' })).toBe(1)
    expect(parseApplicationsPage({ page: 'abc' })).toBe(1)
  })
})

describe('page size constants', () => {
  it('stay within the backend pageSize cap of 100', () => {
    expect(MY_APPLICATIONS_PAGE_SIZE).toBeGreaterThan(0)
    expect(MY_APPLICATIONS_PAGE_SIZE).toBeLessThanOrEqual(100)
    expect(PUBLIC_SEASON_LIMIT).toBeGreaterThan(0)
    expect(PUBLIC_SEASON_LIMIT).toBeLessThanOrEqual(100)
  })
})
