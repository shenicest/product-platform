import Link from 'next/link'
import { Chip } from '@/components/ui/chip'

/**
 * 「找队友」卡 —— 组队 tab 的第 3 张卡。
 *
 * 只做展示 + 一个跳转：未组队名单放在共鸣之地（`/talents`），组队 tab
 * 不重复实现筛选（契约 §5）。所以这里唯一要写清楚的是**去哪儿找**，
 * 以及**为什么这里不显示联系方式**（隐私口径）。
 */
export function TeamFindTeammatesCard({
  seasonCode,
  unassignedParticipantCount,
  openRecruitmentCardCount,
}: {
  seasonCode: string
  unassignedParticipantCount: number
  openRecruitmentCardCount: number
}) {
  return (
    <article className="ui-card ui-card--static">
      <div className="card-body">
        <h2 className="card-title">找队友</h2>
        <p className="card-text">
          {seasonCode} 还有 {unassignedParticipantCount} 位已通过报名、还没组队的选手。
        </p>

        <div className="flex flex-wrap gap-2">
          <Chip tone="accent">{unassignedParticipantCount} 位待组队</Chip>
          <Chip tone={openRecruitmentCardCount > 0 ? 'success' : 'neutral'}>
            {openRecruitmentCardCount} 张招募中
          </Chip>
        </div>

        <p className="ui-hint m-0">
          未组队名单放在共鸣之地：可以看技能和个人主页，发起人可以直接登记为队友；
          不展示联系方式。
        </p>
      </div>

      <footer className="card-footer">
        <Link
          href="/talents"
          className="ui-btn ui-btn--secondary ui-btn--small"
        >
          去共鸣之地看 {seasonCode} 未组队选手
          <span className="ui-btn__arrow" aria-hidden>
            →
          </span>
        </Link>
      </footer>
    </article>
  )
}
