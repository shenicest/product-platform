import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Role } from '@shenicest/shared'
import { getSessionUser } from '@/server/auth'
import { getOrganizerOrgOptions } from '@/server/organizer'
import { canAccessPlatformConsole, READ_ONLY_SCOPE_NOTE } from '@/lib/platform-console'
import { NO_INDEX_ROBOTS } from '@/lib/site-metadata'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import { PlatformTabs } from '@/components/operator/platform/platform-tabs'

export const metadata: Metadata = {
  title: '平台后台',
  description: 'BoomLand 平台后台：赛季治理、主办方组织与成员、审计。',
  // 后台依赖登录态与平台角色，不应该出现在搜索结果和分享卡片里。
  robots: NO_INDEX_ROBOTS,
}

export const dynamic = 'force-dynamic'

/**
 * 平台后台外壳：鉴权 + 页头 + tab 导航。
 *
 * 准入口径（见 `lib/platform-console.ts`）：
 *   · 平台管理员（`Role.Operator`）：全功能；
 *   · 主办方组织成员：可以进来看自己组织的赛季与成员，但写操作全部禁用
 *     （批准 / 驳回、建组织、加减成员都是管理员权限，后端也是这么判的）。
 *
 * 为什么不挂在 `/operator` 的 layout 下？
 * 那一层是展示平台的运营后台，只对 `Role.Operator` 开放；平台后台要让主办方
 * 成员也能进，两条准入规则方向不同。所以展示平台后台整体挪进 `(showcase)`
 * 路由组，各自保留自己的 layout —— URL 不变，准入互不影响。
 */
export default async function PlatformBoomlandLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect(`/login?returnTo=${encodeURIComponent('/operator/boomland/seasons')}`)

  const isOperator = user.roles.includes(Role.Operator)
  // 管理员不需要查组织归属（全平台都能管）；主办方成员要靠它判断「是不是成员」。
  const orgOptions = isOperator
    ? []
    : await getOrganizerOrgOptions({ isOperator: false }).catch(() => [])
  const isOrganizerMember = orgOptions.length > 0

  if (!canAccessPlatformConsole({ isLoggedIn: true, isOperator, isOrganizerMember })) {
    return <NoPlatformAccess />
  }

  return (
    <div className="shell shell--narrow py-8 sm:py-10">
      <header className="mb-6">
        <Eyebrow>PLATFORM CONSOLE</Eyebrow>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] leading-[1.1] font-bold">平台后台</h1>
        <p className="page-lead">
          批准赛季发布、维护主办方组织与成员。批准前赛季不会出现在公开列表；所有写操作都会留下审计记录。
        </p>
        {isOperator ? null : (
          <p className="ui-note ui-note--warning mt-4" role="note">
            {READ_ONLY_SCOPE_NOTE}
          </p>
        )}
      </header>

      <PlatformTabs />
      {children}
    </div>
  )
}

/** 非管理员、也不属于任何主办方组织：说明为什么进不来，以及该找谁。 */
function NoPlatformAccess() {
  return (
    <div className="shell shell--narrow py-16">
      <EmptyState
        title="FORBIDDEN"
        description="平台后台只对平台管理员和主办方组织成员开放。请联系平台管理员把你加入对应组织后再试。"
        action={
          <ButtonLink href="/" variant="secondary">
            返回首页
          </ButtonLink>
        }
      />
    </div>
  )
}
