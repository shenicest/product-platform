import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Role } from '@shenicest/shared'
import { getSessionUser } from '@/server/auth'
import { Eyebrow } from '@/components/ui/typography'

const NAV_ITEMS = [
  { href: '/operator', label: '总览' },
  { href: '/operator/projects', label: '项目' },
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
