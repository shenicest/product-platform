import type { Metadata } from 'next'
import { Role } from '@shenicest/shared'
import { ButtonLink } from '@/components/ui/button'
import {
  NoSeasonSelected,
  SeasonForbidden,
  SeasonLoadFailed,
  SeasonSettingsHeader,
} from '@/components/organizer/season-settings/season-settings-display'
import { SeasonSettingsView } from '@/components/organizer/season-settings/season-settings-view'
import { getSessionUser } from '@/server/auth'
import { getSeasonAnnouncements } from '@/server/boomland'
import {
  OrganizerApiError,
  getOrganizerOrgOptions,
  getSeasonManageDetail,
  getSeasonReadiness,
  resolveOrganizerSeasonId,
} from '@/server/organizer'
import { toSeasonSettingsDetail, type SeasonSettingsDetail } from '@/lib/organizer-settings'
import type { SeasonAnnouncement } from '@/lib/boomland'
import type { OrganizerOrg, SeasonReadiness } from '@/lib/organizer'

export const metadata: Metadata = { title: '赛季设置 · 主办方后台' }

export const dynamic = 'force-dynamic'

type Loaded =
  | {
      kind: 'ok'
      detail: SeasonSettingsDetail
      readiness: SeasonReadiness | null
      announcements: SeasonAnnouncement[]
      organizerOrgs: OrganizerOrg[]
    }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string }

/**
 * 赛季设置 tab（服务端取数）。
 *
 * 取数顺序：
 *   1. 先解析 `?season=`，没选中具体赛季就直接给空态 —— 不白跑三次请求；
 *   2. detail 与 readiness 并行取；readiness 失败降级成 null（页面显示
 *      「门槛暂时读不到」，其余部分照常可用）；
 *   3. 公告单独取，失败降级成空数组（公告是附属信息，不该拖垮整页）。
 *
 * 错误口径：`getSeasonManageDetail` 抛 `OrganizerApiError`，
 * 403 → 无权限卡片（带返回总览的入口），其它 → 读取失败卡片。
 *
 * 注意 try/catch 只包**取数**，不包 JSX：JSX 是延迟渲染的，
 * 在里面抛的错不会被这个 catch 接住（eslint react-hooks/error-boundaries）。
 */
export default async function OrganizerSeasonSettingsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const rawSeason = searchParams.season
  // 没有 `?season=` 时回落到最新赛季：后台按赛季组织，默认值不该是「未选中」。
  const seasonId = await resolveOrganizerSeasonId(
    Array.isArray(rawSeason) ? rawSeason[0] : rawSeason,
  )

  if (seasonId === null) return <NoSeasonSelected />

  const user = await getSessionUser()
  const isOperator = Boolean(user?.roles.includes(Role.Operator))

  let loaded: Loaded
  try {
    const [rawDetail, readiness, announcements, organizerOrgs] = await Promise.all([
      getSeasonManageDetail(seasonId),
      getSeasonReadiness(seasonId).catch(() => null),
      getSeasonAnnouncements(seasonId).catch((): SeasonAnnouncement[] => []),
      getOrganizerOrgOptions({ isOperator }).catch(() => []),
    ])
    loaded = {
      kind: 'ok',
      detail: toSeasonSettingsDetail(rawDetail),
      readiness,
      announcements,
      organizerOrgs,
    }
  } catch (error) {
    if (!(error instanceof OrganizerApiError)) throw error
    loaded = error.status === 403
      ? { kind: 'forbidden' }
      : { kind: 'failed', message: error.message }
  }

  if (loaded.kind === 'forbidden') {
    return (
      <SeasonForbidden
        action={
          <ButtonLink href="/organizer/overview" variant="secondary">
            返回总览
          </ButtonLink>
        }
      />
    )
  }
  if (loaded.kind === 'failed') return <SeasonLoadFailed message={loaded.message} />

  return (
    <>
      <SeasonSettingsHeader code={loaded.detail.code} />
      <SeasonSettingsView
        detail={loaded.detail}
        readiness={loaded.readiness}
        announcements={loaded.announcements}
        organizerOrgs={loaded.organizerOrgs}
        isOperator={isOperator}
      />
    </>
  )
}
