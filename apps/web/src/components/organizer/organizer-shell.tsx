'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { OrganizerHeader, type PickableSeason } from '@/components/organizer/organizer-header'
import { OrganizerTabs } from '@/components/organizer/organizer-tabs'
import { resolveSeasonId, type OrganizerOrg } from '@/lib/organizer'
import { getPendingApplicationCount } from '@/lib/organizer-api'
import { ORGANIZER_APPLICATIONS_REFRESH_EVENT } from '@/lib/organizer-applications'

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
  const pendingReviewCount = usePendingReviewCount(seasonId)

  return (
    <>
      <OrganizerHeader
        seasons={seasons}
        organizerOrgs={organizerOrgs}
        seasonId={seasonId}
        tab={tab}
      />
      <div className="mt-6">
        <OrganizerTabs seasonId={seasonId} pendingReviewCount={pendingReviewCount} />
      </div>
      <div className="min-w-0">{children}</div>
    </>
  )
}

/**
 * 「报名审核」红点的数字：当前赛季待处理（`submitted`）的报名条数。
 *
 * 为什么在客户端取：这个数字得跟着**用户选中的赛季**走，而 layout 拿不到
 * `searchParams`（Next 约定），服务端渲染时并不知道当前在看哪一季；赛季列表
 * 又可能有几十上百条，给每一季都预取一次会把一个数字变成 N 个请求。所以只取
 * 当前这一季，且固定 `pageSize=1`（只回 `total`）。
 *
 * 换赛季时旧数字立刻作废（返回 0 而不是先挂着上一季的数）：宁可短暂不显示，
 * 也不要把 A 赛季的待办数画在 B 赛季的 tab 上。
 *
 * 审核成功后 `ApplicationReviewView` 会发 `ORGANIZER_APPLICATIONS_REFRESH_EVENT`：
 * `router.refresh()` 只重渲染服务端组件，不会重跑这里的 effect，红点得靠事件
 * 重拉才不会停在旧数字上。读失败（403 / 网络）返回 0：角标失败不该打断页面。
 */
function usePendingReviewCount(seasonId: number | null): number {
  // 记下这是**哪一季**的数字，换赛季后用它判断旧值是否过期 ——
  // 比在 effect 里同步清空 state 少一轮渲染，也不会让旧数字闪在新赛季上。
  const [state, setState] = useState<{ seasonId: number; count: number } | null>(null)

  useEffect(() => {
    if (seasonId === null) return undefined
    let active = true

    const load = async () => {
      const total = await getPendingApplicationCount(seasonId)
      if (!active || total === null) return
      setState({ seasonId, count: total })
    }

    void load()
    window.addEventListener(ORGANIZER_APPLICATIONS_REFRESH_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(ORGANIZER_APPLICATIONS_REFRESH_EVENT, load)
    }
  }, [seasonId])

  return seasonId !== null && state?.seasonId === seasonId ? state.count : 0
}
