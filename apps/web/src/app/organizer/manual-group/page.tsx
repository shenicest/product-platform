import type { Metadata } from 'next'
import { ButtonLink } from '@/components/ui/button'
import {
  ManualGroupForbidden,
  ManualGroupHeader,
  ManualGroupLoadFailed,
  NoSeasonSelected,
} from '@/components/organizer/manual-group/manual-group-display'
import { ManualGroupView } from '@/components/organizer/manual-group/manual-group-view'
import {
  OrganizerApiError,
  getSeasonManageDetail,
  getSeasonParticipants,
  resolveOrganizerSeasonId,
} from '@/server/organizer'
import type { SeasonParticipantsPage } from '@/lib/organizer-manual-group'

export const metadata: Metadata = { title: '人工拉群 · 主办方后台' }

export const dynamic = 'force-dynamic'

type Loaded =
  | { kind: 'ok'; seasonCode: string; participants: SeasonParticipantsPage }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string }

/**
 * 人工拉群 tab（服务端取数）。
 *
 * 取数顺序：
 *   1. 先解析 `?season=`，没选中具体赛季就直接给空态 —— 不白跑两次请求；
 *   2. 赛季详情（拿编号做「赛季标识」列）与选手名单并行取；
 *   3. 名单一次取满一页上限：这一页是「把所有人拉进群」的工作台，分页会让人
 *      漏掉后面的人。选手规模由赛季名额约束（上限 10 万，实际是几十人）。
 *
 * 错误口径：`OrganizerApiError` 的 403 → 无权限卡片，其它 → 读取失败卡片。
 * 注意 try/catch 只包**取数**，不包 JSX：JSX 是延迟渲染的，在里面抛的错不会被
 * 这个 catch 接住（eslint react-hooks/error-boundaries）。
 */
export default async function OrganizerManualGroupPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const rawSeason = searchParams.season
  // 没有 `?season=` 时回落到最新赛季：后台按赛季组织，默认值不该是「未选中」。
  const seasonId = await resolveOrganizerSeasonId(
    Array.isArray(rawSeason) ? rawSeason[0] : rawSeason,
  )

  if (seasonId === null) return <NoSeasonSelected />

  let loaded: Loaded
  try {
    const [detail, participants] = await Promise.all([
      getSeasonManageDetail(seasonId),
      getSeasonParticipants(seasonId, { pageSize: 100 }),
    ])
    loaded = { kind: 'ok', seasonCode: detail.code, participants }
  } catch (error) {
    if (!(error instanceof OrganizerApiError)) throw error
    loaded =
      error.status === 403
        ? { kind: 'forbidden' }
        : { kind: 'failed', message: error.message }
  }

  if (loaded.kind === 'forbidden') {
    return (
      <ManualGroupForbidden
        action={
          <ButtonLink href="/organizer/overview" variant="secondary">
            返回总览
          </ButtonLink>
        }
      />
    )
  }
  if (loaded.kind === 'failed') return <ManualGroupLoadFailed message={loaded.message} />

  return (
    <>
      <ManualGroupHeader code={loaded.seasonCode} />
      <ManualGroupView
        seasonId={seasonId}
        seasonCode={loaded.seasonCode}
        participants={loaded.participants.items}
      />
    </>
  )
}
