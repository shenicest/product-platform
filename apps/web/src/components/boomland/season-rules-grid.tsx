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

function buildRows(items: RuleCardItem[]) {
  const item = (key: string) => items.find((entry) => entry.key === key && entry.visible)
  const value = (key: string, fallback: string) =>
    item(key)?.value?.trim() || fallback
  const label = (key: string, fallback: string) =>
    item(key)?.label?.trim() || fallback

  const core = value('max_core_members', '3 人')
  const projects = value('max_projects_per_participant', '1 个项目')
  const challenges = value('max_project_challenges', '3 张牌桌')
  const ratio = value('exchange_ratio', '1 积分 = ¥1')
  const cap = value('single_work_cap', '100 分')
  const pool = value('point_pool_and_awards', '赛季 Top 项目可获得额外奖金 / 展示机会')

  const submission: Row = {
    label: label('submission_requirements', '提交要求'),
    value: value('submission_requirements', '按阶段提交作品、说明与验证材料'),
  }
  const review: Row = {
    label: label('review_process', '评审流程'),
    value: value('review_process', '阶段评审 + 赛季最终评审'),
  }
  const milestone: Row = {
    label: label('milestone_rewards', '阶段奖励'),
    value: value('milestone_rewards', '完成里程碑可获得对应积分'),
  }
  const scoring: Row = {
    label: label('scoring_rewards', '评分奖励'),
    value: value('scoring_rewards', '根据评审结果获得积分'),
  }

  const seasonRules: Row[] = [
    { label: '组队', value: `${core}核心团队，可单人；每人 ${projects}` },
    { label: '项目', value: `每位参赛者同期仅参与 ${projects}` },
    { label: '牌桌', value: challenges },
    submission,
    review,
  ]

  const rewardRules: Row[] = [
    { label: '积分兑换', value: `${ratio}（按赛季配置，非平台永久规则）` },
    milestone,
    scoring,
    { label: '单次上限', value: `单次评分最高可获得 ${cap}` },
    { label: '最终奖励', value: pool },
  ]

  return { seasonRules, rewardRules }
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
        {rows.map((row) => (
          <div key={row.label} className="season-rule-row">
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
