import type { RuleCardItem } from '@/lib/boomland'

/**
 * 赛季规则列表（设计稿 `.rule-list`）。
 *
 * 设计稿把规则卡做成一张可滚动的左标签 / 右说明列表，不再分「赛季规则 /
 * 奖励规则」两张卡。这里保留原来的取数与分组口径（必要条目 → 自定义条目 →
 * 奖励条目），只是把它们按同一份列表渲染：
 *
 *   · 必要条目的文案由赛季配置生成，缺字段时用保守兜底，不留空行；
 *   · 主办方自建的条目跟在本组之后，不混进奖励口径。
 */
const SEASON_RULE_KEYS = [
  'max_project_challenges',
  'max_projects_per_participant',
  'max_core_members',
] as const

const REWARD_RULE_KEYS = [
  'single_work_cap',
  'exchange_ratio',
  'review_threshold',
  'work_and_score_deadline',
  'point_pool_and_awards',
] as const

const FALLBACKS: Record<string, string> = {
  max_project_challenges: '命题数量以赛季公告为准',
  max_projects_per_participant: '每人参与项目数见赛季公告',
  max_core_members: '核心团队人数以赛季公告为准',
  single_work_cap: '单次评分上限以赛季公告为准',
  exchange_ratio: '兑换比例以赛季公告为准',
  review_threshold: '大额复核口径以赛季公告为准',
  work_and_score_deadline: '截止时间以赛程为准',
  point_pool_and_awards: '积分池与奖励口径以赛季公告为准',
}

type Row = { label: string; value: string }

function buildRows(items: RuleCardItem[]): Row[] {
  const visible = items.filter((item) => item.visible !== false)
  const item = (key: string) => visible.find((entry) => entry.key === key)

  const toRow = (key: string): Row => {
    const entry = item(key)
    return {
      label: entry?.label?.trim() || FALLBACKS[key] || key,
      value: entry?.value?.trim() || FALLBACKS[key] || '以赛季公告为准',
    }
  }

  const known = new Set<string>([...SEASON_RULE_KEYS, ...REWARD_RULE_KEYS])
  const customRows: Row[] = visible
    .filter((entry) => !known.has(entry.key))
    .map((entry) => ({
      label: entry.label.trim() || entry.key,
      value: entry.value.trim() || '以赛季公告为准',
    }))

  return [
    ...SEASON_RULE_KEYS.map(toRow),
    ...customRows,
    ...REWARD_RULE_KEYS.map(toRow),
  ]
}

export function SeasonRulesGrid({ items }: { items: RuleCardItem[] }) {
  const rows = buildRows(items)

  return (
    <ul className="v26-rule-list" aria-label="赛季规则">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`}>
          <strong>{row.label}</strong>
          <span>{row.value}</span>
        </li>
      ))}
    </ul>
  )
}
