import { describe, expect, it } from 'vitest'
import {
  MAX_SEASON_THEMES,
  MAX_SEASON_THEME_LENGTH,
  appendThemeItem,
  removeThemeItem,
  reorderThemeItems,
  themeDraftEqual,
  toThemeDraft,
  toThemesPayload,
  updateThemeItem,
  validateThemeDraft,
  type ThemeDraftItem,
} from '@/lib/organizer-themes'

/** 三条主题的合法草稿。 */
function draft(): ThemeDraftItem[] {
  return toThemeDraft(['新型储能基建', '全球 AI 基建', '新生产关系的人本基建'])
}

function item(theme: string): ThemeDraftItem {
  return { key: theme, theme }
}

describe('赛季主题上限常量', () => {
  it('与后端 normalizeThemes / UpdateSeasonThemesBody 的约束一致', () => {
    // 这三个数字在后端是字面量（apps/api/src/modules/boomland-shared/validation.ts
    // 与 apps/api/src/modules/season/model.ts），前端不能 import 后端模块，
    // 所以在这里钉住：任何一侧改动都必须三处同步。
    expect(MAX_SEASON_THEMES).toBe(20)
    expect(MAX_SEASON_THEME_LENGTH).toBe(50)
  })
})

describe('toThemeDraft', () => {
  it('keeps the server order and derives the key from the theme text', () => {
    const items = toThemeDraft(['储能', 'AI', '机器人'])
    expect(items).toEqual([
      { key: '储能', theme: '储能' },
      { key: 'AI', theme: 'AI' },
      { key: '机器人', theme: '机器人' },
    ])
  })

  it('returns an empty draft for an empty list', () => {
    expect(toThemeDraft([])).toEqual([])
  })

  it('keeps keys unique even when the server hands back duplicated themes', () => {
    const items = toThemeDraft(['储能', '储能', 'AI'])
    expect(new Set(items.map((entry) => entry.key)).size).toBe(3)
    expect(items.map((entry) => entry.theme)).toEqual(['储能', '储能', 'AI'])
  })
})

describe('toThemesPayload', () => {
  it('trims every theme and drops empty rows', () => {
    expect(toThemesPayload([item(' 储能 '), item('   '), item('AI')])).toEqual(['储能', 'AI'])
  })

  it('does not de-duplicate (duplicates are a validation error, not a silent fix)', () => {
    expect(toThemesPayload([item('储能'), item('储能')])).toEqual(['储能', '储能'])
  })

  it('preserves the draft order', () => {
    expect(toThemesPayload(draft())).toEqual(['新型储能基建', '全球 AI 基建', '新生产关系的人本基建'])
  })
})

describe('validateThemeDraft', () => {
  it('accepts a normal draft', () => {
    expect(validateThemeDraft(draft())).toEqual({})
  })

  it('accepts an empty draft (a season may have no themes at all)', () => {
    expect(validateThemeDraft([])).toEqual({})
  })

  it('reports an empty theme', () => {
    expect(validateThemeDraft([item(''), item('AI')])['items.0.theme']).toBe('请填写主题名称')
    expect(validateThemeDraft([item('   ')])['items.0.theme']).toBeTruthy()
  })

  it('reports an over-long theme', () => {
    const long = 'A'.repeat(MAX_SEASON_THEME_LENGTH + 1)
    expect(validateThemeDraft([item(long)])['items.0.theme']).toMatch(
      String(MAX_SEASON_THEME_LENGTH),
    )
    // 恰好等于上限是合法的。
    expect(validateThemeDraft([item('A'.repeat(MAX_SEASON_THEME_LENGTH))])).toEqual({})
  })

  it('reports a duplicated theme on the later row only', () => {
    const errors = validateThemeDraft([item('储能'), item('储能')])
    expect(errors['items.0.theme']).toBeUndefined()
    expect(errors['items.1.theme']).toMatch(/重复/)
  })

  it('compares duplicates after trimming', () => {
    const errors = validateThemeDraft([item('储能'), item(' 储能 ')])
    expect(errors['items.1.theme']).toMatch(/重复/)
  })

  it('rejects more than the cap', () => {
    const tooMany = Array.from({ length: MAX_SEASON_THEMES + 1 }, (_, index) => item(`主题${index}`))
    expect(validateThemeDraft(tooMany).items).toMatch(String(MAX_SEASON_THEMES))
    // 恰好等于上限是合法的。
    expect(validateThemeDraft(tooMany.slice(0, MAX_SEASON_THEMES))).toEqual({})
  })
})

describe('reorderThemeItems', () => {
  const items = [item('a'), item('b'), item('c')]
  const themes = (list: ThemeDraftItem[]) => list.map((entry) => entry.theme)

  it('moves an item down to a later slot without mutating the input', () => {
    expect(themes(reorderThemeItems(items, 0, 2))).toEqual(['b', 'a', 'c'])
    expect(themes(reorderThemeItems(items, 0, 3))).toEqual(['b', 'c', 'a'])
    expect(themes(items)).toEqual(['a', 'b', 'c'])
  })

  it('moves an item up to an earlier slot', () => {
    expect(themes(reorderThemeItems(items, 2, 0))).toEqual(['c', 'a', 'b'])
    expect(themes(reorderThemeItems(items, 1, 0))).toEqual(['b', 'a', 'c'])
  })

  it('returns the input unchanged when the drop is a no-op', () => {
    expect(reorderThemeItems(items, 1, 1)).toBe(items)
    expect(reorderThemeItems(items, 1, 2)).toBe(items)
  })

  it('ignores out-of-range indexes', () => {
    expect(reorderThemeItems(items, 99, 0)).toBe(items)
    expect(reorderThemeItems(items, -1, 0)).toBe(items)
    expect(reorderThemeItems(items, 0, 99)).toBe(items)
    expect(reorderThemeItems(items, 0, -1)).toBe(items)
  })

  it('keeps the keys attached to their themes', () => {
    const next = reorderThemeItems(draft(), 0, 3)
    expect(next.map((entry) => entry.key)).toEqual([
      '全球 AI 基建',
      '新生产关系的人本基建',
      '新型储能基建',
    ])
  })
})

describe('appendThemeItem', () => {
  it('appends a trimmed theme and derives its key', () => {
    const next = appendThemeItem(draft(), '  机器人 ')
    expect(next).toHaveLength(4)
    expect(next.at(-1)).toEqual({ key: '机器人', theme: '机器人' })
  })

  it('keeps the existing rows untouched', () => {
    const before = draft()
    const next = appendThemeItem(before, '机器人')
    expect(next.slice(0, before.length)).toEqual(before)
  })

  it('still yields unique keys when the theme already exists', () => {
    const next = appendThemeItem(draft(), '全球 AI 基建')
    expect(new Set(next.map((entry) => entry.key)).size).toBe(next.length)
  })
})

describe('updateThemeItem', () => {
  it('rewrites one theme and re-derives its key', () => {
    const next = updateThemeItem(draft(), 1, '  全球 AI 基建（改） ')
    expect(next[1]).toEqual({ key: '全球 AI 基建（改）', theme: '全球 AI 基建（改）' })
    expect(next[0]).toEqual(draft()[0])
  })

  it('ignores an out-of-range index', () => {
    const before = draft()
    expect(updateThemeItem(before, 99, 'x')).toBe(before)
    expect(updateThemeItem(before, -1, 'x')).toBe(before)
  })

  it('keeps keys unique when renaming onto an existing theme', () => {
    const next = updateThemeItem(draft(), 1, '新型储能基建')
    expect(new Set(next.map((entry) => entry.key)).size).toBe(next.length)
  })
})

describe('removeThemeItem', () => {
  it('removes the row at the index', () => {
    expect(removeThemeItem(draft(), 1).map((entry) => entry.theme)).toEqual([
      '新型储能基建',
      '新生产关系的人本基建',
    ])
  })

  it('ignores an out-of-range index', () => {
    const before = draft()
    expect(removeThemeItem(before, 99)).toBe(before)
    expect(removeThemeItem(before, -1)).toBe(before)
  })
})

describe('themeDraftEqual', () => {
  it('compares order and every theme', () => {
    const a = [item('a'), item('b')]
    expect(themeDraftEqual(a, [item('a'), item('b')])).toBe(true)
    expect(themeDraftEqual(a, [item('b'), item('a')])).toBe(false)
    expect(themeDraftEqual(a, a.slice(0, 1))).toBe(false)
    expect(themeDraftEqual(a, [a[0], item('改过')])).toBe(false)
  })

  it('ignores key differences for the same theme text', () => {
    // key 是派生值：同一条主题换了后缀不该被当成「有未保存的改动」。
    expect(themeDraftEqual([{ key: '储能', theme: '储能' }], [{ key: '储能\u00002', theme: '储能' }])).toBe(
      true,
    )
  })

  it('treats two empty drafts as equal', () => {
    expect(themeDraftEqual([], [])).toBe(true)
  })
})
