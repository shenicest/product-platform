import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Role } from '@shenicest/shared'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/surface'
import { PlatformSeasonPreviewView } from '@/components/operator/platform/seasons/season-preview'
import { getSessionUser } from '@/server/auth'
import { OrganizerApiError } from '@/server/organizer'
import { getPlatformSeasonPreview, type PlatformSeasonPreviewData } from '@/server/platform-console'

export const metadata: Metadata = { title: '赛季预览 · 平台后台' }

export const dynamic = 'force-dynamic'

type Loaded =
  | { kind: 'ok'; data: PlatformSeasonPreviewData }
  | { kind: 'forbidden' }
  | { kind: 'failed'; message: string }

/**
 * 赛季预览页（「赛季治理」→ 预览）。
 *
 * 待批赛季的公开页对所有人都是 404（`approvedAt` 为空就不公开），所以这里走
 * **管理视图**取数，再用公开页组件渲染 —— 审批人看到的正是批准后会公开的那一屏。
 *
 * 错误口径与主办方后台一致：`getSeasonManageDetail` 抛 `OrganizerApiError`，
 * 403 → 无权限卡片（该赛季不属于你能管的组织），404 → `notFound()`，
 * 其它 → 读取失败卡片。try/catch 只包取数，不包 JSX。
 */
export default async function PlatformSeasonPreviewPage(
  props: PageProps<'/operator/boomland/seasons/[id]'>,
) {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) notFound()
  const seasonId = Number(rawId)

  const user = await getSessionUser()
  const isOperator = user?.roles.includes(Role.Operator) ?? false

  let loaded: Loaded
  try {
    loaded = { kind: 'ok', data: await getPlatformSeasonPreview(seasonId) }
  } catch (error) {
    if (!(error instanceof OrganizerApiError)) throw error
    if (error.status === 404) notFound()
    loaded = error.status === 403
      ? { kind: 'forbidden' }
      : { kind: 'failed', message: error.message }
  }

  if (loaded.kind === 'forbidden') {
    return (
      <EmptyState
        title="FORBIDDEN"
        description="该赛季不属于你所属主办方组织被指定的赛季，无法查看它的管理视图。跨赛季的权限一律无效。"
        action={
          <ButtonLink href="/operator/boomland/seasons" variant="secondary">
            返回赛季治理
          </ButtonLink>
        }
      />
    )
  }
  if (loaded.kind === 'failed') {
    return (
      <EmptyState
        title="LOAD FAILED"
        description={`赛季读取失败：${loaded.message}。可以刷新重试，或先回赛季治理列表。`}
        action={
          <ButtonLink href="/operator/boomland/seasons" variant="secondary">
            返回赛季治理
          </ButtonLink>
        }
      />
    )
  }

  return <PlatformSeasonPreviewView data={loaded.data} isOperator={isOperator} />
}
