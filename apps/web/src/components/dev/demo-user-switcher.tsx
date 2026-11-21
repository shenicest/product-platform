'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Chip } from '@/components/ui/chip'
import { Card } from '@/components/ui/surface'
import { Mono } from '@/components/ui/typography'
import { cn } from '@/lib/utils'
import { DEMO_IDENTITIES } from '@/lib/demo-mode'

const ROW =
  'flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-brand-wash'

/**
 * 演示身份切换器（右下角）。
 *
 * 与本地 mock 切换器同一套交互，但**不依赖 API 的 `/mock/*` 路由**：
 * 它只调用 Next 自己的 `/api/demo/session` 写一个 httpOnly 的
 * `demo_identity` cookie，然后刷新服务端页面。这样部署在生产构建里也能用，
 * 不需要 API 开 mock。仅 `DEMO_MODE` 为 true 时挂载。
 */
export function DemoUserSwitcher() {
  const { user, refresh } = useAuth()
  const [pending, setPending] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const activeKey =
    DEMO_IDENTITIES.find((identity) => String(user?.user_id) === identity.userId)?.key ??
    'participant'
  const activeLabel =
    DEMO_IDENTITIES.find((identity) => identity.key === activeKey)?.label ?? activeKey

  const select = async (key: string) => {
    setPending(key)
    try {
      const res = await fetch('/api/demo/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identity: key }),
      })
      if (res.ok) await refresh()
    } finally {
      setPending(null)
    }
  }

  if (collapsed) {
    return (
      <aside
        aria-label="演示身份切换器"
        className="fixed right-4 bottom-4 z-50 max-w-[calc(100vw-2rem)]"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={`展开演示身份切换器（当前身份：${activeLabel}）`}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-colors hover:bg-brand-wash"
        >
          <Mono className="text-brand-text">DEMO</Mono>
          <span className="text-meta text-muted-foreground">{activeLabel}</span>
          <span aria-hidden className="text-meta text-muted-foreground">↑</span>
        </button>
      </aside>
    )
  }

  return (
    <aside
      aria-label="演示身份切换器"
      className="fixed right-4 bottom-4 z-50 w-72 max-w-[calc(100vw-2rem)]"
    >
      <Card static className="p-3">
        <div className="flex items-center justify-between gap-2">
          <Mono className="text-brand-text">DEMO</Mono>
          <div className="flex min-w-0 items-center gap-1">
            <Chip tone="accent" aria-label={`当前演示身份：${activeLabel}`}>
              {activeLabel}
            </Chip>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="收起演示身份切换器"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-meta text-muted-foreground transition-colors hover:bg-brand-wash hover:text-brand-text"
            >
              <span aria-hidden>↓</span>
            </button>
          </div>
        </div>

        <p className="mt-2 text-meta leading-relaxed text-muted-foreground">
          演示模式：不需要登录，切换身份查看选手 / 评委 / 企业 / 主办方视角。
        </p>

        <ul className="mt-2 flex max-h-[60vh] flex-col overflow-y-auto">
          {DEMO_IDENTITIES.map((identity) => {
            const isActive = identity.key === activeKey
            return (
              <li key={identity.key}>
                <button
                  type="button"
                  onClick={() => void select(identity.key)}
                  disabled={pending !== null}
                  aria-pressed={isActive}
                  className={cn(ROW, isActive ? 'text-brand-text' : 'text-muted-foreground')}
                >
                  <span className="text-body-sm">{identity.label}</span>
                  <span className="text-meta">{identity.description}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
    </aside>
  )
}
