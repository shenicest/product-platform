'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Role } from '@shenicest/shared'
import { useAuth } from '@/components/auth-provider'
import { getConnections } from '@/lib/client-api'
import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Card } from '@/components/ui/surface'
import { Mono } from '@/components/ui/typography'

/**
 * 下拉菜单里的一行。
 *
 * 站内没有 `.ui-menu` 这类组件类，而 `.ui-btn` 的胶囊内边距也不适合
 * 纵向排列的菜单行，所以这里用语义工具类拼出一行菜单的排版：
 * 次要文字色 + 花瓣粉悬浮底。链接与按钮共用同一套，保证左边缘对齐。
 */
const MENU_ITEM =
  'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-body-sm text-muted-foreground transition-colors hover:bg-brand-wash hover:text-brand-text'

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
    window.addEventListener('connections-refresh', refresh)
    return () => {
      active = false
      window.removeEventListener('connections-refresh', refresh)
    }
  }, [user])

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
  const username = user.email ?? `用户 #${user.user_id}`

  return (
    <details className="relative shrink-0">
      <summary className="cursor-pointer list-none whitespace-nowrap font-mono text-label text-muted-foreground transition-colors hover:text-brand-text [&::-webkit-details-marker]:hidden">
        {username}{' '}
        <span aria-hidden className="text-brand-text">
          ▾
        </span>
      </summary>

      {/* 浮层用 Card 的静态变体取描边 + 圆角 + 语义阴影，换肤时自动跟随。
       * 这里不叠加 Tailwind 的 shadow-* —— 那是与皮肤无关的固定投影，
       * 会让 rock / night 皮肤下的浮层失去同一套层次语言。 */}
      <Card static className="absolute top-full right-0 z-50 mt-3 min-w-48 p-2">
        <Link href="/connections" className={MENU_ITEM}>
          <span>连接记录</span>
          {pending > 0 ? (
            <Chip tone="accent" aria-label={`${pending} 个待处理连接`}>
              {pending > 99 ? '99+' : pending}
            </Chip>
          ) : null}
        </Link>

        <Link href="/talents/me/edit" className={MENU_ITEM}>
          编辑我的档案
        </Link>
        {isFounder ? (
          <Link href="/founder/dashboard" className={MENU_ITEM}>
            创始人后台
          </Link>
        ) : null}
        {isOperator ? (
          <Link href="/operator" className={MENU_ITEM}>
            运营后台
          </Link>
        ) : null}

        <hr className="ui-rule my-1" />

        <button type="button" onClick={logout} className={MENU_ITEM}>
          退出登录
        </button>
      </Card>
    </details>
  )
}
