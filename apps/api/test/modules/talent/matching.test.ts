import { describe, expect, test } from 'bun:test'
import { calculateTalentMatch } from '../../../src/modules/talent/matching'

describe('talent matching', () => {
  test('applies the four weighted dimensions and returns readable reasons', () => {
    const result = calculateTalentMatch(
      { skills: ['frontend', 'productStrategy'], seekingSkills: ['backend'], domains: ['效率工具'], durations: ['长期合作'] },
      { skills: ['backend', 'productStrategy'], seekingSkills: [], domains: ['效率工具'], durations: ['长期合作'] },
    )
    expect(result.score).toBe(88)
    expect(result.reasons).toContain('TA 擅长你正在寻找的 后端')
  })

  test('hides a zero score instead of returning numeric zero', () => {
    expect(calculateTalentMatch({ skills: [], seekingSkills: [], domains: [], durations: [] }, { skills: [], seekingSkills: [], domains: [], durations: [] })).toEqual({ score: null, reason: '暂无明显匹配', reasons: [] })
  })
})
