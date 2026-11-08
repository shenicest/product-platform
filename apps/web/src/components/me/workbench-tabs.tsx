'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Chip } from '@/components/ui/chip'
import { WORKBENCH_TABS } from '@/lib/me'

/**
 * 个人中心的 tab 导航。
 *
 * 与主办方后台 `OrganizerTabs` 同款视觉：`ui-btn--ghost ui-btn--flat`，
 * 选中态用品牌色描边 + 淡底。`ui-btn--flat` 是必须的 —— tab 只切路由，
 * 不产生页内动作，悬停上浮 2px 会让人误以为页内会展开（见 components.css）。
 *
 * 红点用 `Chip` 渲染而不是绝对定位的小圆点：这样它在无障碍树里是一个带文本
 * 的标签（读屏能念出数量），而不是一个只有颜色的装饰。
 *
 * 用 `usePathname` 而不是从 props 传当前 tab：layout 不随路由段变化而重渲染
 * （Next 约定），从 props 传会让高亮停在首屏那个 tab 上。
 */
export function WorkbenchTabs({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname()
  const currentSlug = pathname.split('/').filter(Boolean)[1] ?? ''

  return (
    <nav
      className="console-nav overflow-x-auto"
      aria-label="个人中心导航"
      data-current={currentSlug}
    >
      {WORKBENCH_TABS.map((tab) => {
        const active = tab.slug === currentSlug
        const badge = badges[tab.slug] ?? 0
        return (
          <Link
            key={tab.slug}
            href={`/me/${tab.slug}`}
            aria-current={active ? 'page' : undefined}
            data-active={active ? 'true' : 'false'}
            className={[
              'ui-btn ui-btn--ghost ui-btn--flat ui-btn--small whitespace-nowrap',
              active ? 'border-brand bg-brand-wash text-brand-text' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {tab.label}
            {badge > 0 ? (
              <Chip tone="accent" aria-label={`${badge} 条待处理`}>
                {badge > 99 ? '99+' : badge}
              </Chip>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
