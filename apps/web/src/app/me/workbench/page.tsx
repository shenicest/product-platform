import { redirect } from 'next/navigation'
import { SeasonStatus } from '@shenicest/shared'
import { SeasonWorkspace } from '@/components/me/season-workspace'
import { SeasonForbidden } from '@/components/season/season-forbidden'
import { getSeasonRoles, canAccessDemoWorkspace } from '@/lib/season-access'
import { workbenchTabBySlug } from '@/lib/me'
import { getWorkbenchHeader } from '@/server/me'

export const metadata = {
  title: workbenchTabBySlug('workbench')?.label ?? '个人中心',
}

export const dynamic = 'force-dynamic'

/**
 * 参赛台（工作台）。
 *
 * 权限矩阵 4.3：发布赛季作品、提交里程碑只对「赛季选手 + 项目成员」开放；
 * 普通用户、评委（非本人参赛身份）、企业合作方都不能发布。
 *
 * 守卫用真实报名数据（`/me/applications`）判断，不依赖前端角色表：
 * 已通过报名 + 赛季正在进行中，缺一不可。开赛后「发布」才有意义，所以
 * 报名通过但赛季还没开赛时同样拒绝，并指向报名记录。
 */
export default async function Page() {
  const header = await getWorkbenchHeader()
  if (!header) redirect(`/login?returnTo=${encodeURIComponent('/me/workbench')}`)

  const hasActiveSeason = header.activeSeasons.some(
    (season) => season.status === SeasonStatus.Active,
  )

  if (!hasActiveSeason) {
    return (
      <SeasonForbidden
        title="NO ACTIVE SEASON"
        description="参赛台只对已通过报名、且赛季正在进行中的选手开放。报名通过后，开赛即可在这里发布赛季作品、提交里程碑。"
        actionHref="/me/applications"
        actionLabel="查看我的报名"
      />
    )
  }

  // 作品 / 里程碑仍是单人演示数据：只有项目发起人张一（101）能进入。
  // 其他选手等真实项目接口接入后再按项目成员关系开放，避免看到别人的项目。
  if (!canAccessDemoWorkspace(header.userId)) {
    return (
      <SeasonForbidden
        title="NO PROJECT"
        description="你的赛季项目还没有建立。先去「组队」创建或带入项目；项目成立后，项目成员才能在这里发布赛季作品、提交里程碑。"
        actionHref="/me/team"
        actionLabel="去组队"
      />
    )
  }

  return (
    <SeasonWorkspace
      platformRoles={header.roles}
      seasonRoles={getSeasonRoles(header.userId)}
    />
  )
}
