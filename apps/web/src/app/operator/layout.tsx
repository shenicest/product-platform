import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Role } from '@shenicest/shared'
import { fetchCurrentUser } from '@/lib/auth-token'

const NAV_ITEMS = [
  { href: '/operator', label: '总览' },
  { href: '/operator/projects', label: '项目' },
  { href: '/operator/proposals', label: '提案' },
  { href: '/operator/audit-records', label: '审计' },
]

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  if (!token) redirect('/login')

  const user = await fetchCurrentUser()
  if (!user || !user.roles?.includes(Role.Operator)) {
    redirect('/')
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="eyebrow">OPERATOR CONSOLE</p>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1]">
          运营后台
        </h1>
      </header>
      <nav className="mb-8 flex flex-wrap items-center gap-1 border-b border-border pb-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="btn-hard btn-ghost px-4 py-2 text-xs"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
