import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { FounderApiError, getFounderProjects, getFounderStats, type FounderProjectQuery } from '@/server/founder'
import { FounderDashboard } from '@/components/founder/founder-dashboard'
import {
  FOUNDER_PAGE_SIZE,
  parseFounderParams,
} from '@/lib/founder-filters'

export const metadata: Metadata = {
  title: '创始人后台',
  description: '管理你提交的项目、查看审核状态和统计数据。',
}

export const dynamic = 'force-dynamic'

interface FounderDashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function FounderDashboardPage(
  props: FounderDashboardPageProps
) {
  const searchParams = await props.searchParams
  const { status, q, page } = parseFounderParams(searchParams)

  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value

  // Unauthenticated users are redirected by middleware; this guard handles
  // malformed or missing cookies in edge cases.
  if (!token) {
    redirect('/login')
  }

  let isFounder = false
  let projects: Awaited<ReturnType<typeof getFounderProjects>> = { data: [], total: 0 }
  let stats: Awaited<ReturnType<typeof getFounderStats>> = {
    totalProjects: 0,
    liveProjects: 0,
    pendingReviewProjects: 0,
  }

  try {
    // Seed data sets the founder role for the default user, so this usually
    // succeeds in development. In production, non-founders see the dashboard
    // empty state with a CTA to submit their first project.
    stats = await getFounderStats()
    const query: FounderProjectQuery = {
      status,
      q,
      offset: (page - 1) * FOUNDER_PAGE_SIZE,
      limit: FOUNDER_PAGE_SIZE,
    }
    projects = await getFounderProjects(query)
    isFounder = true
  } catch (err) {
    // 403 from the founder endpoints means the user is authenticated but not a
    // founder. Render the empty-state CTA instead of the dashboard.
    if (err instanceof FounderApiError && err.status === 403) {
      isFounder = false
    } else {
      throw err
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="eyebrow">FOUNDER DASHBOARD</p>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1]">
          创始人后台
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-[1.7] text-muted-foreground">
          管理你提交的项目，追踪审核进度，并随时更新项目信息。
        </p>
      </header>

      <FounderDashboard
        initialProjects={projects.data}
        total={projects.total}
        params={{ status, q, page }}
        stats={stats}
        isFounder={isFounder}
      />
    </div>
  )
}
