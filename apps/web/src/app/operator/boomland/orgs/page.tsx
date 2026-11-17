import type { Metadata } from 'next'
import { Role } from '@shenicest/shared'
import { getSessionUser } from '@/server/auth'
import { getPlatformOrgCards } from '@/server/platform-console'
import { OrganizerOrgsView } from '@/components/operator/platform/orgs/org-cards-view'

export const metadata: Metadata = {
  title: '主办方组织与成员 · 平台后台',
}

/**
 * 「主办方组织与成员」tab。
 *
 * 管理员：全部组织、可新建组织与加减成员；
 * 主办方成员：只看自己所属的组织，成员列表只读（后端对写操作也是 `operatorOnly`）。
 *
 * 卡片里的「主办的赛季」来自同一个赛季列表（`getPlatformSeasons`，已 `cache()`），
 * 不额外请求 —— 成员和赛季必须落在同一屏，才能看出「这个组织到底管哪几季」。
 */
export default async function PlatformOrgsPage() {
  const user = await getSessionUser()
  const isOperator = user?.roles.includes(Role.Operator) ?? false

  const cards = await getPlatformOrgCards(isOperator)

  return (
    <OrganizerOrgsView cards={cards.items} isOperator={isOperator} failed={cards.failed} />
  )
}
