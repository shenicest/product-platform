import { describe, expect, it } from 'bun:test'
import type { SeasonSchedule } from '@shenicest/shared'
import {
  applySchedulePatch,
  isPastScheduleValue,
  lockedScheduleKeys,
  validateSchedule,
} from '../../../src/modules/boomland-shared/validation'

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

/**
 * 增量修改的口径：只提交改动的节点、已过去的节点锁定、旧节点不参与校验。
 *
 * 「现在」固定在 2027-02-10：报名开放 / 报名截止 / 开赛都已经过去，
 * 组队截止及之后仍在未来。
 */
const NOW = new Date('2027-02-10T00:00:00.000Z')

const CURRENT: SeasonSchedule = {
  applyOpen: '2027-02-01T00:00:00.000Z',
  applyClose: '2027-02-05T00:00:00.000Z',
  startAt: '2027-02-08T00:00:00.000Z',
  teamDeadline: '2027-02-20T00:00:00.000Z',
  challengeFreezeAt: '2027-02-19T00:00:00.000Z',
  workDeadline: '2027-03-01T00:00:00.000Z',
  scoreDeadline: '2027-03-05T00:00:00.000Z',
  settleDate: '2027-03-10T00:00:00.000Z',
}

function patch(patchBody: Partial<SeasonSchedule>, current: SeasonSchedule | null = CURRENT) {
  return applySchedulePatch({ current, patch: patchBody, now: NOW })
}

function errorOf(outcome: ReturnType<typeof patch>) {
  if (!('error' in outcome)) throw new Error('expected an error outcome')
  return outcome.error
}

describe('isPastScheduleValue / lockedScheduleKeys', () => {
  it('treats only strictly earlier values as past', () => {
    expect(isPastScheduleValue('2027-02-09T23:59:59.999Z', NOW)).toBe(true)
    expect(isPastScheduleValue('2027-02-10T00:00:00.000Z', NOW)).toBe(false)
    expect(isPastScheduleValue('2027-02-10T00:00:00.001Z', NOW)).toBe(false)
    expect(isPastScheduleValue(null, NOW)).toBe(false)
    expect(isPastScheduleValue('not-a-date', NOW)).toBe(false)
  })

  it('lists the already-passed milestones in schedule order', () => {
    expect(lockedScheduleKeys(CURRENT, NOW)).toEqual(['applyOpen', 'applyClose', 'startAt'])
    expect(lockedScheduleKeys(null, NOW)).toEqual([])
  })
})

describe('applySchedulePatch', () => {
  it('merges a single changed milestone and reports only that change', () => {
    const outcome = patch({ settleDate: '2027-03-20T00:00:00.000Z' })
    if ('error' in outcome) throw new Error(outcome.error.message)
    expect(outcome.changed).toEqual(['settleDate'])
    expect(outcome.locked).toEqual(['applyOpen', 'applyClose', 'startAt'])
    expect(outcome.schedule.settleDate).toBe('2027-03-20T00:00:00.000Z')
    // 未提交的节点原样保留。
    expect(outcome.schedule.applyOpen).toBe(CURRENT.applyOpen)
    expect(outcome.schedule.scoreDeadline).toBe(CURRENT.scoreDeadline)
  })

  it('refuses to move a milestone that already passed', () => {
    const error = errorOf(patch({ applyClose: '2027-02-06T00:00:00.000Z' }))
    expect(error.code).toBe('SCHEDULE_MILESTONE_LOCKED')
    expect(error.httpStatus).toBe(409)
    expect(error.field).toBe('schedule.applyClose')
    expect(error.message).toContain('报名截止已经过去')
  })

  it('accepts re-sending a passed milestone unchanged (idempotent)', () => {
    const outcome = patch({ applyOpen: CURRENT.applyOpen, scoreDeadline: '2027-03-06T00:00:00.000Z' })
    if ('error' in outcome) throw new Error(outcome.error.message)
    expect(outcome.changed).toEqual(['scoreDeadline'])
  })

  it('reports no change when the submitted values are the stored ones', () => {
    const outcome = patch({ ...CURRENT })
    if ('error' in outcome) throw new Error(outcome.error.message)
    expect(outcome.changed).toEqual([])
    expect(outcome.schedule).toEqual(CURRENT)
  })

  it('does not compare passed milestones when validating order', () => {
    // 历史数据里 teamDeadline 已经过去、challengeFreezeAt 却还在未来：
    // 这个组合违反 challengeFreezeAt <= teamDeadline，但两者都动不了，
    // 不该因为一条改不了的历史约束把后面的修改也拦下来。
    const legacy: SeasonSchedule = {
      ...CURRENT,
      teamDeadline: '2027-02-05T00:00:00.000Z',
      challengeFreezeAt: '2027-02-19T00:00:00.000Z',
    }
    const outcome = patch({ settleDate: '2027-03-20T00:00:00.000Z' }, legacy)
    if ('error' in outcome) throw new Error(outcome.error.message)
    expect(outcome.changed).toEqual(['settleDate'])
  })

  it('refuses to move an editable milestone into the past', () => {
    const error = errorOf(patch({ scoreDeadline: '2027-02-01T00:00:00.000Z' }))
    expect(error.code).toBe('SCHEDULE_INVALID')
    expect(error.field).toBe('schedule.scoreDeadline')
    expect(error.message).toContain('不能早于当前时间')
  })

  it('keeps the strict order among editable milestones', () => {
    // settleDate 不能被挪到评分截止之前。
    const error = errorOf(patch({ settleDate: '2027-03-04T00:00:00.000Z' }))
    expect(error.field).toBe('schedule.settleDate')
    expect(error.message).toBe('结算日 必须晚于评分截止')
  })

  it('keeps workDeadline <= scoreDeadline when both are editable', () => {
    const error = errorOf(patch({ workDeadline: '2027-03-06T00:00:00.000Z' }))
    expect(error.field).toBe('schedule.workDeadline')
    expect(error.message).toBe('作品截止不能晚于评分截止')
  })

  it('rejects an unparsable submitted value', () => {
    const error = errorOf(patch({ startAt: 'not-a-date' }))
    expect(error.code).toBe('SCHEDULE_INVALID')
    expect(error.field).toBe('schedule.startAt')
    expect(error.message).toBe('赛程时间不合法：开赛')
  })

  it('requires all eight milestones when scheduling for the first time', () => {
    const error = errorOf(patch({ applyOpen: '2027-03-01T00:00:00.000Z' }, null))
    expect(error.code).toBe('SCHEDULE_INVALID')
    expect(error.field).toBe('schedule')
    expect(error.message).toContain('赛程尚未填写完整')
  })

  it('accepts a complete first-time schedule', () => {
    const first: SeasonSchedule = {
      applyOpen: '2027-03-01T00:00:00.000Z',
      applyClose: '2027-03-02T00:00:00.000Z',
      startAt: '2027-03-03T00:00:00.000Z',
      teamDeadline: '2027-03-10T00:00:00.000Z',
      challengeFreezeAt: '2027-03-09T00:00:00.000Z',
      workDeadline: '2027-03-20T00:00:00.000Z',
      scoreDeadline: '2027-03-30T00:00:00.000Z',
      settleDate: '2027-04-10T00:00:00.000Z',
    }
    const outcome = patch(first, null)
    if ('error' in outcome) throw new Error(outcome.error.message)
    expect(outcome.changed).toHaveLength(8)
    expect(outcome.schedule).toEqual(first)
  })

  it('rejects a first-time schedule that starts in the past', () => {
    const error = errorOf(patch({ ...CURRENT }, null))
    expect(error.message).toContain('不能早于当前时间')
  })
})
