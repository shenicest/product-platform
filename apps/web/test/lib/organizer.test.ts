import { describe, expect, it } from 'vitest'
import { SEASON_RULE_DEFAULTS } from '@shenicest/shared'
import {
  ALL_SEASONS_VALUE,
  draftFromPreviousSeason,
  emptySeasonDraft,
  nextSeasonName,
  parseSeasonId,
  seasonPickerStatusLabel,
  suggestSeasonCode,
  toCreateSeasonPayload,
  toSeasonPickerOptions,
  validateScheduleDraft,
  validateSeasonDraft,
  type SeasonDraftValues,
  type SeasonManageDetail,
  type SeasonScheduleDraft,
} from '@/lib/organizer'

const SCHEDULE: SeasonScheduleDraft = {
  applyOpen: '2027-01-01T00:00',
  applyClose: '2027-01-10T00:00',
  startAt: '2027-01-15T00:00',
  teamDeadline: '2027-01-20T00:00',
  challengeFreezeAt: '2027-01-19T00:00',
  workDeadline: '2027-02-10T00:00',
  scoreDeadline: '2027-02-20T00:00',
  settleDate: '2027-02-28T00:00',
}

function values(overrides: Partial<SeasonDraftValues> = {}): SeasonDraftValues {
  return { ...emptySeasonDraft({ organizerOrgOptions: [3] }), code: 'BL2027A', name: '2027 春季赛季', ...overrides }
}

describe('validateSeasonDraft', () => {
  const options = { organizerOrgOptions: [3] }

  it('accepts a minimal draft without a schedule', () => {
    expect(validateSeasonDraft(values(), options)).toEqual({})
  })

  it('requires a well-formed code, name and organizer org', () => {
    const errors = validateSeasonDraft(
      values({ code: 'bad code!', name: 'A', organizerOrgIds: [] }),
      options,
    )
    expect(errors.code).toBeTruthy()
    expect(errors.name).toMatch(/至少 2 个字符/)
    expect(errors.organizerOrgIds).toMatch(/至少选择一个/)
  })

  it('rejects codes longer than 32 characters', () => {
    expect(validateSeasonDraft(values({ code: 'A'.repeat(33) }), options).code).toMatch(/32/)
  })

  it('requires a city for hackathons', () => {
    expect(validateSeasonDraft(values({ type: 'hackathon', city: '' }), options).city).toBeTruthy()
    expect(validateSeasonDraft(values({ type: 'hackathon', city: '上海' }), options).city).toBeUndefined()
  })

  it('rejects organizer orgs outside the allowed set', () => {
    expect(validateSeasonDraft(values({ organizerOrgIds: [99] }), options).organizerOrgIds).toMatch(/自己所属/)
  })

  it('validates participant capacity', () => {
    expect(validateSeasonDraft(values({ participantCapacity: 'abc' }), options).participantCapacity).toBeTruthy()
    expect(validateSeasonDraft(values({ participantCapacity: '0' }), options).participantCapacity).toBeTruthy()
    expect(validateSeasonDraft(values({ participantCapacity: '100001' }), options).participantCapacity).toBeTruthy()
    expect(validateSeasonDraft(values({ participantCapacity: '120' }), options).participantCapacity).toBeUndefined()
    expect(validateSeasonDraft(values({ participantCapacity: '' }), options).participantCapacity).toBeUndefined()
  })

  it('accepts a complete, strictly increasing schedule', () => {
    expect(validateSeasonDraft(values({ schedule: SCHEDULE }), options)).toEqual({})
  })

  it('rejects a partially filled schedule and points at the empty field', () => {
    const errors = validateSeasonDraft(
      values({ schedule: { ...SCHEDULE, startAt: '' } }),
      options,
    )
    expect(errors['schedule.startAt']).toBeTruthy()
    // 已填写的节点不该被标红。
    expect(errors['schedule.applyClose']).toBeUndefined()
  })

  it('rejects out-of-order milestones', () => {
    const errors = validateScheduleDraft({ ...SCHEDULE, applyClose: '2026-12-01T00:00' })
    expect(errors['schedule.applyClose']).toMatch(/必须晚于/)
  })

  it('rejects work deadline after score deadline and freeze after team deadline', () => {
    expect(validateScheduleDraft({ ...SCHEDULE, workDeadline: '2027-02-25T00:00' })['schedule.workDeadline'])
      .toMatch(/不能晚于评分截止/)
    expect(validateScheduleDraft({ ...SCHEDULE, challengeFreezeAt: '2027-01-25T00:00' })['schedule.challengeFreezeAt'])
      .toMatch(/不能晚于组队截止/)
  })

  it('validates rule ranges', () => {
    const errors = validateSeasonDraft(
      values({ rules: { ...SEASON_RULE_DEFAULTS, maxChallengesPerProject: 9, exchangeRatio: -1 } }),
      options,
    )
    expect(errors['rules.maxChallengesPerProject']).toBeTruthy()
    expect(errors['rules.exchangeRatio']).toBeTruthy()
  })

  it('accepts null / 0 scoring rules as "本季不计分"', () => {
    const errors = validateSeasonDraft(
      values({
        rules: {
          ...SEASON_RULE_DEFAULTS,
          singleWorkCap: null,
          exchangeRatio: 0,
          reviewThreshold: null,
        },
      }),
      options,
    )
    expect(errors['rules.singleWorkCap']).toBeUndefined()
    expect(errors['rules.exchangeRatio']).toBeUndefined()
    expect(errors['rules.reviewThreshold']).toBeUndefined()
  })
})

describe('toCreateSeasonPayload', () => {
  it('maps the form values to the API body', () => {
    const payload = toCreateSeasonPayload(values({
      schedule: SCHEDULE,
      city: ' 杭州 ',
      intro: '',
      participantCapacity: '',
      awardingEntity: ' SheNicest ',
      themes: ['储能'],
    }))
    expect(payload).toMatchObject({
      code: 'BL2027A',
      name: '2027 春季赛季',
      type: 'season',
      city: '杭州',
      intro: null,
      themes: ['储能'],
      awardingEntity: 'SheNicest',
      participantCapacity: null,
      organizerOrgIds: [3],
      agreementVersion: 'v1',
    })
    expect(payload.schedule).not.toBeNull()
    expect(new Date(payload.schedule!.startAt).toISOString()).toBe(payload.schedule!.startAt)
  })

  it('sends a null schedule when every milestone is empty', () => {
    expect(toCreateSeasonPayload(values()).schedule).toBeNull()
  })

  it('converts the capacity to a number', () => {
    expect(toCreateSeasonPayload(values({ participantCapacity: '80' })).participantCapacity).toBe(80)
  })
})

describe('draftFromPreviousSeason', () => {
  const previous = {
    id: 12,
    code: 'BL2026A',
    name: '2026 春季赛季',
    type: 'hackathon',
    city: '上海',
    intro: '旧介绍',
    themes: ['储能', 'AI'],
    status: 'active',
    approvedAt: '2026-01-01T00:00:00.000Z',
    pinned: true,
    agreementVersion: 'v2',
    awardingEntity: '主办方基金会',
    participantCapacity: 60,
    organizerOrgIds: [5, 6],
    rules: { ...SEASON_RULE_DEFAULTS, maxCoreMembers: 2 },
    schedule: {
      applyOpen: '2026-01-01T00:00:00.000Z',
      applyClose: '2026-01-10T00:00:00.000Z',
      startAt: '2026-01-15T00:00:00.000Z',
      teamDeadline: '2026-01-20T00:00:00.000Z',
      challengeFreezeAt: '2026-01-19T00:00:00.000Z',
      workDeadline: '2026-02-10T00:00:00.000Z',
      scoreDeadline: '2026-02-20T00:00:00.000Z',
      settleDate: '2026-02-28T00:00:00.000Z',
    },
  } as unknown as SeasonManageDetail

  it('copies content fields but never the status or the taken code', () => {
    const draft = draftFromPreviousSeason(previous)
    expect(draft.code).toBe('')
    expect(draft.name).toBe('2027 春季赛季')
    expect(draft.type).toBe('hackathon')
    expect(draft.city).toBe('上海')
    expect(draft.intro).toBe('旧介绍')
    expect(draft.themes).toEqual(['储能', 'AI'])
    expect(draft.rules.maxCoreMembers).toBe(2)
    expect(draft.organizerOrgIds).toEqual([5, 6])
    expect(draft.participantCapacity).toBe('60')
    // 赛程必须重填：上季的时间线已经过期。
    expect(Object.values(draft.schedule).every((item) => item === '')).toBe(true)
    // 发布状态类字段不参与复制。
    expect(draft).not.toHaveProperty('status')
    expect(draft).not.toHaveProperty('approvedAt')
    expect(draft).not.toHaveProperty('pinned')
  })
})

describe('nextSeasonName', () => {
  it('advances the year when the name has one', () => {
    expect(nextSeasonName('2026 春季赛季')).toBe('2027 春季赛季')
  })

  it('appends a marker when there is no year', () => {
    expect(nextSeasonName('春季赛季')).toBe('春季赛季（新）')
  })
})

describe('suggestSeasonCode', () => {
  it('increments the trailing suffix', () => {
    expect(suggestSeasonCode('BL2026A')).toBe('BL2026B')
  })

  it('skips codes that already exist', () => {
    expect(suggestSeasonCode('BL2026A', ['BL2026B', 'BL2026C'])).toBe('BL2026D')
  })

  it('never returns a taken or over-long code', () => {
    const taken = 'BL2026'.split('').map((_, index) => `BL2026${String.fromCharCode(65 + index)}`)
    const code = suggestSeasonCode('BL2026A', taken)
    expect(taken).not.toContain(code)
    expect(code.length).toBeLessThanOrEqual(32)
  })
})

describe('season picker helpers', () => {
  it('returns no options when the database has no season (picker disabled)', () => {
    expect(toSeasonPickerOptions([])).toEqual([])
  })

  it('puts an “all seasons” entry first and keeps the given order', () => {
    const options = toSeasonPickerOptions([
      { id: 2, name: '春季', code: 'S2' },
      { id: 1, name: '冬季', code: 'S1' },
    ])
    expect(options[0]).toEqual({ value: ALL_SEASONS_VALUE, label: '全部赛季' })
    expect(options.slice(1)).toEqual([
      { value: '2', label: '春季 · S2' },
      { value: '1', label: '冬季 · S1' },
    ])
  })

  it('annotates each season with its status when the field is provided', () => {
    const options = toSeasonPickerOptions([
      { id: 3, name: '草稿季', code: 'D1', status: 'draft', approvedAt: null },
      { id: 4, name: '进行季', code: 'A1', status: 'active', approvedAt: '2026-01-01T00:00:00.000Z' },
      { id: 5, name: '待批季', code: 'P1', status: 'upcoming', approvedAt: null },
      { id: 6, name: '暂停季', code: 'S1', status: 'suspended', approvedAt: '2026-01-01T00:00:00.000Z' },
      { id: 7, name: '取消季', code: 'C1', status: 'cancelled', approvedAt: null },
    ])
    expect(options.slice(1).map((option) => option.label)).toEqual([
      '草稿季 · D1 · 草稿',
      '进行季 · A1 · 进行中',
      '待批季 · P1 · 待批准',
      '暂停季 · S1 · 已暂停',
      '取消季 · C1 · 已取消',
    ])
  })

  it('labels the PRD-only end states as well, so the picker needs no change later', () => {
    const options = toSeasonPickerOptions([
      { id: 8, name: '归档季', code: 'R1', status: 'archived', approvedAt: '2026-01-01T00:00:00.000Z' },
      { id: 9, name: '结束季', code: 'E1', status: 'ended', approvedAt: '2026-01-01T00:00:00.000Z' },
    ])
    expect(options.slice(1).map((option) => option.label)).toEqual([
      '归档季 · R1 · 已归档',
      '结束季 · E1 · 已结束',
    ])
  })

  it('treats pending approval as upcoming + no approvedAt, never as its own status', () => {
    expect(seasonPickerStatusLabel({ status: 'upcoming', approvedAt: null })).toBe('待批准')
    expect(seasonPickerStatusLabel({ status: 'upcoming', approvedAt: '2026-01-01T00:00:00.000Z' }))
      .toBe('即将开始')
    // PRD 预留状态先有文案；真正未知的状态原样回显，不猜。
    expect(seasonPickerStatusLabel({ status: 'archived', approvedAt: null })).toBe('已归档')
    expect(seasonPickerStatusLabel({ status: 'mystery', approvedAt: null })).toBe('mystery')
  })

  it('parses a season id from the query string', () => {
    expect(parseSeasonId('42')).toBe(42)
    expect(parseSeasonId('all')).toBeNull()
    expect(parseSeasonId('-1')).toBeNull()
    expect(parseSeasonId(null)).toBeNull()
  })
})
