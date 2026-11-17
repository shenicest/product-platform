import type { Metadata } from 'next'
import { Role } from '@shenicest/shared'
import { getSessionUser } from '@/server/auth'
import { getOrganizerOrgOptions } from '@/server/organizer'
import { getPlatformSeasons } from '@/server/platform-console'
import { SeasonGovernanceView } from '@/components/operator/platform/seasons/governance-view'

export const metadata: Metadata = {
  title: '赛季治理 · 平台后台',
}

/**
 * 「赛季治理」tab：待批准队列 + 全部赛季。
 *
 * 取数口径按身份分叉（见 `server/platform-console.ts`）：管理员看全平台，
 * 主办方成员只看自己组织的赛季 —— 后端已经按组织成员关系过滤，前端不再二次筛选。
 */
export default async function PlatformSeasonsPage() {
  const user = await getSessionUser()
  const isOperator = user?.roles.includes(Role.Operator) ?? false

  const [seasons, organizerOrgs] = await Promise.all([
    getPlatformSeasons(isOperator),
    getOrganizerOrgOptions({ isOperator }),
  ])

  return (
    <SeasonGovernanceView
      seasons={seasons.items}
      organizerOrgs={organizerOrgs}
      isOperator={isOperator}
      failed={seasons.failed}
    />
  )
}
