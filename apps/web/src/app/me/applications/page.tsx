import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ApplicationsTable } from '@/components/me/applications-table'
import { PublicSeasonGrid } from '@/components/me/public-season-grid'
import { Pagination } from '@/components/pagination'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import { getMyApplications, getSeasons } from '@/server/boomland'
import {
  MY_APPLICATIONS_PAGE_SIZE,
  PUBLIC_SEASON_LIMIT,
  parseApplicationsPage,
} from '@/lib/me-applications'
import type { SearchParams } from '@/lib/project-filters'

export const metadata = { title: '报名 · 个人中心' }
export const dynamic = 'force-dynamic'

/** 公开可报名的赛季：后端 `listPublic` 只返回已批准未取消的赛季。 */
const PUBLIC_SEASON_STATUS = 'upcoming,active'

/**
 * 个人中心「报名」tab。
 *
 * 两块内容，从上到下：
 *   1. 我提交过的报名（7 列表格 + 一行规则说明）；
 *   2. 公开的赛季（可报名赛季的卡片列表）。
 *
 * 两块各自独立取数、各自包一层 `<Suspense>`：报名列表翻页时不该让
 * 下面的赛季卡片一起回到骨架屏，反之亦然。
 *
 * 每一块都有三态：
 *   · loading —— Suspense fallback 的骨架占位；
 *   · empty   —— `EmptyState`，文案说明「为什么这里是空的」；
 *   · error   —— 页面级提示 + 「重新加载」，不把整页变成错误页。
 *
 * 鉴权在外壳（`app/me/layout.tsx`）里已经做过一次；这里再读一次 cookie
 * 只是为了在**页面被单独渲染**时也不至于对未登录用户发请求。外壳重定向
 * 保留 `returnTo`，所以两处指向同一屏。
 */
export default async function MeApplicationsPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const token = (await cookies()).get('shenicest_token')?.value
  if (!token) redirect(`/login?returnTo=${encodeURIComponent('/me/applications')}`)

  const searchParams = await props.searchParams
  const page = parseApplicationsPage(searchParams)
  // 报名表单提交成功后会跳回 `?applied=1` —— 保留这条确认提示，
  // 否则用户点完「提交报名」落回本页时看不出到底成功没有。
  const applied = searchParams.applied === '1'

  return (
    <div className="mt-10">
      <header className="mb-6">
        <Eyebrow tone="accent">MY / APPLICATIONS</Eyebrow>
        <h2 className="page-title mt-3">报名</h2>
        <p className="page-lead">
          你提交过的赛季报名与审核进度。审核前可以随时撤回；通过后主办方会邀请你加入赛季微信群，组队结果以群内登记为准。
        </p>
      </header>

      {applied ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-brand-line bg-brand-wash px-4 py-3 text-body-sm text-brand-text"
        >
          报名已提交，等待主办方审核。
        </p>
      ) : null}

      <Suspense fallback={<ApplicationsTableSkeleton />}>
        <ApplicationsSection page={page} searchParams={searchParams} />
      </Suspense>

      <section className="mt-16" aria-labelledby="public-seasons-heading">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 id="public-seasons-heading" className="text-h3 font-bold text-foreground">
              公开的赛季
            </h3>
            <p className="mt-2 max-w-[52ch] text-body-sm leading-[1.85] text-muted-foreground">
              正在报名或即将开放的赛季。报名通过后名额才会被占用。
            </p>
          </div>
          <ButtonLink href="/seasons" variant="ghost" size="sm">
            全部赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
          </ButtonLink>
        </div>

        <Suspense fallback={<PublicSeasonGridSkeleton />}>
          <PublicSeasonsSection />
        </Suspense>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 已报名
// ---------------------------------------------------------------------------

async function ApplicationsSection({
  page,
  searchParams,
}: {
  page: number
  searchParams: SearchParams
}) {
  let list
  try {
    list = await getMyApplications({ page, pageSize: MY_APPLICATIONS_PAGE_SIZE })
  } catch {
    return <SectionLoadFailed what="报名记录" />
  }

  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize))

  return (
    <section aria-labelledby="my-applications-heading">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="my-applications-heading" className="text-h3 font-bold text-foreground">
          我的报名
        </h3>
        <span className="section-head__aside">
          TOTAL:
          <b className="font-digits text-lg font-normal text-brand-text">{list.total}</b>
          APPLICATIONS
        </span>
      </div>

      <ApplicationsTable items={list.items} />

      <Pagination
        page={list.page}
        totalPages={totalPages}
        searchParams={searchParams}
        basePath="/me/applications"
      />
    </section>
  )
}

function ApplicationsTableSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">正在加载报名记录…</span>
      <Panel className="min-h-40" aria-hidden>
        <span className="ui-panel__label">LOADING / APPLICATIONS</span>
        <div className="grid gap-3">
          {[0, 1, 2].map((index) => (
            <span key={index} className="block h-8 rounded-md bg-muted" />
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 公开赛季
// ---------------------------------------------------------------------------

async function PublicSeasonsSection() {
  let list
  try {
    list = await getSeasons({
      status: PUBLIC_SEASON_STATUS,
      pageSize: PUBLIC_SEASON_LIMIT,
    })
  } catch {
    return <SectionLoadFailed what="公开赛季" />
  }

  return <PublicSeasonGrid seasons={list.items} />
}

function PublicSeasonGridSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">正在加载公开赛季…</span>
      <div className="card-grid" aria-hidden>
        {[0, 1, 2].map((index) => (
          <Panel key={index} className="min-h-48">
            <span className="ui-panel__label">LOADING / SEASON</span>
          </Panel>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 错误态
// ---------------------------------------------------------------------------

/**
 * 单块读取失败。
 *
 * 只让**这一块**降级，不把整页变成错误页 —— 报名记录挂了不代表公开赛季
 * 也挂了，两块的数据源本来就是两个接口。「重新加载」是链接而不是按钮：
 * Server Component 里没有事件处理器，重新渲染就是重新请求，
 * 一个指向当前路由的链接已经足够（这里不带上 searchParams 以外的状态）。
 */
function SectionLoadFailed({ what }: { what: string }) {
  return (
    <EmptyState
      title="LOAD FAILED"
      description={`读取${what}失败，请稍后重新加载。`}
      action={
        <ButtonLink href="/me/applications" variant="secondary">
          重新加载 <span className="ui-btn__arrow" aria-hidden>→</span>
        </ButtonLink>
      }
    />
  )
}
