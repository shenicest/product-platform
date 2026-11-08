import { describe, expect, it } from 'vitest'
import {
  SEASON_REQUIRED_RULE_CARD_KEYS,
  SEASON_REQUIRED_RULE_CARD_LABELS,
  SEASON_RULE_DEFAULTS,
} from '@shenicest/shared'
import type { RuleCardItem } from '@/lib/boomland'
import {
  MAX_RULE_CARD_ITEMS,
  appendRuleCardItem,
  newRuleCardItem,
  reorderRuleCardItems,
  requiredRuleCardLabel,
  ruleCardDraftEqual,
  toRuleCardDraft,
  toRuleCardPayload,
  updateRuleCardItem,
  validateRuleCardDraft,
  validateRulesForm,
  type RuleCardDraftItem,
} from '@/lib/organizer-rules'

function row(overrides: Partial<RuleCardItem> & { key: string }): RuleCardItem {
  return {
    id: 1,
    label: overrides.key,
    value: `${overrides.key} 的内容`,
    required: false,
    visible: true,
    sortOrder: 0,
    ...overrides,
  }
}

/** 一份包含全部必要项的合法草稿（顺序与共享常量一致）。 */
function validDraft(): RuleCardDraftItem[] {
  return SEASON_REQUIRED_RULE_CARD_KEYS.map((key, index) => ({
    key,
    label: `必要条目 ${index + 1}`,
    value: `内容 ${index + 1}`,
    required: true,
    visible: true,
  }))
}

function optional(overrides: Partial<RuleCardDraftItem> = {}): RuleCardDraftItem {
  return {
    key: 'custom_1',
    label: '自定义条目',
    value: '自定义内容',
    required: false,
    visible: true,
    ...overrides,
  }
}

describe('toRuleCardDraft', () => {
  it('sorts by sortOrder and drops id / sortOrder', () => {
    const draft = toRuleCardDraft([
      row({ id: 3, key: 'third', sortOrder: 2 }),
      row({ id: 1, key: 'first', sortOrder: 0 }),
      row({ id: 2, key: 'second', sortOrder: 1 }),
    ])
    expect(draft.map((item) => item.key)).toEqual(['first', 'second', 'third'])
    expect(draft[0]).toEqual({
      key: 'first',
      label: 'first',
      value: 'first 的内容',
      required: false,
      visible: true,
    })
  })

  it('marks keys from the shared required list as required regardless of the row flag', () => {
    const draft = toRuleCardDraft([
      row({ key: 'max_core_members', required: false }),
      row({ key: 'custom_1', required: true, sortOrder: 1 }),
    ])
    expect(draft[0].required).toBe(true)
    // 可选 key 上的过期标记不采信：后端也只按 key 判定，否则这一条会被永久锁死。
    expect(draft[1].required).toBe(false)
  })

  it('keeps an explicitly hidden row hidden', () => {
    const draft = toRuleCardDraft([row({ key: 'custom_1', visible: false })])
    expect(draft[0].visible).toBe(false)
  })
})

describe('toRuleCardPayload', () => {
  it('round-trips a draft through draft → payload → draft', () => {
    const draft = validDraft().concat(optional())
    const payload = toRuleCardPayload(draft)
    expect(payload).toHaveLength(draft.length)
    expect(payload.at(-1)).toEqual({
      key: 'custom_1',
      label: '自定义条目',
      value: '自定义内容',
      visible: true,
    })
    // payload 里没有 required（后端按 key 自己判定）。
    expect(payload[0]).not.toHaveProperty('required')

    const back = payload.map((item, index) => ({
      ...item,
      required: SEASON_REQUIRED_RULE_CARD_KEYS.includes(
        item.key as (typeof SEASON_REQUIRED_RULE_CARD_KEYS)[number],
      ),
      value: item.value || draft[index].value,
    }))
    expect(back.map((item) => item.key)).toEqual(draft.map((item) => item.key))
  })

  it('trims key / label / value and preserves order', () => {
    const payload = toRuleCardPayload([
      optional({ key: ' custom_2 ', label: ' 名称 ', value: ' 内容 ' }),
    ])
    expect(payload).toEqual([{ key: 'custom_2', label: '名称', value: '内容', visible: true }])
  })
})

describe('reorderRuleCardItems', () => {
  const items = [optional({ key: 'a' }), optional({ key: 'b' }), optional({ key: 'c' })]
  const keys = (list: RuleCardDraftItem[]) => list.map((item) => item.key)

  it('moves an item down to a later slot without mutating the input', () => {
    expect(keys(reorderRuleCardItems(items, 0, 2))).toEqual(['b', 'a', 'c'])
    expect(keys(reorderRuleCardItems(items, 0, 3))).toEqual(['b', 'c', 'a'])
    expect(keys(items)).toEqual(['a', 'b', 'c'])
  })

  it('moves an item up to an earlier slot', () => {
    expect(keys(reorderRuleCardItems(items, 2, 0))).toEqual(['c', 'a', 'b'])
    expect(keys(reorderRuleCardItems(items, 1, 0))).toEqual(['b', 'a', 'c'])
  })

  it('returns the input unchanged when the drop is a no-op', () => {
    // 拖到自己身上 / 拖到自己后面一格，都是「位置没变」。
    expect(reorderRuleCardItems(items, 1, 1)).toBe(items)
    expect(reorderRuleCardItems(items, 1, 2)).toBe(items)
  })

  it('ignores out-of-range indexes', () => {
    expect(reorderRuleCardItems(items, 99, 0)).toBe(items)
    expect(reorderRuleCardItems(items, -1, 0)).toBe(items)
    expect(reorderRuleCardItems(items, 0, 99)).toBe(items)
    expect(reorderRuleCardItems(items, 0, -1)).toBe(items)
  })
})

describe('appendRuleCardItem', () => {
  it('appends a new optional item built from the dialog input', () => {
    const next = appendRuleCardItem(validDraft(), {
      label: '补充说明',
      value: '这里是内容',
      visible: true,
    })
    expect(next).toHaveLength(SEASON_REQUIRED_RULE_CARD_KEYS.length + 1)
    expect(next.at(-1)).toMatchObject({
      key: 'custom_1',
      label: '补充说明',
      value: '这里是内容',
      required: false,
      visible: true,
    })
  })

  it('never marks a user-created item as required', () => {
    expect(
      appendRuleCardItem([], { label: 'x', value: 'y', visible: true })[0].required,
    ).toBe(false)
  })
})

describe('updateRuleCardItem', () => {
  it('rewrites label / value / visible of an optional item and keeps its key', () => {
    const items = validDraft().concat(optional({ key: 'custom_1', visible: true }))
    const next = updateRuleCardItem(items, items.length - 1, {
      label: '改过的名称',
      value: '改过的内容',
      visible: false,
    })
    expect(next.at(-1)).toEqual({
      key: 'custom_1',
      label: '改过的名称',
      value: '改过的内容',
      required: false,
      visible: false,
    })
  })

  it('refuses to rewrite a required item', () => {
    const items = validDraft()
    expect(
      updateRuleCardItem(items, 0, { label: 'x', value: 'y', visible: false }),
    ).toBe(items)
  })

  it('ignores an out-of-range index', () => {
    const items = validDraft().concat(optional())
    expect(updateRuleCardItem(items, 99, { label: 'x', value: 'y', visible: true })).toBe(items)
  })
})

describe('requiredRuleCardLabel', () => {
  it('prefers the shared label for a known required key', () => {
    expect(requiredRuleCardLabel('max_core_members')).toBe(
      SEASON_REQUIRED_RULE_CARD_LABELS.max_core_members,
    )
  })

  it('falls back to the given label for an unknown key', () => {
    expect(requiredRuleCardLabel('custom_1', '自定义')).toBe('自定义')
    expect(requiredRuleCardLabel('custom_1')).toBe('')
  })
})

describe('validateRuleCardDraft', () => {
  it('accepts a draft with every required item plus optional ones', () => {
    expect(validateRuleCardDraft(validDraft().concat(optional()))).toEqual({})
  })

  it('reports a missing required item', () => {
    const draft = validDraft().filter((item) => item.key !== 'max_core_members')
    const errors = validateRuleCardDraft(draft)
    expect(errors.items).toContain('max_core_members')
  })

  it('reports a hidden required item', () => {
    const draft = validDraft()
    draft[0] = { ...draft[0], visible: false }
    const errors = validateRuleCardDraft(draft)
    expect(errors[`items.0.visible`]).toMatch(/不能隐藏/)
  })

  it('does not police required label / value (they come from the season config)', () => {
    const draft = validDraft()
    draft[0] = { ...draft[0], label: '', value: '' }
    expect(validateRuleCardDraft(draft)).toEqual({})
  })

  it('reports a duplicated key', () => {
    const draft = validDraft().concat(optional({ key: 'custom_1' }), optional({ key: 'custom_1' }))
    const errors = validateRuleCardDraft(draft)
    expect(errors[`items.${draft.length - 1}.key`]).toMatch(/重复/)
  })

  it('reports an empty value and an empty label', () => {
    const draft = validDraft().concat(optional({ key: 'custom_1', value: '   ' }))
    const errors = validateRuleCardDraft(draft)
    expect(errors[`items.${draft.length - 1}.value`]).toBeTruthy()

    const draft2 = validDraft().concat(optional({ key: 'custom_2', label: '' }))
    expect(validateRuleCardDraft(draft2)[`items.${draft2.length - 1}.label`]).toBeTruthy()
  })

  it('reports an over-long label, value and key', () => {
    const longLabel = validDraft().concat(optional({ key: 'custom_1', label: 'A'.repeat(256) }))
    expect(validateRuleCardDraft(longLabel)[`items.${longLabel.length - 1}.label`]).toMatch(/255/)

    const longValue = validDraft().concat(optional({ key: 'custom_2', value: 'A'.repeat(2001) }))
    expect(validateRuleCardDraft(longValue)[`items.${longValue.length - 1}.value`]).toMatch(/2000/)

    const longKey = validDraft().concat(optional({ key: `custom_${'a'.repeat(60)}` }))
    expect(validateRuleCardDraft(longKey)[`items.${longKey.length - 1}.key`]).toMatch(/64/)
  })

  it('rejects keys outside [a-z0-9_]', () => {
    const draft = validDraft().concat(optional({ key: 'Custom-Key' }))
    expect(validateRuleCardDraft(draft)[`items.${draft.length - 1}.key`]).toMatch(/小写字母/)
  })

  it('rejects an empty list and a list over the cap', () => {
    expect(validateRuleCardDraft([]).items).toBeTruthy()

    const tooMany = validDraft()
    while (tooMany.length <= MAX_RULE_CARD_ITEMS) {
      tooMany.push(optional({ key: `custom_${tooMany.length}`, label: 'x', value: 'y' }))
    }
    expect(validateRuleCardDraft(tooMany).items).toMatch(String(MAX_RULE_CARD_ITEMS))
  })
})

describe('newRuleCardItem', () => {
  it('generates a key that does not collide with existing items', () => {
    expect(newRuleCardItem([]).key).toBe('custom_1')
    expect(newRuleCardItem([optional({ key: 'custom_1' })]).key).toBe('custom_2')
    expect(
      newRuleCardItem([optional({ key: 'custom_1' }), optional({ key: 'custom_2' })]).key,
    ).toBe('custom_3')
  })

  it('returns an empty, visible, non-required item', () => {
    expect(newRuleCardItem(validDraft())).toMatchObject({
      label: '',
      value: '',
      required: false,
      visible: true,
    })
  })
})

describe('ruleCardDraftEqual', () => {
  it('compares order and every field', () => {
    const a = [optional({ key: 'a' }), optional({ key: 'b' })]
    expect(ruleCardDraftEqual(a, [optional({ key: 'a' }), optional({ key: 'b' })])).toBe(true)
    expect(ruleCardDraftEqual(a, [optional({ key: 'b' }), optional({ key: 'a' })])).toBe(false)
    expect(ruleCardDraftEqual(a, a.slice(0, 1))).toBe(false)
    expect(ruleCardDraftEqual(a, [a[0], { ...a[1], visible: false }])).toBe(false)
    expect(ruleCardDraftEqual(a, [a[0], { ...a[1], value: '改过' }])).toBe(false)
  })
})

describe('validateRulesForm', () => {
  it('accepts the shared defaults', () => {
    expect(validateRulesForm(SEASON_RULE_DEFAULTS)).toEqual({})
  })

  it('keeps the rules.<field> error keys', () => {
    const errors = validateRulesForm({
      ...SEASON_RULE_DEFAULTS,
      maxChallengesPerProject: 9,
      exchangeRatio: -1,
    })
    expect(errors['rules.maxChallengesPerProject']).toBeTruthy()
    expect(errors['rules.exchangeRatio']).toBeTruthy()
  })

  it('treats null / 0 scoring rules as valid (本季不计分)', () => {
    expect(
      validateRulesForm({
        ...SEASON_RULE_DEFAULTS,
        singleWorkCap: null,
        exchangeRatio: 0,
        reviewThreshold: null,
      }),
    ).toEqual({})
  })
})
