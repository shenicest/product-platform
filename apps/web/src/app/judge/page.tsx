import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { JudgeConsole } from '@/components/judge/judge-console'
import { SeasonForbidden } from '@/components/season/season-forbidden'
import { getSessionUser } from '@/server/auth'
import { SeasonRole, hasSeasonRole } from '@/lib/season-access'
import { NO_INDEX_ROBOTS } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '评委台',
  description: 'BoomLand 赛季评委台：查看参赛候选人、作品与分配余额，完成滚动评分。',
  robots: NO_INDEX_ROBOTS,
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await getSessionUser()
  if (!user) redirect(`/login?returnTo=${encodeURIComponent('/judge')}`)

  // 权限矩阵 4.3：只有拿到本赛季评分授权的评委能进。平台管理员没有
  // 评委授权也不能评分（4.5 第 2 条），所以这里不按平台角色放宽。
  if (!hasSeasonRole(user.userId, SeasonRole.Judge)) {
    return (
      <main>
        <SeasonForbidden
          description="评委台只对获得本赛季评分授权的评委开放。如果你认为自己已有授权，请联系本赛季主办方或平台管理员确认。"
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
          <JudgeConsole />
        </div>
      </section>
    </main>
  )
}
