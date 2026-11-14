import { describe, expect, it } from 'vitest'
import { sortCardsByStage } from '@/lib/season-landing'

describe('sortCardsByStage', () => {
  it('puts earlier phases first', () => {
    const cards = [
      { id: 1, group: '进行中' as const },
      { id: 2, group: '即将开始' as const },
      { id: 3, group: '报名中' as const },
    ]

    expect(sortCardsByStage(cards).map((card) => card.id)).toEqual([2, 3, 1])
  })

  it('keeps the original order inside the same phase', () => {
    const cards = [
      { id: 1, group: '进行中' as const },
      { id: 2, group: '进行中' as const },
      { id: 3, group: '即将开始' as const },
    ]

    expect(sortCardsByStage(cards).map((card) => card.id)).toEqual([3, 1, 2])
  })

  it('does not mutate the input', () => {
    const cards = [
      { id: 1, group: '进行中' as const },
      { id: 2, group: '即将开始' as const },
    ]

    sortCardsByStage(cards)
    expect(cards.map((card) => card.id)).toEqual([1, 2])
  })
})
