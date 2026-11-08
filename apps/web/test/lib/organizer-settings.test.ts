import { describe, expect, it } from 'vitest'
import {
  SEASON_RULE_CARD_SCORELESS,
  SEASON_RULE_DEFAULTS,
  SeasonStatus,
  type SeasonSchedule,
} from '@shenicest/shared'
import type { SeasonReadiness } from '@/lib/organizer'
import { ORGANIZER_TABS } from '@/components/organizer/organizer-tabs'
import {
  ORGANIZER_TAB_LABELS,
  ORGANIZER_TAB_SLUGS,
  type OrganizerTabSlug,
  SCHEDULE_MILESTONE_EFFECTS,
  beijingInputToIso,
  canApproveSeason,
  canCancelSeason,
  canCreateAnnouncement,
  canEditSeasonCore,
  canEditSeasonOrganizers,
  canEditSeasonRuleCard,
  canEditSeasonRules,
  canEditSeasonSchedule,
  canResumeSeason,
  canStartSeason,
  canSubmitSeason,
  canSuspendSeason,
  isPendingApproval,
  isoToBeijingInput,
  readinessCheckHref,
  readinessCheckLinkLabel,
  readinessCheckTab,
  ruleCardStatusLabel,
  ruleSummaryRows,
  scheduleMilestoneRows,
  submitActionLabel,
  summarizeReadiness,
  toScheduleDraft,
  toSchedulePayload,
  validateScheduleChange,
} from '@/lib/organizer-settings'

const SCHEDULE: SeasonSchedule = {
  applyOpen: '2027-01-31T16:00:00.000Z', // 2027-02-01 00:00 北京
  applyClose: '2027-02-20T15:59:00.000Z',
  startAt: '2027-02-24T02:00:00.000Z',
  teamDeadline: '2027-03-01T15:59:00.000Z',
  challengeFreezeAt: '2027-03-01T15:59:00.000Z',
  workDeadline: '2027-03-08T15:59:00.000Z',
  scoreDeadline: '2027-03-09T15:59:00.000Z',
  settleDate: '2027-03-12T10:00:00.000Z',
}

function readiness(checks: SeasonReadiness['checks']): SeasonReadiness {
  return {
    seasonId: 21,
    ready: checks.every((check) => check.passed),
    checks,
    generatedAt: '2027-01-01T00:00:00.000Z',
  }
}

describe('SCHEDULE_MILESTONE_EFFECTS', () => {
  it('covers all eight milestones', () => {
    expect(Object.keys(SCHEDULE_MILESTONE_EFFECTS).sort()).toEqual(
      [
        'applyClose',
        'applyOpen',
        'challengeFreezeAt',
        'scoreDeadline',
        'settleDate',
        'startAt',
        'teamDeadline',
        'workDeadline',
      ].sort(),
    )
  })

  it('describes the behaviour at each deadline', () => {
    expect(SCHEDULE_MILESTONE_EFFECTS.applyOpen).toBe('开始接受报名')
    expect(SCHEDULE_MILESTONE_EFFECTS.teamDeadline).toMatch(/需主办方审批/)
    expect(SCHEDULE_MILESTONE_EFFECTS.settleDate).toMatch(/定格/)
  })
})

describe('scheduleMilestoneRows', () => {
  it('returns eight rows in SCHEDULE_MILESTONES order', () => {
    const rows = scheduleMilestoneRows(SCHEDULE)
    expect(rows.map((row) => row.key)).toEqual([
      'applyOpen',
      'applyClose',
      'startAt',
      'teamDeadline',
      'challengeFreezeAt',
      'workDeadline',
      'scoreDeadline',
      'settleDate',
    ])
    expect(rows[0].at).toBe(SCHEDULE.applyOpen)
    expect(rows[0].effect).toBe(SCHEDULE_MILESTONE_EFFECTS.applyOpen)
  })

  it('keeps the eight rows with null times when nothing is scheduled', () => {
    const rows = scheduleMilestoneRows(null)
    expect(rows).toHaveLength(8)
    expect(rows.every((row) => row.at === null)).toBe(true)
  })
})

describe('Beijing time conversion', () => {
  it('renders ISO in Beijing wall time for datetime-local', () => {
    expect(isoToBeijingInput('2027-01-31T16:00:00.000Z')).toBe('2027-02-01T00:00')
    expect(isoToBeijingInput('2027-03-09T15:59:00.000Z')).toBe('2027-03-09T23:59')
  })

  it('returns an empty string for empty or invalid input', () => {
    expect(isoToBeijingInput(null)).toBe('')
    expect(isoToBeijingInput(undefined)).toBe('')
    expect(isoToBeijingInput('not-a-date')).toBe('')
  })

  it('parses datetime-local as Beijing time', () => {
    expect(beijingInputToIso('2027-02-01T00:00')).toBe('2027-01-31T16:00:00.000Z')
    expect(beijingInputToIso('2027-02-01T00:00:30')).toBe('2027-01-31T16:00:30.000Z')
    expect(beijingInputToIso('')).toBeNull()
    expect(beijingInputToIso('2027-13-40T99:99')).toBeNull()
  })
})

describe('toScheduleDraft', () => {
  it('gives eight empty fields when the season has no schedule', () => {
    const draft = toScheduleDraft(null)
    expect(Object.keys(draft)).toHaveLength(8)
    expect(Object.values(draft).every((value) => value === '')).toBe(true)
  })

  it('converts every node to Beijing wall time', () => {
    const draft = toScheduleDraft(SCHEDULE)
    expect(draft.applyOpen).toBe('2027-02-01T00:00')
    expect(draft.settleDate).toBe('2027-03-12T18:00')
  })
})

describe('toSchedulePayload', () => {
  it('returns null when every field is empty (season without a schedule)', () => {
    expect(toSchedulePayload(toScheduleDraft(null))).toBeNull()
  })

  it('round-trips a full schedule', () => {
    const payload = toSchedulePayload(toScheduleDraft(SCHEDULE))
    expect(payload).toEqual(SCHEDULE)
  })

  it('returns null when only some fields are filled', () => {
    const draft = { ...toScheduleDraft(SCHEDULE), settleDate: '' }
    expect(toSchedulePayload(draft)).toBeNull()
  })

  it('returns null when a filled field is not a valid time', () => {
    const draft = { ...toScheduleDraft(SCHEDULE), startAt: 'not-a-date' }
    expect(toSchedulePayload(draft)).toBeNull()
  })
})

describe('validateScheduleChange', () => {
  // 「现在」固定在 2027-02-10，此时报名已开放、报名截止还没到。
  const NOW = new Date('2027-02-10T00:00:00.000Z')

  it('accepts a schedule that only pushes future deadlines later', () => {
    // applyOpen 已经过去，保持原值；其余节点整体后移一周。
    const later = Object.fromEntries(
      Object.entries(SCHEDULE).map(([key, value]) => [
        key,
        key === 'applyOpen' ? value : new Date(Date.parse(value) + 7 * 86400000).toISOString(),
      ]),
    ) as unknown as SeasonSchedule
    expect(validateScheduleChange(SCHEDULE, later, NOW)).toEqual({})
  })

  it('refuses to move a milestone that is already in the past', () => {
    const moved = { ...SCHEDULE, applyOpen: '2027-02-15T00:00:00.000Z' }
    expect(validateScheduleChange(SCHEDULE, moved, NOW)['schedule.applyOpen']).toMatch(/已经过去/)
  })

  it('refuses to pull a deadline inside the 48 hour lead time', () => {
    // applyClose 原为 2027-02-20，改成「明天」= 缩短到 24 小时内。
    const shortened = { ...SCHEDULE, applyClose: '2027-02-11T00:00:00.000Z' }
    expect(validateScheduleChange(SCHEDULE, shortened, NOW)['schedule.applyClose']).toMatch(/48 小时/)
  })

  it('accepts a shortened deadline that still keeps 48 hours of notice', () => {
    // 提前到 2027-02-14（4 天后）符合 48 小时口径。
    const shortened = { ...SCHEDULE, applyClose: '2027-02-14T00:00:00.000Z' }
    expect(validateScheduleChange(SCHEDULE, shortened, NOW)['schedule.applyClose']).toBeUndefined()
  })

  it('accepts a first-time schedule as long as every node is in the future', () => {
    const shift = (days: number): SeasonSchedule =>
      Object.fromEntries(
        Object.entries(SCHEDULE).map(([key, value]) => [
          key,
          new Date(Date.parse(value) + days * 86400000).toISOString(),
        ]),
      ) as unknown as SeasonSchedule
    expect(validateScheduleChange(null, shift(365), NOW)).toEqual({})
    expect(validateScheduleChange(null, SCHEDULE, NOW)['schedule.applyOpen']).toMatch(/不能早于当前时间/)
  })
})

describe('summarizeReadiness', () => {
  it('counts passed checks and lists the missing ones', () => {
    const summary = summarizeReadiness(
      readiness([
        { key: 'schedule', label: '赛程完整', passed: true },
        { key: 'budget', label: '预算已配置', passed: false, detail: '当前有效预算 0 元' },
        { key: 'verifiers', label: '至少一名核验员', passed: false, detail: '有效授权 0 条' },
      ]),
    )
    expect(summary.passed).toBe(1)
    expect(summary.total).toBe(3)
    expect(summary.ready).toBe(false)
    expect(summary.missing).toEqual([
      { key: 'budget', label: '预算已配置', detail: '当前有效预算 0 元' },
      { key: 'verifiers', label: '至少一名核验员', detail: '有效授权 0 条' },
    ])
  })

  it('reports ready when every check passes', () => {
    const summary = summarizeReadiness(
      readiness([{ key: 'schedule', label: '赛程完整', passed: true }]),
    )
    expect(summary).toMatchObject({ passed: 1, total: 1, ready: true, missing: [] })
  })

  it('degrades to an empty summary when readiness could not be loaded', () => {
    expect(summarizeReadiness(null)).toEqual({ passed: 0, total: 0, ready: false, missing: [] })
  })
})

describe('ruleSummaryRows', () => {
  const rows = ruleSummaryRows({
    rules: { ...SEASON_RULE_DEFAULTS, maxChallengesPerProject: 1, maxCoreMembers: 2 },
    participantCapacity: 40,
    agreementVersion: '',
  })

  it('renders the nine rule summary rows in order', () => {
    expect(rows.map((row) => row.key)).toEqual([
      'maxChallengesPerProject',
      'maxProjectsPerParticipant',
      'maxCoreMembers',
      'participantCapacity',
      'singleWorkCap',
      'exchangeRatio',
      'reviewThreshold',
      'dailyQuotaEnabled',
      'agreementVersion',
    ])
  })

  it('shows the allowed range next to the challenge cap and team size', () => {
    expect(rows[0].value).toBe('1（1—3）')
    expect(rows[2].value).toBe('1—2')
  })

  it('falls back to 不限 / 未定 / 关闭（默认）', () => {
    expect(rows[3].value).toBe('40')
    expect(rows[7].value).toBe('关闭（默认）')
    expect(rows[8].value).toBe('未定')
    expect(
      ruleSummaryRows({
        rules: SEASON_RULE_DEFAULTS,
        participantCapacity: null,
        agreementVersion: 'v2',
      })[3].value,
    ).toBe('不限')
  })

  it('labels the daily quota as enabled when it is on', () => {
    const on = ruleSummaryRows({
      rules: { ...SEASON_RULE_DEFAULTS, dailyQuotaEnabled: true },
      participantCapacity: null,
      agreementVersion: 'v1',
    })
    expect(on[7].value).toBe('开启')
  })

  it('renders null scoring values as 本季不计分 instead of “null”', () => {
    const rows = ruleSummaryRows({
      rules: {
        ...SEASON_RULE_DEFAULTS,
        singleWorkCap: null,
        exchangeRatio: null,
        reviewThreshold: null,
      },
      participantCapacity: null,
      agreementVersion: 'v1',
    })
    expect(rows[4].value).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(rows[5].value).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(rows[6].value).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(rows.map((row) => row.value)).not.toContain('null')
  })

  it('treats 0 as scoreless too — same wording as null', () => {
    const rows = ruleSummaryRows({
      rules: {
        ...SEASON_RULE_DEFAULTS,
        singleWorkCap: 0,
        exchangeRatio: 0,
        reviewThreshold: 0,
      },
      participantCapacity: null,
      agreementVersion: 'v1',
    })
    expect(rows[4].value).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(rows[5].value).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(rows[6].value).toBe(SEASON_RULE_CARD_SCORELESS)
  })

  it('still shows real scoring numbers when configured', () => {
    expect(rows[4].value).toBe('100')
    expect(rows[5].value).toBe('1')
    expect(rows[6].value).toBe('50')
  })
})

describe('readinessCheckTab', () => {
  it('maps all nine backend check keys to a tab', () => {
    const keys = [
      'schedule',
      'challenges',
      'budget',
      'point_pool',
      'scorers',
      'verifiers',
      'rules',
      'organizers',
      'awarding_entity',
    ]
    for (const key of keys) {
      expect(readinessCheckTab(key), `check key ${key}`).not.toBeNull()
    }
  })

  it('sends each check to the screen where it is configured', () => {
    expect(readinessCheckTab('schedule')).toBe('season-settings')
    expect(readinessCheckTab('rules')).toBe('season-settings')
    expect(readinessCheckTab('organizers')).toBe('season-settings')
    expect(readinessCheckTab('awarding_entity')).toBe('season-settings')
    expect(readinessCheckTab('challenges')).toBe('challenges')
    expect(readinessCheckTab('budget')).toBe('budget')
    expect(readinessCheckTab('point_pool')).toBe('scoring')
    expect(readinessCheckTab('scorers')).toBe('scoring')
    expect(readinessCheckTab('verifiers')).toBe('verification')
  })

  it('returns null for an unknown key instead of guessing a destination', () => {
    expect(readinessCheckTab('something_new')).toBeNull()
    expect(readinessCheckTab('')).toBeNull()
  })

  it('every mapped slug is a real organizer tab', () => {
    const keys = ['schedule', 'challenges', 'budget', 'point_pool', 'scorers', 'verifiers', 'rules', 'organizers', 'awarding_entity']
    for (const key of keys) {
      const slug = readinessCheckTab(key)
      expect(slug === null ? null : ORGANIZER_TAB_SLUGS.includes(slug)).toBe(true)
      if (slug) expect(ORGANIZER_TAB_LABELS[slug]).toBeTruthy()
    }
  })

  // 本地维护了一份 slug 列表（避免纯函数模块依赖 `'use client'` 组件），
  // 这里直接对真实路由表断言，防止两边漂移。
  it('stays in sync with the real ORGANIZER_TABS routes', () => {
    expect([...ORGANIZER_TAB_SLUGS]).toEqual(ORGANIZER_TABS.map((tab) => tab.slug))
    for (const tab of ORGANIZER_TABS) {
      expect(ORGANIZER_TAB_LABELS[tab.slug as OrganizerTabSlug]).toBe(tab.label)
    }
  })
})

describe('readinessCheckHref', () => {
  it('builds the tab link with the selected season', () => {
    expect(readinessCheckHref('challenges', 21)).toBe('/organizer/challenges?season=21')
    expect(readinessCheckHref('schedule', 21)).toBe('/organizer/season-settings?season=21')
  })

  it('stays unclickable without a season id', () => {
    expect(readinessCheckHref('schedule', null)).toBeNull()
    expect(readinessCheckHref('schedule', undefined)).toBeNull()
  })

  it('stays unclickable for a check with no destination', () => {
    expect(readinessCheckHref('something_new', 21)).toBeNull()
  })
})

describe('readinessCheckLinkLabel', () => {
  it('describes what the click will let you fix', () => {
    expect(readinessCheckLinkLabel('schedule')).toMatch(/赛程/)
    expect(readinessCheckLinkLabel('verifiers')).toMatch(/核验员/)
    expect(readinessCheckLinkLabel('something_new')).toBeNull()
  })
})

describe('ruleCardStatusLabel', () => {
  it('maps status to the rules card wording', () => {
    expect(ruleCardStatusLabel(SeasonStatus.Draft)).toBe('草稿')
    expect(ruleCardStatusLabel(SeasonStatus.Upcoming)).toBe('已生效')
    expect(ruleCardStatusLabel(SeasonStatus.Active)).toBe('已生效')
    expect(ruleCardStatusLabel(SeasonStatus.Cancelled)).toBe('已取消')
  })
})

describe('editability predicates', () => {
  it('only lets drafts and upcoming seasons edit typed rules', () => {
    expect(canEditSeasonRules(SeasonStatus.Draft)).toBe(true)
    expect(canEditSeasonRules(SeasonStatus.Upcoming)).toBe(true)
    expect(canEditSeasonRules(SeasonStatus.Active)).toBe(false)
    expect(canEditSeasonRules(SeasonStatus.Suspended)).toBe(false)
    expect(canEditSeasonRules(SeasonStatus.Cancelled)).toBe(false)
  })

  it('lets draft / upcoming / active / suspended edit the schedule and rule card', () => {
    for (const status of [
      SeasonStatus.Draft,
      SeasonStatus.Upcoming,
      SeasonStatus.Active,
      SeasonStatus.Suspended,
    ]) {
      expect(canEditSeasonSchedule(status)).toBe(true)
      expect(canEditSeasonRuleCard(status)).toBe(true)
    }
    expect(canEditSeasonSchedule(SeasonStatus.Cancelled)).toBe(false)
    expect(canEditSeasonRuleCard(SeasonStatus.Cancelled)).toBe(false)
  })

  it('only lets drafts edit core fields', () => {
    expect(canEditSeasonCore(SeasonStatus.Draft)).toBe(true)
    expect(canEditSeasonCore(SeasonStatus.Upcoming)).toBe(false)
  })

  it('lets drafts and operators edit organizer orgs, never a cancelled season', () => {
    expect(canEditSeasonOrganizers(SeasonStatus.Draft, false)).toBe(true)
    expect(canEditSeasonOrganizers(SeasonStatus.Upcoming, false)).toBe(false)
    expect(canEditSeasonOrganizers(SeasonStatus.Upcoming, true)).toBe(true)
    expect(canEditSeasonOrganizers(SeasonStatus.Cancelled, true)).toBe(false)
  })
})

describe('status action predicates', () => {
  it('detects pending approval', () => {
    expect(isPendingApproval(SeasonStatus.Upcoming, null)).toBe(true)
    expect(isPendingApproval(SeasonStatus.Upcoming, '2027-01-01T00:00:00.000Z')).toBe(false)
    expect(isPendingApproval(SeasonStatus.Draft, null)).toBe(false)
  })

  it('only lets drafts be submitted', () => {
    expect(canSubmitSeason(SeasonStatus.Draft)).toBe(true)
    expect(canSubmitSeason(SeasonStatus.Upcoming)).toBe(false)
  })

  it('words the submit button by operator role', () => {
    expect(submitActionLabel(true)).toBe('发布（管理员直接生效）')
    expect(submitActionLabel(false)).toBe('提交待批')
  })

  it('only shows approve / reject for operators on a pending season', () => {
    expect(canApproveSeason(SeasonStatus.Upcoming, null, true)).toBe(true)
    expect(canApproveSeason(SeasonStatus.Upcoming, null, false)).toBe(false)
    expect(canApproveSeason(SeasonStatus.Upcoming, '2027-01-01T00:00:00.000Z', true)).toBe(false)
    expect(canApproveSeason(SeasonStatus.Draft, null, true)).toBe(false)
  })

  it('only lets approved upcoming seasons start', () => {
    expect(canStartSeason(SeasonStatus.Upcoming, '2027-01-01T00:00:00.000Z')).toBe(true)
    expect(canStartSeason(SeasonStatus.Upcoming, null)).toBe(false)
    expect(canStartSeason(SeasonStatus.Active, '2027-01-01T00:00:00.000Z')).toBe(false)
  })

  it('suspends upcoming / active and resumes suspended', () => {
    expect(canSuspendSeason(SeasonStatus.Upcoming)).toBe(true)
    expect(canSuspendSeason(SeasonStatus.Active)).toBe(true)
    expect(canSuspendSeason(SeasonStatus.Draft)).toBe(false)
    expect(canResumeSeason(SeasonStatus.Suspended)).toBe(true)
    expect(canResumeSeason(SeasonStatus.Active)).toBe(false)
  })

  it('cancels pre-start seasons but not a suspended season that already started', () => {
    expect(canCancelSeason(SeasonStatus.Draft)).toBe(true)
    expect(canCancelSeason(SeasonStatus.Upcoming)).toBe(true)
    expect(canCancelSeason(SeasonStatus.Suspended, SeasonStatus.Upcoming)).toBe(true)
    expect(canCancelSeason(SeasonStatus.Suspended, SeasonStatus.Active)).toBe(false)
    expect(canCancelSeason(SeasonStatus.Active)).toBe(false)
    expect(canCancelSeason(SeasonStatus.Cancelled)).toBe(false)
  })

  it('only allows announcements once approved and not cancelled', () => {
    expect(canCreateAnnouncement(SeasonStatus.Upcoming, '2027-01-01T00:00:00.000Z')).toBe(true)
    expect(canCreateAnnouncement(SeasonStatus.Draft, null)).toBe(false)
    expect(canCreateAnnouncement(SeasonStatus.Cancelled, '2027-01-01T00:00:00.000Z')).toBe(false)
  })
})
