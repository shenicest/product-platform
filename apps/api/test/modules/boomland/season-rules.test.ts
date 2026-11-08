import { describe, expect, it } from 'bun:test'
import {
  SEASON_RULE_CARD_SCORELESS,
  SEASON_RULE_DEFAULTS,
  SEASON_REQUIRED_RULE_CARD_KEYS,
  seasonRequiredRuleCardItems,
  type SeasonRules,
  type SeasonSchedule,
} from '@shenicest/shared'
import {
  isScorelessSeasonRules,
  normalizeRules,
  validateRules,
} from '../../../src/modules/boomland-shared/validation'

function rules(overrides: Partial<SeasonRules> = {}): SeasonRules {
  return { ...SEASON_RULE_DEFAULTS, ...overrides }
}

const schedule: SeasonSchedule = {
  applyOpen: '2027-01-01T00:00:00.000Z',
  applyClose: '2027-01-02T00:00:00.000Z',
  startAt: '2027-01-03T00:00:00.000Z',
  teamDeadline: '2027-01-10T00:00:00.000Z',
  challengeFreezeAt: '2027-01-09T00:00:00.000Z',
  workDeadline: '2027-03-08T15:59:00.000Z',
  scoreDeadline: '2027-03-09T15:59:00.000Z',
  settleDate: '2027-03-20T00:00:00.000Z',
}

describe('BoomLand season rules · scoreless trio', () => {
  it('accepts null for the three scoring fields', () => {
    expect(validateRules(rules({ singleWorkCap: null, exchangeRatio: null, reviewThreshold: null })))
      .toEqual([])
  })

  it('accepts 0 as "no scoring this season"', () => {
    expect(validateRules(rules({ singleWorkCap: 0, exchangeRatio: 0, reviewThreshold: 0 })))
      .toEqual([])
  })

  it('still rejects negative or out-of-range values', () => {
    const errors = validateRules(rules({ singleWorkCap: -1, exchangeRatio: 1_000_001, reviewThreshold: -5 }))
    expect(errors.length).toBe(3)
  })

  it('requires singleWorkCap to stay an integer when provided', () => {
    expect(validateRules(rules({ singleWorkCap: 12.5 }))).toContain(
      '单次评分上限必须为整数或留空',
    )
  })

  it('detects a fully scoreless season', () => {
    expect(isScorelessSeasonRules(rules({ singleWorkCap: null, exchangeRatio: null, reviewThreshold: null })))
      .toBe(true)
    expect(isScorelessSeasonRules(rules({ singleWorkCap: 0, exchangeRatio: 0, reviewThreshold: 0 })))
      .toBe(true)
    // 只要一项有值就算本季计分
    expect(isScorelessSeasonRules(rules({ singleWorkCap: 100, exchangeRatio: null, reviewThreshold: null })))
      .toBe(false)
  })

  it('keeps an explicit null through normalizeRules instead of falling back to defaults', () => {
    expect(normalizeRules({ singleWorkCap: null, exchangeRatio: null, reviewThreshold: null }))
      .toMatchObject({ singleWorkCap: null, exchangeRatio: null, reviewThreshold: null })
  })

  it('falls back to defaults only when a field is absent', () => {
    expect(normalizeRules({})).toMatchObject({
      singleWorkCap: SEASON_RULE_DEFAULTS.singleWorkCap,
      exchangeRatio: SEASON_RULE_DEFAULTS.exchangeRatio,
      reviewThreshold: SEASON_RULE_DEFAULTS.reviewThreshold,
    })
    expect(normalizeRules({ singleWorkCap: 0 })).toMatchObject({ singleWorkCap: 0 })
  })
})

describe('BoomLand required rule card items', () => {
  it('generates one item per required key, in the documented order', () => {
    const items = seasonRequiredRuleCardItems({ rules: rules(), schedule })
    expect(items.map((item) => item.key)).toEqual([...SEASON_REQUIRED_RULE_CARD_KEYS])
    expect(items.every((item) => item.required && item.visible)).toBe(true)
  })

  it('renders the scoreless trio as "本季不计分"', () => {
    const items = seasonRequiredRuleCardItems({
      rules: rules({ singleWorkCap: null, exchangeRatio: 0, reviewThreshold: null }),
      schedule,
    })
    const byKey = new Map(items.map((item) => [item.key, item.value]))
    expect(byKey.get('single_work_cap')).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(byKey.get('exchange_ratio')).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(byKey.get('review_threshold')).toBe(SEASON_RULE_CARD_SCORELESS)
    expect(byKey.get('point_pool_and_awards')).toBe('本季不设积分池与评委')
  })

  it('merges work and score deadlines into a single Beijing-time item', () => {
    const items = seasonRequiredRuleCardItems({ rules: rules(), schedule })
    const deadline = items.find((item) => item.key === 'work_and_score_deadline')
    expect(deadline?.value).toBe('作品 2027年3月8日 23:59 截止；评分 2027年3月9日 23:59 截止（北京时间）')
  })

  it('falls back to 待定 when the season has no schedule yet', () => {
    const items = seasonRequiredRuleCardItems({ rules: rules(), schedule: null })
    const deadline = items.find((item) => item.key === 'work_and_score_deadline')
    expect(deadline?.value).toBe('作品 待定 截止；评分 待定 截止（北京时间）')
  })

  it('no longer exposes the merged-away keys', () => {
    const keys = seasonRequiredRuleCardItems({ rules: rules(), schedule }).map((item) => item.key)
    expect(keys).not.toContain('work_deadline')
    expect(keys).not.toContain('score_deadline')
    expect(keys).not.toContain('submission_requirements')
    expect(keys).not.toContain('review_process')
    expect(keys).not.toContain('milestone_rewards')
    expect(keys).not.toContain('scoring_rewards')
    expect(keys).toHaveLength(8)
  })
})
