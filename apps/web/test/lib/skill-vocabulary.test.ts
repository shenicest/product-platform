import { describe, expect, it } from 'vitest'
import { TALENT_SKILL_GROUPS, TALENT_SKILL_LABELS, TALENT_SKILLS } from '@shenicest/shared'

describe('talent skill vocabulary', () => {
  it('keeps the label catalog, flat key list, and groups consistent', () => {
    expect(TALENT_SKILLS).toEqual(Object.keys(TALENT_SKILL_LABELS))
    const flat = TALENT_SKILL_GROUPS.flatMap((group) => [...group.skills])
    expect(new Set(flat).size).toBe(flat.length)
    expect([...flat].sort()).toEqual([...TALENT_SKILLS].sort())
  })

  it('follows the vocabulary contract: group directions, robotics right after AI in 开发', () => {
    expect(TALENT_SKILL_GROUPS.map((group) => group.direction)).toEqual([
      '产品', '设计', '增长', '运营', '开发', '数据', '商务/职能',
    ])
    expect(TALENT_SKILL_LABELS.robotics).toBe('机器人')
    expect(TALENT_SKILL_GROUPS.find((group) => group.direction === '开发')?.skills).toEqual([
      'frontend', 'backend', 'fullstack', 'mobile', 'ai', 'robotics', 'data', 'hardware',
    ])
  })
})
