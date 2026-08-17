'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Role } from '@shenicest/shared'
import { useAuth } from '@/components/auth-provider'
import { getConnections } from '@/lib/client-api'

export function UserMenu() {
  const { user, loading, logout } = useAuth()
  const [pending, setPending] = useState(0)

  useEffect(() => {
    if (!user) return
    let active = true
    const refresh = async () => {
      const result = await getConnections()
      if (active && result.data) setPending(result.data.pendingReceived)
    }
    void refresh()
    window.addEventListener('talent-connections-refresh', refresh)
    return () => {
      active = false
      window.removeEventListener('talent-connections-refresh', refresh)
    }
  }, [user])

  if (loading) {
    return <span className="font-mono text-xs text-muted-foreground">...</span>
  }

  if (!user) {
    return <Link href="/login" className="btn-hard btn-secondary px-4 py-2 text-xs">登录</Link>
  }

  const isFounder = user.roles?.includes(Role.Founder) ?? false
  const isOperator = user.roles?.includes(Role.Operator) ?? false
  const username = user.email ?? `用户 #${user.user_id}`

  return (
    <details className="relative shrink-0">
      <summary className="list-none cursor-pointer whitespace-nowrap font-mono text-xs text-muted-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
        {username} <span aria-hidden className="text-primary">▾</span>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-3 min-w-48 border border-border bg-background p-2 shadow-[4px_4px_0_var(--border)]">
        <Link href="/connections" className="flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-primary">
          <span>连接记录</span>
          {pending > 0 ? <span aria-label={`${pending} 个待处理连接`} className="ml-4 bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">{pending > 99 ? '99+' : pending}</span> : null}
        </Link>
        <Link href="/talents/me/edit" className="block px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-primary">编辑我的档案</Link>
        {isFounder ? <Link href="/founder/dashboard" className="block px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-primary">创始人后台</Link> : null}
        {isOperator ? <Link href="/operator" className="block px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-primary">运营后台</Link> : null}
        <div className="my-1 border-t border-border" />
        <button onClick={logout} className="block w-full px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-primary">退出登录</button>
      </div>
    </details>
  )
}
