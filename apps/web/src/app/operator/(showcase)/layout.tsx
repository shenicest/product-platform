import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Role } from '@shenicest/shared'
import { NO_INDEX_ROBOTS } from '@/lib/site-metadata'
import { getSessionUser } from '@/server/auth'
import { Eyebrow } from '@/components/ui/typography'

export const metadata: Metadata = {
  title: '运营后台',
  description: 'Shenicest 运营后台：项目、提案、精选与审计。',
  // 后台依赖登录态与角色，不应该出现在搜索结果和分享卡片里。
  robots: NO_INDEX_ROBOTS,
}

const NAV_ITEMS = [
  { href: '/operator', label: '总览' },
  { href: '/operator/projects', label: '项目' },
  { href: '/operator/featured', label: '精选' },
  { href: '/operator/proposals', label: '提案' },
  { href: '/operator/audit-records', label: '审计' },
  { href: '/operator/talents', label: '人才' },
]

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (!user.roles.includes(Role.Operator)) {
    redirect('/')
  }

  return (
    <div className="shell shell--narrow py-8 sm:py-10">
      <header className="mb-8">
        <Eyebrow>OPERATOR CONSOLE</Eyebrow>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] leading-[1.1] font-bold">
          运营后台
        </h1>
      </header>
      <nav className="console-nav" aria-label="运营后台导航">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="ui-btn ui-btn--ghost ui-btn--small">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
