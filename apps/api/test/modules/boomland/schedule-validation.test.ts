import { describe, expect, it } from 'bun:test'
import { validateSchedule } from '../../../src/modules/boomland-shared/validation'

function schedule(overrides: Record<string, string> = {}) {
  return {
    applyOpen: '2030-01-01T00:00:00.000Z',
    applyClose: '2030-01-02T00:00:00.000Z',
    startAt: '2030-01-03T00:00:00.000Z',
    teamDeadline: '2030-01-10T00:00:00.000Z',
    challengeFreezeAt: '2030-01-09T00:00:00.000Z',
    workDeadline: '2030-01-20T00:00:00.000Z',
    scoreDeadline: '2030-01-30T00:00:00.000Z',
    settleDate: '2030-02-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('BoomLand season schedule validation', () => {
  it('accepts the documented ordering', () => {
    expect(validateSchedule(schedule())).toBeNull()
  })

  it('requires applyClose before startAt', () => {
    expect(validateSchedule(schedule({ startAt: '2030-01-02T00:00:00.000Z' }))).toContain(
      'applyClose 必须早于 startAt',
    )
  })

  it('requires workDeadline not to be after scoreDeadline', () => {
    expect(validateSchedule(schedule({ workDeadline: '2030-02-01T00:00:00.000Z' }))).toBe(
      '作品截止不能晚于评分截止',
    )
  })

  it('requires challengeFreezeAt not to be after teamDeadline', () => {
    expect(validateSchedule(schedule({ challengeFreezeAt: '2030-01-11T00:00:00.000Z' }))).toBe(
      '命题冻结不能晚于组队截止',
    )
  })

  it('allows workDeadline and scoreDeadline to coincide', () => {
    expect(
      validateSchedule(
        schedule({
          workDeadline: '2030-01-30T00:00:00.000Z',
          challengeFreezeAt: '2030-01-10T00:00:00.000Z',
        }),
      ),
    ).toBeNull()
  })

  it('requires all schedule fields', () => {
    expect(validateSchedule(schedule({ challengeFreezeAt: '' }))).toBe(
      '赛程时间不合法：challengeFreezeAt',
    )
  })
})
