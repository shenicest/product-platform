/**
 * 赛季设置 · 赛季主题草稿的纯函数工具。
 *
 * 这里只放**纯函数**（没有 React、没有 fetch），方便直接单测：
 *   · `string[]`（`seasons.themes`，后端已归一化）↔ `ThemeDraftItem[]`（前端草稿）；
 *   · 草稿的校验（与后端 `normalizeThemes` 同口径：非空、单条 ≤ 50 字、不重复、≤ 20 条）；
 *   · 排序 / 新增 / 修改 / 删除 / 相等判断。
 *
 * 与 `organizer-rules.ts` 的分工完全一致：后端仍然是最终裁判，前端校验只负责
 * 把明显不合法的挡在提交之前。
 *
 * 为什么草稿行要带 `key` 而不是直接用数组下标：排序是拖动 + Alt+↑/↓ 的交互，
 * React 需要稳定的 key 才能把焦点留在把手上（否则重排后整行重建，焦点掉回 body，
 * 用户没法连续按第二下）。主题在同一赛季内唯一，所以 key 直接由主题文本派生。
 */

// ---------------------------------------------------------------------------
// 类型与常量
// ---------------------------------------------------------------------------

/** 赛季主题编辑器的单行草稿（顺序由数组下标表达，保存时按下标写顺序）。 */
export type ThemeDraftItem = {
  /** React key：由主题文本派生，见 `assignKeys`。 */
  key: string
  theme: string
}

/**
 * 赛季主题的条数与单条长度上限。
 *
 * 唯一真相源在后端：`normalizeThemes`（apps/api/src/modules/boomland-shared/validation.ts）
 * 与 `UpdateSeasonThemesBody`（apps/api/src/modules/season/model.ts）—— 单条 ≤ 50 字、≤ 20 条。
 * 前端不能直接 import 后端模块（会把 elysia 拖进客户端 bundle），`@shenicest/shared`
 * 目前也没有这组常量，所以在这里声明一份，并用 `test/lib/organizer-themes.test.ts`
 * 钉住数值；任何一处改动都必须三处同步，否则会出现「创建时能填、保存时被拒」。
 */
export const MAX_SEASON_THEMES = 20
export const MAX_SEASON_THEME_LENGTH = 50

/**
 * key 里用的分隔符：`\u0000` 不可能出现在用户输入的主题里，
 * 所以「主题 + 分隔符 + 序号」不会和另一个真实主题撞车。
 */
const KEY_SEPARATOR = '\u0000'

/**
 * 按「主题文本」给整份草稿重算 key。
 *
 * 主题在同一赛季内唯一（后端 `normalizeThemes` 会去重），所以正常情况 key 就是
 * 主题本身 —— 拖动重排后 key 不变，React 能把焦点留在把手上。
 * 只有后端返回了重复数据（理论上不该发生）时才退化成「主题 + 序号」，
 * 保证 key 仍然唯一、不会出现 React 复用错行。
 */
function assignKeys(themes: string[]): ThemeDraftItem[] {
  const taken = new Set<string>()
  return themes.map((theme) => {
    let key = theme
    let index = 2
    while (taken.has(key)) {
      key = `${theme}${KEY_SEPARATOR}${index}`
      index += 1
    }
    taken.add(key)
    return { key, theme }
  })
}

// ---------------------------------------------------------------------------
// 转换
// ---------------------------------------------------------------------------

/**
 * `seasons.themes` → 草稿行。
 *
 * 保持后端给的顺序（顺序就是公开页与报名表单里的展示顺序），并给每行派生 key。
 */
export function toThemeDraft(themes: string[]): ThemeDraftItem[] {
  return assignKeys(themes)
}

/**
 * 草稿 → `PUT /seasons/:id/themes` 的 `themes`。
 *
 * 去首尾空格并丢掉空行：编辑器允许「新增后还没填内容」这种中间态，提交前统一清掉。
 * 不去重 —— 重复主题由 {@link validateThemeDraft} 拦住，静默去重会让用户
 * 以为自己填的那条还在。
 */
export function toThemesPayload(items: ThemeDraftItem[]): string[] {
  return items.map((item) => item.theme.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

/**
 * 赛季主题草稿校验；空对象表示通过。
 *
 * 错误 key 的口径与规则卡一致：
 *   · `items` —— 整体问题（条数超上限）；
 *   · `items.<index>.theme` —— 单行问题（空、超长、重复）。
 *
 * 空列表是**合法**的：赛季可以一个主题都不配（报名表单会隐藏方向选择）。
 * 这一点和规则卡不同 —— 规则卡至少要有必要条目，主题没有「必要项」概念。
 */
export function validateThemeDraft(items: ThemeDraftItem[]): Record<string, string> {
  const errors: Record<string, string> = {}

  if (items.length > MAX_SEASON_THEMES) {
    errors.items = `赛季主题最多 ${MAX_SEASON_THEMES} 个`
  }

  const seen = new Set<string>()
  items.forEach((item, index) => {
    const theme = item.theme.trim()
    if (!theme) {
      errors[`items.${index}.theme`] = '请填写主题名称'
    } else if (theme.length > MAX_SEASON_THEME_LENGTH) {
      errors[`items.${index}.theme`] = `单个主题最多 ${MAX_SEASON_THEME_LENGTH} 个字符`
    } else if (seen.has(theme)) {
      errors[`items.${index}.theme`] = `主题重复：${theme}`
    }
    seen.add(theme)
  })

  return errors
}

// ---------------------------------------------------------------------------
// 排序 / 新增 / 修改 / 删除 / 比较
// ---------------------------------------------------------------------------

/**
 * 把第 `from` 条移动到第 `to` 个位置（拖动排序的唯一入口）。
 *
 * 语义与 `reorderRuleCardItems` 完全一致：「插入到 `to` 之前」的下标语义，
 * 拖到列表末尾时 `to` 传 `length`；越界或原地不动时原样返回（调用方据此
 * 跳过 setState），真正移动时返回新数组，不修改入参。
 *
 * 两个编辑器共用一个语义是有意的：同一屏里两个列表的拖动手感必须一样，
 * 各自实现一份迟早会在边界情况上分叉。
 */
export function reorderThemeItems(
  items: ThemeDraftItem[],
  from: number,
  to: number,
): ThemeDraftItem[] {
  if (from < 0 || from >= items.length) return items
  if (to < 0 || to > items.length) return items
  if (from === to || from === to - 1) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(from < to ? to - 1 : to, 0, moved)
  return next
}

/** 追加一条主题到末尾（调用方应保证 `theme` 已通过弹窗校验）。 */
export function appendThemeItem(items: ThemeDraftItem[], theme: string): ThemeDraftItem[] {
  return assignKeys([...items.map((item) => item.theme), theme.trim()])
}

/**
 * 用弹窗里的结果覆盖第 `index` 条。
 *
 * key 跟着主题文本重算：key 是从文本派生的，改了文本却不改 key 会让
 * 「同一行的 key」与「同一行的内容」脱钩，下一次重排时 React 会复用错节点。
 */
export function updateThemeItem(
  items: ThemeDraftItem[],
  index: number,
  theme: string,
): ThemeDraftItem[] {
  if (index < 0 || index >= items.length) return items
  const next = items.map((item, i) => (i === index ? theme.trim() : item.theme))
  return assignKeys(next)
}

/** 删除第 `index` 条；下标越界时原样返回。 */
export function removeThemeItem(items: ThemeDraftItem[], index: number): ThemeDraftItem[] {
  if (index < 0 || index >= items.length) return items
  return items.filter((_, i) => i !== index)
}

/**
 * 顺序与每一项主题都相同才算相等（用于判断「有没有未保存的改动」）。
 *
 * 比的是 `theme` 而不是 `key`：key 是派生值，拿它比较会把「同一条主题
 * 因重复数据换了后缀」误判成改动。
 */
export function themeDraftEqual(a: ThemeDraftItem[], b: ThemeDraftItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item, index) => item.theme === b[index].theme)
}
