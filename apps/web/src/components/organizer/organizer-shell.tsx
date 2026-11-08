'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { OrganizerHeader, type PickableSeason } from '@/components/organizer/organizer-header'
import { OrganizerTabs } from '@/components/organizer/organizer-tabs'
import { resolveSeasonId, type OrganizerOrg } from '@/lib/organizer'

/**
 * 主办方后台的交互外壳。
 *
 * 服务端 layout 只负责鉴权与取数，把赛季列表和组织列表交给这里；
 * “当前选中哪个赛季”属于**查询参数**，而 layout 既拿不到 `searchParams`
 * 也不会因为 query 变化而重渲染（见 Next 文档 file-conventions/layout），
 * 所以这一层用 `useSearchParams()` 读取，保证切换赛季时 Header 与 tab
 * 高亮同步更新。
 *
 * 没有 `?season=` 时**回落到最新赛季**（`resolveSeasonId`），而不是「未选中」：
 * 后台每个 tab 都是按赛季组织的，让用户先做一次选择纯属多余 —— 打开就是最近
 * 在弄的那个赛季。各服务端页面用的是同一个函数，选择器显示与页面取数不会错位。
 */
export function OrganizerShell({
  seasons,
  organizerOrgs,
  children,
}: {
  seasons: PickableSeason[]
  organizerOrgs: OrganizerOrg[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const seasonId = resolveSeasonId(searchParams.get('season'), seasons)
  const tab = pathname.split('/').filter(Boolean)[1] ?? 'overview'

  return (
    <>
      <OrganizerHeader
        seasons={seasons}
        organizerOrgs={organizerOrgs}
        seasonId={seasonId}
        tab={tab}
      />
      <div className="mt-6">
        <OrganizerTabs seasonId={seasonId} />
      </div>
      <div className="min-w-0">{children}</div>
    </>
  )
}
