import type { Metadata } from 'next'
import { ButtonLink } from '@/components/ui/button'
import {
  ChallengesForbidden,
  ChallengesHeader,
  ChallengesLoadFailed,
  ChallengesNoSeason,
} from '@/components/organizer/challenges/challenges-display'
import { ChallengesView } from '@/components/organizer/challenges/challenges-view'
import {
  OrganizerApiError,
  getSeasonChallengesForOrganizer,
  getSeasonCooperations,
  getSeasonManageDetail,
} from '@/server/organizer'
import { parseSeasonId } from '@/lib/organizer'
import type { SeasonManageDetail } from '@/lib/organizer'
import type { ChallengeDto, EnterpriseCooperationDto } from '@/lib/organizer-challenges'

export const metadata: Metadata = { title: '命题与资源 · 主办方后台' }

export const dynamic = 'force-dynamic'

type Loaded =
  | {
      kind: 'ok'
      detail: SeasonManageDetail
      challenges: ChallengeDto[]
      cooperations: EnterpriseCooperationDto[]
    }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string }

/**
 * 命题与资源 tab（服务端取数）。
 *
 * 取数顺序：
 *   1. 先解析 `?season=`，没选中具体赛季就直接给空态 —— 命题库是按赛季的；
 *   2. detail 与命题库并行取；命题库的 403 会冒泡到 catch（权限是硬条件，
 *      读不到就不能假装是空库）；
 *   3. 企业合作配置失败降级成空数组：它是表格下面的一节，读不到就给空态，
 *      不该拖垮整页。
 *
 * 错误口径：`OrganizerApiError` 的 403 → 无权限卡片（带返回总览的入口），
 * 其它 → 读取失败卡片。
 *
 * 注意 try/catch 只包**取数**，不包 JSX：JSX 是延迟渲染的，在里面抛的错
 * 不会被这个 catch 接住（eslint react-hooks/error-boundaries）。
 */
export default async function OrganizerChallengesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const rawSeason = searchParams.season
  const seasonId = parseSeasonId(Array.isArray(rawSeason) ? rawSeason[0] : rawSeason)

  if (seasonId === null) return <ChallengesNoSeason />

  let loaded: Loaded
  try {
    const [detail, challenges, cooperations] = await Promise.all([
      getSeasonManageDetail(seasonId),
      getSeasonChallengesForOrganizer(seasonId),
      getSeasonCooperations(seasonId),
    ])
    loaded = { kind: 'ok', detail, challenges, cooperations }
  } catch (error) {
    if (!(error instanceof OrganizerApiError)) throw error
    loaded = error.status === 403
      ? { kind: 'forbidden' }
      : { kind: 'failed', message: error.message }
  }

  if (loaded.kind === 'forbidden') {
    return (
      <ChallengesForbidden
        action={
          <ButtonLink href="/organizer/overview" variant="secondary">
            返回总览
          </ButtonLink>
        }
      />
    )
  }
  if (loaded.kind === 'failed') return <ChallengesLoadFailed message={loaded.message} />

  const { detail, challenges, cooperations } = loaded

  return (
    <>
      <ChallengesHeader code={detail.code} name={detail.name} />
      <ChallengesView
        seasonId={seasonId}
        seasonName={detail.name}
        themes={detail.themes}
        organizerNames={detail.organizerOrgs.map((org) => org.name)}
        challenges={challenges}
        cooperations={cooperations}
      />
    </>
  )
}
