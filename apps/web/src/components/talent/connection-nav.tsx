'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { getConnections } from '@/lib/client-api'

export function ConnectionNav() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [pending, setPending] = useState(0)
  useEffect(() => {
    if (!user) return
    let active = true
    const refresh = async () => { const result = await getConnections(); if (active && result.data) setPending(result.data.pendingReceived) }
    void refresh()
    window.addEventListener('talent-connections-refresh', refresh)
    return () => { active = false; window.removeEventListener('talent-connections-refresh', refresh) }
  }, [pathname, user])
  if (!user) return null
  return <Link href="/connections" className="relative whitespace-nowrap transition-colors hover:text-primary">连接记录{pending > 0 && <span aria-label={`${pending} 个待处理连接`} className="ml-1 inline-flex min-w-5 items-center justify-center bg-primary px-1 font-mono text-[10px] text-primary-foreground">{pending > 99 ? '99+' : pending}</span>}</Link>
}
