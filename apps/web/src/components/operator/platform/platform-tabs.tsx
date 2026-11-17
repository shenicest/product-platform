'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  PLATFORM_TABS,
  platformTabFromPathname,
  platformTabHref,
  type PlatformTab,
} from '@/lib/platform-console'

/**
 * 平台后台的 tab 导航。
 *
 * 每个 tab 是真实路由（`/operator/boomland/<slug>`），不是本地 state：
 * 刷新、分享、直接打开某个 tab 都能落到同一屏 —— 与主办方后台
 * `OrganizerTabs` 同一做法，两处后台的操作习惯保持一致。
 *
 * 预览页 `/operator/boomland/seasons/12` 仍高亮「赛季治理」：解析逻辑在
 * `platformTabFromPathname` 里，取的是 `boomland` 之后的第一个路径段。
 */
export function PlatformTabs({ className }: { className?: string }) {
  const pathname = usePathname()
  const current = platformTabFromPathname(pathname)

  return (
    <nav
      className={cn('console-nav overflow-x-auto', className)}
      aria-label="平台后台导航"
      data-current={current.slug}
    >
      {PLATFORM_TABS.map((tab: PlatformTab) => {
        const active = tab.slug === current.slug
        return (
          <Link
            key={tab.slug}
            href={platformTabHref(tab.slug)}
            aria-current={active ? 'page' : undefined}
            data-active={active ? 'true' : 'false'}
            className={cn(
              // tab 只切路由、不产生页内动作，所以用 `ui-btn--flat` 去掉悬停位移。
              'ui-btn ui-btn--ghost ui-btn--flat ui-btn--small whitespace-nowrap',
              active && 'border-brand bg-brand-wash text-brand-text',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
