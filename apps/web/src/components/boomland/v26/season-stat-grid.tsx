import type { RuleCardItem, SeasonDetail } from '@/lib/boomland'

/**
 * 赛季详情页的四张指标卡（设计稿 `.guest-stat-grid`）。
 *
 * 设计稿固定四格：参赛人数 / 命题数 / 奖励池 / 积分池总量。后两项没有独立的
 * 接口字段，只能从赛季规则卡（`ruleCard`）里按关键词取；取不到时显示「—」，
 * 不编造数字 —— 这也是与设计稿的已知差异之一（见冲突文档）。
 */
function findRule(
  items: readonly RuleCardItem[],
  keywords: readonly string[],
  keys: readonly string[],
): string | null {
  const hit = items.find((item) => {
    if (item.visible === false) return false
    return (
      keys.includes(item.key) ||
      keywords.some((keyword) => item.label.includes(keyword))
    )
  })
  return hit?.value?.trim() || null
}

export function SeasonStatGrid({
  season,
  challengeCount,
}: {
  season: SeasonDetail
  challengeCount: number
}) {
  const reward = findRule(season.ruleCard, ['奖励预算', '奖励池'], ['award_budget', 'reward_budget'])
  const pool = findRule(
    season.ruleCard,
    ['积分池总量', '积分池总量（分）'],
    ['point_pool_total', 'point_pool'],
  )

  const stats = [
    {
      label: '参赛人数',
      value: String(season.participantCount),
      small:
        season.participantCapacity === null ? ' / 不限' : ` / ${season.participantCapacity}`,
      foot: '已通过报名审核的选手',
    },
    {
      label: '命题数',
      value: String(challengeCount),
      small: '',
      foot: '本赛季已发布的企业命题',
    },
    {
      label: '奖励池',
      value: reward ?? '—',
      small: '',
      foot: reward ? '以赛季公告与结算记录为准' : '以赛季公告为准',
    },
    {
      label: '积分池总量',
      value: pool ?? '—',
      small: '',
      foot: pool ? '评委分配额度不等于已得分' : '以赛季公告为准',
    },
  ]

  return (
    <div className="v26-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="v26-stat">
          <div className="v26-stat__label">{stat.label}</div>
          <div className="v26-stat__value">
            {stat.value}
            {stat.small ? <small>{stat.small}</small> : null}
          </div>
          <div className="v26-stat__foot">{stat.foot}</div>
        </div>
      ))}
    </div>
  )
}
