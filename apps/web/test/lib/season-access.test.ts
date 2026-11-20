import { describe, expect, it } from 'vitest'
import {
  SeasonRole,
  canAccessDemoWorkspace,
  getSeasonRoles,
  hasSeasonRole,
  seasonRoleLabels,
} from '@/lib/season-access'

describe('season access', () => {
  it('maps the seeded demo accounts to their season roles', () => {
    expect(getSeasonRoles('101')).toEqual([
      SeasonRole.Participant,
      SeasonRole.Organizer,
    ])
    expect(getSeasonRoles(102)).toEqual([
      SeasonRole.Participant,
      SeasonRole.Enterprise,
      SeasonRole.Organizer,
    ])
    expect(getSeasonRoles('103')).toEqual([
      SeasonRole.Participant,
      SeasonRole.Organizer,
    ])
    expect(getSeasonRoles('108')).toEqual([SeasonRole.Judge])
    expect(getSeasonRoles('109')).toEqual([SeasonRole.Judge])
  })

  it('returns no roles for unknown or missing users', () => {
    expect(getSeasonRoles('7')).toEqual([])
    expect(getSeasonRoles(null)).toEqual([])
    expect(getSeasonRoles(undefined)).toEqual([])
  })

  it('checks roles independently', () => {
    expect(hasSeasonRole('101', SeasonRole.Participant)).toBe(true)
    expect(hasSeasonRole('101', SeasonRole.Judge)).toBe(false)
    expect(hasSeasonRole('108', SeasonRole.Judge)).toBe(true)
    expect(hasSeasonRole('108', SeasonRole.Enterprise)).toBe(false)
    expect(hasSeasonRole('102', SeasonRole.Enterprise)).toBe(true)
    expect(hasSeasonRole('102', SeasonRole.Participant)).toBe(true)
    expect(hasSeasonRole('102', SeasonRole.Judge)).toBe(false)
  })

  it('returns a fresh array so callers cannot mutate the roster', () => {
    const roles = getSeasonRoles('101')
    roles.push(SeasonRole.Judge)
    expect(getSeasonRoles('101')).not.toContain(SeasonRole.Judge)
  })

  it('labels roles for display', () => {
    expect(seasonRoleLabels([SeasonRole.Participant, SeasonRole.Organizer])).toEqual([
      '赛季选手',
      '主办方',
    ])
  })

  it('limits the single-project demo workspace to its owner', () => {
    expect(canAccessDemoWorkspace('101')).toBe(true)
    expect(canAccessDemoWorkspace(101)).toBe(true)
    // 102/103 也是通过报名的选手，但演示数据只有张一的项目，不能看别人的。
    expect(canAccessDemoWorkspace('102')).toBe(false)
    expect(canAccessDemoWorkspace('103')).toBe(false)
    expect(canAccessDemoWorkspace(null)).toBe(false)
  })
})
