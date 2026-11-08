'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Chip } from '@/components/ui/chip'
import { Card } from '@/components/ui/surface'
import { Mono } from '@/components/ui/typography'
import { cn } from '@/lib/utils'
import {
  MOCK_SWITCHER_ENABLED,
  fetchMockUsers,
  loadMockSwitcherCollapsed,
  saveMockSwitcherCollapsed,
  selectMockUser,
  type MockUsersState,
} from '@/lib/mock-auth'

/**
 * 本地开发用的 mock 用户切换浮层（固定右下角）。
 *
 * 三层「不出现」：
 *   · 生产构建：`MOCK_SWITCHER_ENABLED` 为 false，整个组件不挂载 DOM；
 *   · 后端没开 mock：`/api/mock/users` 返回 404（或网络失败），组件保持空渲染；
 *   · 还没拉到列表：同样不渲染，避免先闪一个空浮层再消失。
 *
 * mock 用户列表完全来自接口，前端 bundle 里没有任何用户数据。
 */
export function MockUserSwitcher() {
  if (!MOCK_SWITCHER_ENABLED) return null
  return <MockUserSwitcherPanel />
}

/** 一行用户的可点击区域：次要文字色 + 花瓣粉悬浮底，与站内菜单行同一套语言。 */
const ROW =
  'flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-brand-wash'

/** 浮层右上角的小图标按钮（收起 / 展开）。 */
const ICON_BTN =
  'flex size-6 shrink-0 items-center justify-center rounded-md text-meta text-muted-foreground transition-colors hover:bg-brand-wash hover:text-brand-text'

function MockUserSwitcherPanel() {
  const { refresh } = useAuth()
  const [state, setState] = useState<MockUsersState | null>(null)
  /** 后端不可用（404 / 网络失败）：整块浮层不渲染。 */
  const [unavailable, setUnavailable] = useState(false)
  const [pending, setPending] = useState<string | null | undefined>(undefined)
  /**
   * 收起状态。初值直接从 localStorage 读，**不用 effect 回填**：服务端没有
   * `window`，这里退回「展开」，而真正渲染出浮层要等 `/api/mock/users` 回来
   * （只发生在客户端），所以首屏结构始终是 `null`，不会出现 hydration 不一致。
   */
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : loadMockSwitcherCollapsed(),
  )

  useEffect(() => {
    let active = true
    void fetchMockUsers().then((data) => {
      if (!active) return
      if (data) setState(data)
      else setUnavailable(true)
    })
    return () => {
      active = false
    }
  }, [])

  const toggleCollapsed = useCallback((next: boolean) => {
    setCollapsed(next)
    saveMockSwitcherCollapsed(next)
  }, [])

  // 展开时按 Esc 收起：浮层盖在页面上，键盘用户需要一个不用精确点小图标的出口。
  useEffect(() => {
    if (collapsed) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setCollapsed(true)
      saveMockSwitcherCollapsed(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [collapsed])

  const select = useCallback(
    async (key: string | null) => {
      setPending(key)
      try {
        const result = await selectMockUser(key)
        if (result.status === 'unavailable') {
          // 后端没开 mock（或网络断了）：整块浮层收起，页面上不留残留。
          setUnavailable(true)
          return
        }
        if (result.status === 'rejected') {
          // 后端在，只是这次没切成（例如未知 key）。保持浮层可见。
          return
        }
        setState((prev) => (prev ? { ...prev, active: result.active } : prev))
        // cookie 已换，重新拉一次 /api/me，头部与页面才会跟着变。
        await refresh()
      } finally {
        setPending(undefined)
      }
    },
    [refresh],
  )

  if (unavailable || !state) return null

  const { active, users } = state
  const activeLabel =
    active === null ? '未登录' : (users.find((u) => u.key === active)?.label ?? active)

  // 收起态：只留一颗小胶囊，随时能再展开。身份仍然可见，不然切完人收起来就忘了自己是谁。
  if (collapsed) {
    return (
      <aside
        aria-label="Mock 用户切换器"
        className="fixed right-4 bottom-4 z-50 max-w-[calc(100vw-2rem)]"
      >
        <button
          type="button"
          onClick={() => toggleCollapsed(false)}
          aria-expanded={false}
          aria-label={`展开 mock 用户切换器（当前身份：${activeLabel}）`}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition-colors hover:bg-brand-wash"
        >
          <Mono className="text-brand-text">MOCK</Mono>
          <span className="text-meta text-muted-foreground">{activeLabel}</span>
          <span aria-hidden className="text-meta text-muted-foreground">
            ↑
          </span>
        </button>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Mock 用户切换器"
      className="fixed right-4 bottom-4 z-50 w-72 max-w-[calc(100vw-2rem)]"
    >
      <Card static className="p-3">
        <div className="flex items-center justify-between gap-2">
          <Mono className="text-brand-text">MOCK</Mono>
          <div className="flex min-w-0 items-center gap-1">
            <Chip tone="accent" aria-label={`当前身份：${activeLabel}`}>
              {activeLabel}
            </Chip>
            <button
              type="button"
              onClick={() => toggleCollapsed(true)}
              aria-expanded
              aria-label="收起 mock 用户切换器"
              className={ICON_BTN}
            >
              <span aria-hidden>↓</span>
            </button>
          </div>
        </div>

        <ul className="mt-2 flex max-h-[60vh] flex-col overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => void select(null)}
              disabled={pending !== undefined}
              aria-pressed={active === null}
              className={cn(ROW, active === null ? 'text-brand-text' : 'text-muted-foreground')}
            >
              <span className="text-body-sm">未登录</span>
              <span className="text-meta">清掉 mock cookie</span>
            </button>
          </li>
          {users.map((u) => {
            const isActive = u.key === active
            return (
              <li key={u.key}>
                <button
                  type="button"
                  onClick={() => void select(u.key)}
                  disabled={pending !== undefined}
                  aria-pressed={isActive}
                  className={cn(ROW, isActive ? 'text-brand-text' : 'text-muted-foreground')}
                >
                  <span className="text-body-sm">{u.label}</span>
                  <span className="text-meta">{u.description}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Chip tone={u.isOrganizer ? 'sky' : 'neutral'}>{u.email ?? u.userId}</Chip>
                    {u.roles.length > 0 ? (
                      <Chip tone="neutral">roles {u.roles.join(',')}</Chip>
                    ) : null}
                    {!u.hasProfile ? <Chip tone="seeking">无档案</Chip> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
    </aside>
  )
}
