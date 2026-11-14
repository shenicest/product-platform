import type { SeasonDetail } from '@/lib/boomland'
import { currentTimelineIndex, isoDate } from '@/lib/season-landing'

/**
 * 赛季详情页时间轴（设计稿 `.timeline`）。
 *
 * 设计稿是 8 段：报名开放 / 报名截止 / 开赛 / 命题冻结 / 组队截止 /
 * 作品截止 / 评分截止 / 结算。顺序按设计稿固定（命题冻结在组队截止之前），
 * 日期全部来自后端的 `schedule`，缺失时显示「待定」。
 *
 * 进度只做视觉提示：已经过去的节点描粉、当前节点加一圈淡粉光晕；
 * 不改变任何截止判断（截止仍以后端字段为准）。
 */
const MILESTONES = [
  { key: 'applyOpen', label: '报名开放' },
  { key: 'applyClose', label: '报名截止' },
  { key: 'startAt', label: '开赛' },
  { key: 'challengeFreezeAt', label: '命题冻结' },
  { key: 'teamDeadline', label: '组队截止' },
  { key: 'workDeadline', label: '作品截止' },
  { key: 'scoreDeadline', label: '评分截止' },
  { key: 'settleDate', label: '结算' },
] as const

export function SeasonTimeline({ season }: { season: SeasonDetail }) {
  const current = currentTimelineIndex(
    MILESTONES.map((milestone) => season.schedule?.[milestone.key]),
  )

  return (
    <div>
      <ol className="v26-timeline__list" aria-label="赛季时间轴">
        {MILESTONES.map((milestone, index) => {
          const raw = season.schedule?.[milestone.key]
          const done = index <= current
          const isCurrent = index === current
          return (
            <li
              key={milestone.key}
              className={[
                'v26-timeline__item',
                done ? 'is-done' : '',
                isCurrent ? 'is-current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <strong>{milestone.label}</strong>
              <span>{raw ? isoDate(raw) : '待定'}</span>
            </li>
          )
        })}
      </ol>
      <p className="v26-timeline__tz">
        时间均为北京时间 · 具体截止时刻以赛季公告与页面顶部报名窗口为准
      </p>
    </div>
  )
}
