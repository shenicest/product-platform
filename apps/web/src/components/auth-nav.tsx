'use client'

import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { Role } from '@shenicest/shared'

export function AuthNav() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        ...
      </span>
    )
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="btn-hard btn-secondary px-4 py-2 text-xs"
      >
        登录
      </Link>
    )
  }

  const isFounder = user.roles?.includes(Role.Founder) ?? false
  const isOperator = user.roles?.includes(Role.Operator) ?? false

  return (
    <div className="flex items-center gap-3">
      {isOperator ? (
        <Link
          href="/operator"
          className="hidden font-mono text-xs text-destructive transition-colors hover:text-destructive/80 sm:inline"
        >
          运营后台
        </Link>
      ) : null}
      {isFounder ? (
        <Link
          href="/founder/dashboard"
          className="hidden font-mono text-xs text-primary transition-colors hover:text-primary/80 sm:inline"
        >
          创始人后台
        </Link>
      ) : null}
      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
        {user.email ?? `#${user.user_id}`}
      </span>
      <button
        onClick={logout}
        className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        退出
      </button>
    </div>
  )
}
