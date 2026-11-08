import type { TeamRulesDto } from '@/lib/team'
import { teamRuleBullets } from '@/lib/team'

/**
 * 「组队规则」卡 —— 组队 tab 的第 5 张卡。
 *
 * bullet 由 `teamRuleBullets()` 生成（纯函数，单测覆盖）：前三条与最后一条是
 * 赛季级固定规则，第 4、5 条取赛季 `rules` 与 `teamDeadline`。
 * 这里只负责把它们摆成一个 `<ul>`，不做任何条件分支 —— 规则卡的价值在于
 * 「每一屏都一样、读一遍就够」，动态增删条目反而会让人怀疑自己看漏了。
 */
export function TeamRulesCard({ rules }: { rules: TeamRulesDto }) {
  const bullets = teamRuleBullets({ rules })

  return (
    <article className="ui-card ui-card--static">
      <div className="card-body">
        <h2 className="card-title">组队规则</h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="relative pl-5 text-body-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:text-brand-text before:content-['·']"
            >
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
