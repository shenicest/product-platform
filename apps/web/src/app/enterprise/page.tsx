import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { EnterpriseConsole } from '@/components/enterprise/enterprise-console'
import { SeasonForbidden } from '@/components/season/season-forbidden'
import { getSessionUser } from '@/server/auth'
import { SeasonRole, hasSeasonRole } from '@/lib/season-access'
import { NO_INDEX_ROBOTS } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '企业命题台',
  description: 'BoomLand 企业命题台：查看本企业命题下的项目、作品与评分。',
  robots: NO_INDEX_ROBOTS,
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await getSessionUser()
  if (!user) redirect(`/login?returnTo=${encodeURIComponent('/enterprise')}`)

  // 权限矩阵 4.3：企业命题报告只对企业合作方开放，且只能看本企业命题。
  // 普通用户 / 赛季选手只应看到公开摘要，不能进企业视图。
  if (!hasSeasonRole(user.userId, SeasonRole.Enterprise)) {
    return (
      <main>
        <SeasonForbidden
          description="企业命题台只对已登记的企业合作方开放，且仅展示本企业命题下的项目、作品与报告。其他身份请在命题详情页查看公开摘要。"
          actionHref="/seasons"
          actionLabel="回到火热赛季"
        />
      </main>
    )
  }

  return (
    <main>
      <section className="section section--flush">
        <div className="shell shell--narrow py-8 sm:py-10">
          <EnterpriseConsole />
        </div>
      </section>
    </main>
  )
}
