'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Chip } from '@/components/ui/chip'
import { cn } from '@/lib/utils'
import { pendingReviewBadgeLabel } from '@/lib/organizer-applications'

/**
 * 主办方后台的 tab 导航。
 *
 * 每个 tab 是一个真实路由（`/organizer/<slug>`），不是本地 state：
 * 刷新、分享、直接打开某个 tab 都能落到同一屏。
 *
 * 当前选中的赛季用 `?season=<id>` 跟着 tab 走 —— 切 tab 时用户不该被退回
 * “全部赛季”；没有选中具体赛季时保持无 query 的形态。
 */

export type OrganizerTab = {
  /** 路由末段，同时作为稳定标识。 */
  slug: string
  label: string
}

export const ORGANIZER_TABS: readonly OrganizerTab[] = [
  { slug: 'overview', label: '总览' },
  { slug: 'season-settings', label: '赛季设置' },
  { slug: 'applications', label: '报名审核' },
  { slug: 'manual-group', label: '人工拉群' },
  { slug: 'challenges', label: '命题与资源' },
  { slug: 'scoring', label: '评委与积分池' },
  { slug: 'milestones', label: '里程碑' },
  { slug: 'verification', label: '核验与异议' },
  { slug: 'budget', label: '预算与结算' },
  { slug: 'audit', label: '审计' },
]

export const DEFAULT_ORGANIZER_TAB = ORGANIZER_TABS[0]

export function OrganizerTabs({
  seasonId,
  pendingReviewCount = 0,
}: {
  seasonId: number | null
  /**
   * 「报名审核」上的红点数字：当前赛季待处理（`submitted`）的报名条数。
   *
   * 由 `OrganizerShell` 取好后传进来 —— tab 导航只负责画，取数逻辑跟赛季
   * 解析放在一起（那才拿得到客户端选中的赛季）。0 表示没有待办，不画红点。
   */
  pendingReviewCount?: number
}) {
  const pathname = usePathname()
  const currentSlug = pathname.split('/').filter(Boolean)[1] ?? DEFAULT_ORGANIZER_TAB.slug
  const badge = pendingReviewBadgeLabel(pendingReviewCount)

  return (
    <nav
      className="console-nav overflow-x-auto"
      aria-label="主办方后台导航"
      data-current={currentSlug}
    >
      {ORGANIZER_TABS.map((tab) => {
        const active = tab.slug === currentSlug
        const href = seasonId === null
          ? `/organizer/${tab.slug}`
          : `/organizer/${tab.slug}?season=${seasonId}`
        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={active ? 'page' : undefined}
            data-active={active ? 'true' : 'false'}
            className={cn(
              // `ui-btn--flat`：tab 只切路由，不产生页内动作，悬停不该上浮
              // （见 `styles/components.css` 里 `.ui-btn--flat` 的注释）。
              'ui-btn ui-btn--ghost ui-btn--flat ui-btn--small whitespace-nowrap',
              active && 'border-brand bg-brand-wash text-brand-text',
            )}
          >
            {tab.label}
            {/* 红点用 `Chip` 而不是绝对定位的小圆点（和个人中心 tab 同一个做法）：
                它在无障碍树里是一个带 `aria-label` 的标签，读屏能念出「几条待处理」，
                而不是一个只有颜色的装饰。 */}
            {tab.slug === 'applications' && badge ? (
              <Chip
                tone="accent"
                data-testid="pending-review-badge"
                aria-label={`${pendingReviewCount} 条待处理报名`}
              >
                {badge}
              </Chip>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
