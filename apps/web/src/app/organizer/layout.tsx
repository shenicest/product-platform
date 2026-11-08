import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Role } from '@shenicest/shared'
import { getSessionUser } from '@/server/auth'
import { getManagedSeasons, getOrganizerOrgOptions } from '@/server/organizer'
import { OrganizerShell } from '@/components/organizer/organizer-shell'
import { canAccessOrganizerConsole } from '@/lib/organizer-access'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: '主办方后台',
  description: 'BoomLand 赛季主办方后台：赛季草稿、报名审核、命题与预算。',
}

export const dynamic = 'force-dynamic'

/**
 * 主办方后台外壳：鉴权 + 页头 +（客户端）赛季选择器 / 操作按钮 / tabs。
 *
 * 准入口径与后端一致，但分两档（见 `lib/organizer-access.ts`）：
 *   · 本地调试（非生产构建）：所有已登录账号都可以进来，方便调页面；
 *   · 生产：平台管理员（Operator）或至少属于一个主办方组织的用户。
 * 菜单入口由 `UserMenu` 按同一套常量隐藏，“入口可见”与“页面可进”不会错位。
 *
 * 后端在每一种写操作上还会再校验一次角色，所以本地“开放看”不等于“开放改”。
 *
 * layout 不接 `searchParams`（Next 约定：layout 不随 query 重渲染），
 * 选中赛季由 `OrganizerShell` 在客户端读取。赛季列表也只在这里取一次，
 * 交给客户端复用 —— 它同时是选择器的选项和“复制上季”的源。
 */
export default async function OrganizerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect(`/login?returnTo=${encodeURIComponent('/organizer/overview')}`)

  const isOperator = user.roles.includes(Role.Operator)
  const orgOptions = await getOrganizerOrgOptions({ isOperator }).catch(() => [])

  if (!canAccessOrganizerConsole({
    isLoggedIn: true,
    isOperator,
    isOrganizerMember: orgOptions.length > 0,
  })) {
    return <NoOrganizerAccess />
  }

  const seasonPage = await getManagedSeasons().catch(() => null)
  const seasons = (seasonPage?.items ?? []).map(({ id, name, code }) => ({ id, name, code }))

  return (
    <div className="shell shell--narrow py-8 sm:py-10">
      <header className="mb-6">
        <Eyebrow>ORGANIZER CONSOLE</Eyebrow>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] leading-[1.1] font-bold">主办方后台</h1>
        <p className="page-lead">
          管理你在 BoomLand 上主办的赛季：先建草稿，逐步补齐赛程、命题、评委与预算，再提交待批。
        </p>
      </header>

      <OrganizerShell seasons={seasons} organizerOrgs={orgOptions}>
        {children}
      </OrganizerShell>
    </div>
  )
}

/** 非主办方：说明为什么进不来，以及该找谁。 */
function NoOrganizerAccess() {
  return (
    <div className="shell shell--narrow py-16">
      <EmptyState
        title="FORBIDDEN"
        description="你还不属于任何主办方组织，暂时无法进入主办方后台。请联系平台管理员把你加入对应组织后再试。"
        action={
          <ButtonLink href="/" variant="secondary">
            返回首页
          </ButtonLink>
        }
      />
    </div>
  )
}
