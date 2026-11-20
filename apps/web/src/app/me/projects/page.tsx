import { redirect } from 'next/navigation'
import { SeasonStatus } from '@shenicest/shared'
import { MyProjects } from '@/components/me/my-projects'
import { SeasonForbidden } from '@/components/season/season-forbidden'
import { canAccessDemoWorkspace } from '@/lib/season-access'
import { workbenchTabBySlug } from '@/lib/me'
import { getWorkbenchHeader } from '@/server/me'

export const metadata = {
  title: workbenchTabBySlug('projects')?.label ?? '个人中心',
}

export const dynamic = 'force-dynamic'

/**
 * 「我的项目」展示的是赛季项目（带所选命题、积分与奖金）。
 * 权限矩阵 4.3：新建/带入赛季项目只对进行中赛季的选手开放，所以未参赛
 * 或赛季已结束时不给入口，避免把长期项目误解成赛季项目。
 */
export default async function Page() {
  const header = await getWorkbenchHeader()
  if (!header) redirect(`/login?returnTo=${encodeURIComponent('/me/projects')}`)

  const hasActiveSeason = header.activeSeasons.some(
    (season) => season.status === SeasonStatus.Active,
  )

  if (!hasActiveSeason) {
    return (
      <SeasonForbidden
        title="NO ACTIVE SEASON"
        description="赛季项目只对已通过报名、且赛季正在进行中的选手开放。想提交长期产品，可以从「提交产品」进入产品共生。"
        actionHref="/submit"
        actionLabel="提交产品"
      />
    )
  }

  // 「我的项目」读取同一份单人演示数据，按项目归属锁到张一（101）。
  if (!canAccessDemoWorkspace(header.userId)) {
    return (
      <SeasonForbidden
        title="NO PROJECT"
        description="你还没有赛季项目。先完成组队登记，项目会出现在这里。"
        actionHref="/me/team"
        actionLabel="去组队"
      />
    )
  }

  return <MyProjects />
}
