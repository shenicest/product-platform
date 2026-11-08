import type { Metadata } from 'next'
import { SeasonStatus } from '@shenicest/shared'
import { ButtonLink } from '@/components/ui/button'
import { Pagination } from '@/components/pagination'
import {
  ApplicationsHeader,
  NoSeasonSelectedForReview,
  ReviewEmpty,
  ReviewForbidden,
  ReviewLoadFailed,
} from '@/components/organizer/applications/applications-display'
import { ApplicationFilterBar } from '@/components/organizer/applications/application-filter-bar'
import { ApplicationReviewView } from '@/components/organizer/applications/application-review-view'
import {
  APPLICATION_REVIEW_PAGE_SIZE,
  DEFAULT_REVIEW_STATUS_FILTER,
  parseApplicationReviewParams,
  reviewFilterDescription,
  summarizeApplicationReview,
  type ApplicationListPage,
} from '@/lib/organizer-applications'
import { parseSeasonId } from '@/lib/organizer'
import {
  OrganizerApiError,
  getSeasonApplications,
  getSeasonManageDetail,
} from '@/server/organizer'
import type { SeasonManageDetail } from '@/lib/organizer'

export const metadata: Metadata = { title: '报名审核 · 主办方后台' }

export const dynamic = 'force-dynamic'

type Loaded =
  | {
      kind: 'ok'
      detail: SeasonManageDetail
      applications: ApplicationListPage
      waitlistedCount: number
    }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string }

/**
 * 报名审核 tab（服务端取数）。
 *
 * 取数顺序：
 *   1. 先解析 `?season=`，没选中具体赛季就直接给空态 —— 审核队列是按赛季的；
 *   2. detail 与队列并行取；候补数单独取一页 `status=waitlisted` 的 `total`
 *      （后端没有单独的计数接口，取 pageSize=1 只回一个数字，代价最小）；
 *   3. 候补数读失败降级成 0：它是统计卡上的一格，不该拖垮整页。
 *
 * 错误口径：`OrganizerApiError` 的 403 → 无权限卡片（带返回总览的入口），
 * 其它 → 读取失败卡片。
 *
 * 注意 try/catch 只包**取数**，不包 JSX：JSX 是延迟渲染的，在里面抛的错
 * 不会被这个 catch 接住（eslint react-hooks/error-boundaries）。
 */
export default async function OrganizerApplicationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const rawSeason = searchParams.season
  const seasonId = parseSeasonId(Array.isArray(rawSeason) ? rawSeason[0] : rawSeason)
  const params = parseApplicationReviewParams(searchParams)

  if (seasonId === null) return <NoSeasonSelectedForReview />

  let loaded: Loaded
  try {
    const [detail, applications, waitlisted] = await Promise.all([
      getSeasonManageDetail(seasonId),
      getSeasonApplications(seasonId, {
        status: params.status,
        visibility: params.visibility,
        q: params.q,
        page: params.page,
        pageSize: APPLICATION_REVIEW_PAGE_SIZE,
      }),
      getSeasonApplications(seasonId, {
        status: 'waitlisted',
        page: 1,
        pageSize: 1,
      }).catch((): ApplicationListPage | null => null),
    ])
    loaded = {
      kind: 'ok',
      detail,
      applications,
      waitlistedCount: waitlisted?.total ?? 0,
    }
  } catch (error) {
    if (!(error instanceof OrganizerApiError)) throw error
    loaded = error.status === 403
      ? { kind: 'forbidden' }
      : { kind: 'failed', message: error.message }
  }

  if (loaded.kind === 'forbidden') {
    return (
      <ReviewForbidden
        action={
          <ButtonLink href="/organizer/overview" variant="secondary">
            返回总览
          </ButtonLink>
        }
      />
    )
  }
  if (loaded.kind === 'failed') return <ReviewLoadFailed message={loaded.message} />

  const { detail, applications } = loaded
  const stats = summarizeApplicationReview({
    participantCapacity: detail.participantCapacity,
    participantCount: detail.participantCount,
    waitlistedCount: loaded.waitlistedCount,
    applicationWindow: detail.applicationWindow,
    seasonStatus: detail.status,
  })

  return (
    <>
      <ApplicationsHeader code={detail.code} name={detail.name} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <ApplicationFilterBar seasonId={seasonId} params={params} />
      </div>

      {applications.items.length === 0 ? (
        <ReviewEmpty
          description={
            params.statusFilter === 'submitted'
              ? '没有待处理的报名。'
              : `「${reviewFilterDescription(params.statusFilter)}」下还没有报名。`
          }
        />
      ) : (
        <ApplicationReviewView
          seasonId={seasonId}
          items={applications.items}
          stats={stats}
          statusFilter={params.statusFilter}
          actionsLocked={detail.status === SeasonStatus.Cancelled}
        />
      )}

      <Pagination
        page={applications.page}
        totalPages={Math.max(1, Math.ceil(applications.total / APPLICATION_REVIEW_PAGE_SIZE))}
        searchParams={{
          season: String(seasonId),
          ...(params.statusFilter === DEFAULT_REVIEW_STATUS_FILTER
            ? {}
            : { status: params.statusFilter }),
        }}
        basePath="/organizer/applications"
      />
    </>
  )
}
