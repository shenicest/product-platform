import {
  SEASON_REQUIRED_RULE_CARD_KEYS,
  SEASON_REQUIRED_RULE_CARD_LABELS,
  type SeasonRules,
} from '@shenicest/shared'
import type { RuleCardItem } from '@/lib/boomland'
import { validateRulesDraft } from '@/lib/organizer'

/**
 * 赛季设置 · 规则卡草稿的纯函数工具。
 *
 * 这里只放**纯函数**（没有 React、没有 fetch），方便直接单测：
 *   · `RuleCardItem`（后端行，带 id / sortOrder）↔ `RuleCardDraftItem`（前端草稿）；
 *   · 草稿的校验（与后端 `updateRuleCard` 同口径：必要项 key 不可缺、
 *     必要项不可隐藏、key 唯一、label/value 非空）；
 *   · 排序 / 新增 / 插入 / 替换 / 相等判断。
 *
 * 后端仍然是最终裁判，前端校验只负责把明显不合法的挡在提交之前。
 * 必要项的判定**只认 key**（`SEASON_REQUIRED_RULE_CARD_KEYS`），不信任草稿里的
 * `required` 标记 —— 服务端返回的行也可能带过期的标记。
 *
 * 必要条目的名称与内容都由赛季配置生成（后端写入时同样会重建），前端**不提供**
 * 编辑入口，也不参与校验它们的文案 —— 校验只覆盖可选条目。
 */

// ---------------------------------------------------------------------------
// 类型与常量
// ---------------------------------------------------------------------------

/** 规则卡编辑器的单行草稿（不含 id / sortOrder，顺序由数组下标表达）。 */
export type RuleCardDraftItem = {
  key: string
  label: string
  value: string
  required: boolean
  visible: boolean
}

/** 与后端 `UpdateRuleCardBody.items` 一致：上限 30 条。 */
export const MAX_RULE_CARD_ITEMS = 30

/** 与后端 `UpdateRuleCardBody` 的字段约束一致。 */
export const MAX_RULE_CARD_LABEL_LENGTH = 255
export const MAX_RULE_CARD_VALUE_LENGTH = 2000
export const MAX_RULE_CARD_KEY_LENGTH = 64

/** key 只允许小写字母、数字、下划线。 */
const RULE_CARD_KEY_PATTERN = /^[a-z0-9_]+$/

/** 新增条目的 key 前缀；与必要项 key 不会撞车。 */
const CUSTOM_KEY_PREFIX = 'custom_'

const REQUIRED_RULE_CARD_KEYS: ReadonlySet<string> = new Set(SEASON_REQUIRED_RULE_CARD_KEYS)

/** 这个 key 是不是“必要项”（由共享常量决定，不可编辑）。 */
export function isRequiredRuleCardKey(key: string): boolean {
  return REQUIRED_RULE_CARD_KEYS.has(key)
}

// ---------------------------------------------------------------------------
// 转换
// ---------------------------------------------------------------------------

/**
 * 后端行 → 草稿。
 *
 * 按 `sortOrder` 升序（同序时保持入参顺序），并丢掉 `id`：草稿只关心
 * 「当前顺序」，保存时由数组下标重新生成 `sortOrder`。
 *
 * `required` 只按共享的 key 白名单判定，不采信行上的标记 —— 后端也是按 key
 * 重新判定 `required`，采信旧标记只会让某条可选条目在 UI 里被永久锁死。
 */
export function toRuleCardDraft(items: RuleCardItem[]): RuleCardDraftItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.sortOrder - b.item.sortOrder || a.index - b.index)
    .map(({ item }) => ({
      key: item.key,
      label: item.label,
      value: item.value,
      required: isRequiredRuleCardKey(item.key),
      visible: item.visible !== false,
    }))
}

/**
 * 草稿 → `UpdateRuleCardBody.items`。
 *
 * 顺序即数组顺序（后端按下标写 `sortOrder`）。label/value/key 去首尾空格；
 * `required` 不传 —— 后端按 key 自己判定。
 */
export function toRuleCardPayload(
  items: RuleCardDraftItem[],
): { key: string; label: string; value: string; visible: boolean }[] {
  return items.map((item) => ({
    key: item.key.trim(),
    label: item.label.trim(),
    value: item.value.trim(),
    visible: item.visible !== false,
  }))
}

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

/**
 * 规则卡草稿校验；空对象表示通过。
 *
 * 错误 key 的口径（与表单字段错误同风格，便于定位）：
 *   · `items` —— 整体问题（条数越界、必要项缺失、key 重复）；
 *   · `items.<index>.key` / `.label` / `.value` / `.visible` —— 单行问题。
 *
 * 必要条目的 label / value 不校验：它们由赛季配置生成，后端写入时会重建，
 * 前端也没有编辑入口。这里只确认它们存在且可见。
 */
export function validateRuleCardDraft(items: RuleCardDraftItem[]): Record<string, string> {
  const errors: Record<string, string> = {}

  if (items.length === 0) {
    errors.items = '规则卡至少要有一条'
    return errors
  }
  if (items.length > MAX_RULE_CARD_ITEMS) {
    errors.items = `规则卡最多 ${MAX_RULE_CARD_ITEMS} 条`
  }

  const seen = new Set<string>()
  items.forEach((item, index) => {
    const key = item.key.trim()
    if (!key) {
      errors[`items.${index}.key`] = '条目 key 不能为空'
    } else if (key.length > MAX_RULE_CARD_KEY_LENGTH) {
      errors[`items.${index}.key`] = `条目 key 最多 ${MAX_RULE_CARD_KEY_LENGTH} 个字符`
    } else if (!RULE_CARD_KEY_PATTERN.test(key)) {
      errors[`items.${index}.key`] = '条目 key 只能包含小写字母、数字和下划线'
    } else if (seen.has(key)) {
      errors[`items.${index}.key`] = `条目 key 重复：${key}`
    }
    seen.add(key)

    if (item.required) {
      if (item.visible === false) {
        errors[`items.${index}.visible`] = `必要条目「${item.label || key}」不能隐藏`
      }
      return
    }

    const label = item.label.trim()
    const value = item.value.trim()
    if (!label) errors[`items.${index}.label`] = '请填写条目名称'
    else if (label.length > MAX_RULE_CARD_LABEL_LENGTH) {
      errors[`items.${index}.label`] = `条目名称最多 ${MAX_RULE_CARD_LABEL_LENGTH} 个字符`
    }

    if (!value) errors[`items.${index}.value`] = '请填写条目内容'
    else if (value.length > MAX_RULE_CARD_VALUE_LENGTH) {
      errors[`items.${index}.value`] = `条目内容最多 ${MAX_RULE_CARD_VALUE_LENGTH} 个字符`
    }
  })

  const missing = SEASON_REQUIRED_RULE_CARD_KEYS.filter(
    (key) => !items.some((item) => item.key.trim() === key),
  )
  if (missing.length > 0) {
    errors.items = `缺少必要规则卡条目：${missing.join('、')}`
  }

  return errors
}

/** 类型化规则（非规则卡）的表单校验；错误 key 保持 `rules.<field>` 口径。 */
export function validateRulesForm(rules: SeasonRules): Record<string, string> {
  const errors: Record<string, string> = {}
  // `validateRulesDraft` 的返回类型是 Partial<Record<...>>，这里收窄成“有值才有键”。
  for (const [key, message] of Object.entries(validateRulesDraft(rules))) {
    if (message) errors[key] = message
  }
  return errors
}

// ---------------------------------------------------------------------------
// 排序 / 新增 / 修改 / 比较
// ---------------------------------------------------------------------------

/**
 * 把第 `from` 条拖到第 `to` 个位置（拖动排序的唯一入口）。
 *
 * 语义是「插入到 `to` 之前」的下标语义：拖到列表末尾时 `to` 传 `length`。
 * 越界或原地不动时原样返回，调用方据此跳过 setState；真正移动时返回新数组，
 * 不修改入参。
 */
export function reorderRuleCardItems(
  items: RuleCardDraftItem[],
  from: number,
  to: number,
): RuleCardDraftItem[] {
  if (from < 0 || from >= items.length) return items
  if (to < 0 || to > items.length) return items
  if (from === to || from === to - 1) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(from < to ? to - 1 : to, 0, moved)
  return next
}

/**
 * 生成一条新的可选条目（`custom_1`、`custom_2`…），key 与 `existing` 不冲突。
 *
 * 只保证 key 合法且唯一；label/value 由调用方在弹窗里填写。
 */
export function newRuleCardItem(existing: RuleCardDraftItem[]): RuleCardDraftItem {
  const taken = new Set(existing.map((item) => item.key.trim()))
  let index = 1
  while (taken.has(`${CUSTOM_KEY_PREFIX}${index}`)) index += 1
  return {
    key: `${CUSTOM_KEY_PREFIX}${index}`,
    label: '',
    value: '',
    required: false,
    visible: true,
  }
}

/** 可选条目的可编辑字段：必要条目的 label / key / 可见性都不开放。 */
export type RuleCardItemDraftInput = {
  label: string
  value: string
  visible: boolean
}

/**
 * 新增一条可选条目并追加到末尾。
 *
 * `required` 恒为 false：只有赛季配置生成的条目才是必要项，用户新增的永远可选。
 */
export function appendRuleCardItem(
  items: RuleCardDraftItem[],
  input: RuleCardItemDraftInput,
): RuleCardDraftItem[] {
  return [
    ...items,
    {
      ...newRuleCardItem(items),
      label: input.label,
      value: input.value,
      visible: input.visible,
    },
  ]
}

/**
 * 用弹窗里的结果覆盖第 `index` 条。
 *
 * 必要条目（`required === true`）原样返回：文案由赛季配置生成，不允许从 UI 改。
 * 可选条目只更新 label / value / visible，key 保持不变（后端按 key 判必要项，
 * 改 key 会把条目在下次保存时「变成另一条」）。
 */
export function updateRuleCardItem(
  items: RuleCardDraftItem[],
  index: number,
  input: RuleCardItemDraftInput,
): RuleCardDraftItem[] {
  if (index < 0 || index >= items.length) return items
  const current = items[index]
  if (current.required) return items
  return items.map((item, i) =>
    i === index ? { ...item, label: input.label, value: input.value, visible: input.visible } : item,
  )
}

/** 必要条目的展示名称：只认 key 白名单，回落到后端给的 label。 */
export function requiredRuleCardLabel(key: string, fallback = ''): string {
  const known = SEASON_REQUIRED_RULE_CARD_LABELS as Record<string, string>
  return known[key] ?? fallback
}

/** 顺序与每一项内容都相同才算相等（用于判断“有没有未保存的改动”）。 */
export function ruleCardDraftEqual(a: RuleCardDraftItem[], b: RuleCardDraftItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, index) => {
    const other = b[index]
    return (
      item.key === other.key
      && item.label === other.label
      && item.value === other.value
      && item.required === other.required
      && item.visible === other.visible
    )
  })
}
