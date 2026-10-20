'use client'

import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { Role } from '@shenicest/shared'
import { Button, ButtonLink } from '@/components/ui/button'
import { Mono } from '@/components/ui/typography'

export function AuthNav() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return <Mono>...</Mono>
  }

  if (!user) {
    return (
      <ButtonLink href="/login" variant="secondary" size="sm">
        登录
      </ButtonLink>
    )
  }

  const isFounder = user.roles?.includes(Role.Founder) ?? false
  const isOperator = user.roles?.includes(Role.Operator) ?? false

  return (
    <div className="flex items-center gap-3">
      {isOperator ? (
        <Link
          href="/operator"
          className="hidden font-mono text-label text-danger transition-colors hover:text-danger-text sm:inline"
        >
          运营后台
        </Link>
      ) : null}
      {isFounder ? (
        <Link
          href="/founder/dashboard"
          className="hidden font-mono text-label text-brand-text transition-colors hover:text-brand sm:inline"
        >
          创始人后台
        </Link>
      ) : null}
      <Mono className="hidden sm:inline">{user.email ?? `#${user.user_id}`}</Mono>
      <Button variant="text" onClick={logout}>
        退出
      </Button>
    </div>
  )
}
