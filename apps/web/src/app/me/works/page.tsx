import { redirect } from 'next/navigation'
import { SeasonStatus } from '@shenicest/shared'
import { WorksLibrary } from '@/components/me/season-workspace'
import { SeasonForbidden } from '@/components/season/season-forbidden'
import { canAccessDemoWorkspace } from '@/lib/season-access'
import { workbenchTabBySlug } from '@/lib/me'
import { getWorkbenchHeader } from '@/server/me'

export const metadata = {
  title: workbenchTabBySlug('works')?.label ?? '个人中心',
}

export const dynamic = 'force-dynamic'

/** 作品页与参赛台共用同一条守卫：只有进行中赛季的选手能发布与查看自己的赛季作品。 */
export default async function Page() {
  const header = await getWorkbenchHeader()
  if (!header) redirect(`/login?returnTo=${encodeURIComponent('/me/works')}`)

  const hasActiveSeason = header.activeSeasons.some(
    (season) => season.status === SeasonStatus.Active,
  )

  if (!hasActiveSeason) {
    return (
      <SeasonForbidden
        title="NO ACTIVE SEASON"
        description="作品与进度只对已通过报名、且赛季正在进行中的选手开放。开赛后这里会汇总你的全部赛季作品与评审记录。"
        actionHref="/me/applications"
        actionLabel="查看我的报名"
      />
    )
  }

  // 作品页与参赛台共用同一份单人演示数据，只对项目发起人张一（101）开放。
  if (!canAccessDemoWorkspace(header.userId)) {
    return (
      <SeasonForbidden
        title="NO PROJECT"
        description="你的赛季项目还没有建立。作品与进度按项目展示，先完成组队登记后再发布。"
        actionHref="/me/team"
        actionLabel="去组队"
      />
    )
  }

  return <WorksLibrary />
}
