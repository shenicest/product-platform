import Link from 'next/link'
import { Eyebrow, SectionHead } from '@/components/ui/typography'

const CARDS = [
  {
    eyebrow: 'INCUBATION / 孵化',
    title: '产品共生',
    href: '/products',
    description: '正在孵化的产品、长期项目和从赛季里长出来的项目，持续更新阶段与作品。',
    action: '浏览产品共生',
  },
  {
    eyebrow: 'PEOPLE / 人才',
    title: '共鸣之地',
    href: '/talents',
    description: '正在找队友的人和正在招人的项目；技能、合作状态与赛季经历都在这里。',
    action: '去共鸣之地',
  },
  {
    eyebrow: 'OFFLINE / 线下',
    title: 'SN 黑客松',
    href: '/hackathon',
    description: '城市站、现场冲刺与线下活动产出的项目；黑客松是赛季的一种类型。',
    action: '看黑客松',
  },
]

/**
 * 首页「赛季之外」的三块长期展示：孵化产品、培养人、线下活动作品。
 *
 * 只复用现有长期层（产品共生 / 共鸣之地 / 黑客松），不新增独立数据模型；
 * 用户要深入时再进入各自页面。
 */
export function HomeDiscovery() {
  return (
    <section className="section section--flush">
      <div className="shell">
        <SectionHead
          eyebrow="BEYOND THE SEASON / 赛季之外"
          title="孵化、人才与线下作品"
          lead="赛季会结束，产品和人的成长不会。三块长期展示继续承接比赛之外的内容。"
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="ui-panel flex flex-col gap-2 transition-colors hover:border-brand hover:bg-brand-wash"
            >
              <Eyebrow tone="accent">{card.eyebrow}</Eyebrow>
              <strong className="text-[1.35rem] font-black text-foreground">
                {card.title}
              </strong>
              <p className="text-body-sm leading-relaxed text-muted-foreground">
                {card.description}
              </p>
              <span className="mt-auto pt-3 text-meta font-bold text-brand-text">
                {card.action} <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
