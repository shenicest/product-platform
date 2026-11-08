import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { WorkbenchHeader } from '@/components/me/workbench-header'
import { WorkbenchTabs } from '@/components/me/workbench-tabs'
import { getWorkbenchHeader } from '@/server/me'
import { workbenchTabBadges } from '@/lib/me'

export const metadata: Metadata = {
  title: '个人中心',
  description: 'BoomLand 个人中心：报名、组队与赛季进展。',
}

export const dynamic = 'force-dynamic'

/**
 * 个人中心外壳：鉴权 + 页头 + tab 导航。
 *
 * 页头与 tab 在这里渲染一次，9 个 tab 共用 —— 每个 tab 页面只需要关心
 * 自己的内容区。这样切 tab 时页头不会闪、也不会各写一份。
 *
 * `getWorkbenchHeader()` 用 `cache()` 包装，页面里再读一次不会重复发请求。
 *
 * 未登录直接跳登录页并保留 `returnTo`：个人中心的每一屏都需要登录态，
 * 没有一个「公开可见」的降级形态值得单独做。
 */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const data = await getWorkbenchHeader()
  if (!data) redirect(`/login?returnTo=${encodeURIComponent('/me/applications')}`)

  const badges = workbenchTabBadges({
    applicationCount: data.applicationCount,
    needsTeam: data.needsTeam,
  })

  return (
    <main>
      <section className="section section--flush">
        <div className="shell shell--narrow">
          <WorkbenchHeader data={data} />
          <div className="mt-8">
            <WorkbenchTabs badges={badges} />
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </section>
    </main>
  )
}
