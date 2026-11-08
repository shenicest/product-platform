import type { RuleCardItem } from '@/lib/boomland'

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" strokeLinejoin="round" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6" strokeLinecap="round" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12" />
      <path d="M12 8C10 8 7 6.6 7 4.8 7 3.8 7.8 3 8.8 3 10.4 3 12 5 12 8ZM12 8c2 0 5-1.4 5-3.2 0-1-.8-1.8-1.8-1.8C13.6 3 12 5 12 8Z" strokeLinejoin="round" />
    </svg>
  )
}

type Row = { label: string; value: string }

/**
 * 公开页规则卡的取数口径。
 *
 * 必要条目（key 见 `SEASON_REQUIRED_RULE_CARD_KEYS`）的文案由赛季配置生成，
 * 后端返回的就是最终文案，这里**只做分组与回退**：某个 key 缺失（老数据、
 * 后端降级）时用一句保守的兜底，而不是把整块渲染成空白。
 *
 * 分组沿用产品口径：赛季规则（怎么参赛）+ 奖励规则（怎么拿积分）。
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

function buildRows(items: RuleCardItem[]) {
  const visible = items.filter((item) => item.visible !== false)
  const item = (key: string) => visible.find((entry) => entry.key === key)

  const toRow = (key: string): Row => {
    const entry = item(key)
    return {
      label: entry?.label?.trim() || FALLBACKS[key] || key,
      value: entry?.value?.trim() || FALLBACKS[key] || '以赛季公告为准',
    }
  }

  // 可选条目（主办方自建）跟在必要条目之后，不参与分组，避免被塞进错误的分区。
  const customRows: Row[] = visible
    .filter((entry) => !(SEASON_RULE_KEYS as readonly string[]).includes(entry.key))
    .filter((entry) => !(REWARD_RULE_KEYS as readonly string[]).includes(entry.key))
    .map((entry) => ({
      label: entry.label.trim() || entry.key,
      value: entry.value.trim() || '以赛季公告为准',
    }))

  return {
    seasonRules: [...SEASON_RULE_KEYS.map(toRow), ...customRows],
    rewardRules: REWARD_RULE_KEYS.map(toRow),
  }
}

function RuleCard({
  title,
  icon,
  rows,
}: {
  title: string
  icon: React.ReactNode
  rows: Row[]
}) {
  return (
    <section className="season-rule-card">
      <h2 className="season-rule-card__title">
        {title}
        <span className="season-rule-card__icon">{icon}</span>
      </h2>
      <dl className="season-rule-card__rows">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="season-rule-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function SeasonRulesGrid({ items }: { items: RuleCardItem[] }) {
  const { seasonRules, rewardRules } = buildRows(items)

  return (
    <div className="season-rules">
      <RuleCard title="赛季规则" icon={<TrophyIcon />} rows={seasonRules} />
      <RuleCard title="奖励规则" icon={<GiftIcon />} rows={rewardRules} />
    </div>
  )
}
