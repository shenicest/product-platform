import {
  formatMilestoneDate,
  type SeasonDetail,
} from '@/lib/boomland'

const MILESTONES = [
  { key: 'applyOpen', label: '报名开放' },
  { key: 'applyClose', label: '报名截止' },
  { key: 'startAt', label: '赛季开始' },
  { key: 'teamDeadline', label: '组队登记截止' },
  { key: 'workDeadline', label: '赛季结束' },
  { key: 'settleDate', label: '结算完成' },
] as const

export function SeasonTimeline({ season }: { season: SeasonDetail }) {
  return (
    <div className="season-milestones">
      <ol className="season-milestones__list" aria-label="赛季时间轴">
        {MILESTONES.map((milestone) => (
          <li key={milestone.key} className="season-milestones__item">
            <p className="season-milestones__label">{milestone.label}</p>
            <p className="season-milestones__date">
              {formatMilestoneDate(season.schedule?.[milestone.key])}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
