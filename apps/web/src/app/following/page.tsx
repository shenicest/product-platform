import { PublicInteractionBoundary } from '@/components/public-interaction-boundary'
import { Pagination } from '@/components/pagination'
import { FollowingProjectGrid } from '@/components/following-project-grid'
import { NotFoundShell } from '@/components/not-found-shell'
import { getFollowingProjects } from '@/server/projects'
import { getSessionUser } from '@/server/auth'
import { getMyFollows } from '@/server/interactions'
import { PAGE_SIZE, parseListParams } from '@/lib/project-filters'

export const dynamic = 'force-dynamic'

export default async function FollowingPage(props: PageProps<'/following'>) {
  const [searchParams, user] = await Promise.all([props.searchParams, getSessionUser()])

  if (!user) {
    return (
      <NotFoundShell
        title="登录后查看你的关注"
        description="登录后即可查看你关注的 Founder 发布的所有 Live 项目。"
        href="/login?returnTo=/following"
        linkLabel="登录"
        eyebrow="FOLLOWING"
      />
    )
  }

  const { category, stage, q, sort, page } = parseListParams(searchParams)
  const [{ data: projects, total }, followedFounderUserIds] = await Promise.all([getFollowingProjects({
    category,
    stage,
    q,
    sort,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  }), getMyFollows()])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (projects.length === 0) {
    return (
      <NotFoundShell
        title={followedFounderUserIds.length === 0 ? '你还没有关注任何 Founder' : '暂无可查看的作品'}
        description={followedFounderUserIds.length === 0 ? '关注 Founder 后，他们发布的所有 Live 项目都会汇集在这里。' : '你关注的 Founder 暂时没有符合当前条件的 Live 项目。'}
        href="/"
        linkLabel="去发现"
        eyebrow="FOLLOWING"
      />
    )
  }

  return (
    <PublicInteractionBoundary>
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">FOLLOWING</p>
            <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold leading-[1.15]">关注动态</h1>
          </div>
          <p className="pb-1 font-mono text-xs text-muted-foreground">TOTAL: <b className="font-digits font-normal text-primary">{total}</b> PROJECTS LIVE</p>
        </header>
        <FollowingProjectGrid projects={projects} />
        <Pagination page={page} totalPages={totalPages} searchParams={searchParams} basePath="/following" />
      </section>
    </PublicInteractionBoundary>
  )
}
