'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/surface'
import {
  ANNOUNCEMENT_REFRESH_EVENT,
  announcementBadgeLabel,
  announcementTypeLabel,
  formatAnnouncementTime,
} from '@/lib/announcements'
import {
  getAnnouncements,
  getAnnouncementSummary,
  markAllAnnouncementsRead,
  type AnnouncementData,
} from '@/lib/client-api'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 60_000
const PANEL_LIMIT = 20

type PanelState = 'loading' | 'ready' | 'error'

/**
 * 面板数据带着 userId：换账号时旧数据自动失效，不需要在 effect 里同步清空
 * 状态（那会触发 react-hooks/set-state-in-effect，也会多一轮渲染）。
 */
interface PanelData {
  userId: string
  state: PanelState
  items: AnnouncementData[]
}

/**
 * 顶栏公告铃铛。
 *
 * 结构是「按钮 + 受控浮层」而不是 `UserMenu` 那种原生 `<details>`：
 * 铃铛打开时要拉列表、要防止重复加载、Esc 要还焦点给按钮，受控状态更直接，
 * 也避免 `<summary>` 的默认行为在测试环境里不可依赖。
 *
 * 已读语义完全由服务端的读水位线决定：打开面板**不**改已读，只有
 * 「全部已读」会发一次 POST。角标数量来自 `/me/announcements/summary`。
 */
export function AnnouncementBell() {
  const { user, loading } = useAuth()
  const userId = user ? String(user.user_id) : null

  const [count, setCount] = useState<{ userId: string; value: number } | null>(null)
  const [panel, setPanel] = useState<PanelData | null>(null)
  // 用「为哪个用户打开」而不是布尔值：切换 mock 用户时浮层自动收起，
  // 不需要在 effect 里监听 userId 再 setState。
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  // 最近一次「全部已读」成功的时刻：用来丢弃在此之前发出的 summary 请求，
  // 避免轮询与一键已读竞态时把刚清零的角标又写回去。
  const lastMarkedAtRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // 只认当前账号的结果：换账号后旧计数/旧列表、以及打开状态一律失效。
  const open = openedFor !== null && openedFor === userId
  const unreadCount = count && count.userId === userId ? count.value : 0
  const currentPanel = panel && panel.userId === userId ? panel : null

  const closePanel = useCallback(() => setOpenedFor(null), [])

  // 角标轮询：60s 一次，标签页重新可见时补一次；站内动作通过
  // `announcements-refresh` 事件手动触发（与 connections-refresh 同款）。
  useEffect(() => {
    if (!userId) return
    let active = true

    const load = async () => {
      const requestedAt = Date.now()
      const result = await getAnnouncementSummary()
      if (!active || !result.data) return
      // 请求发出后用户点了「全部已读」：这份回包描述的是旧状态，直接丢弃。
      if (requestedAt < lastMarkedAtRef.current) return
      setCount({ userId, value: result.data.unreadCount })
    }

    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const onRefresh = () => void load()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener(ANNOUNCEMENT_REFRESH_EVENT, onRefresh)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener(ANNOUNCEMENT_REFRESH_EVENT, onRefresh)
    }
  }, [userId])

  // 点浮层外面收起；Esc 收起并把焦点还给铃铛。
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      if (!container) return
      if (event.target instanceof Node && container.contains(event.target)) return
      setOpenedFor(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Esc 关闭后把焦点还给铃铛；点链接/点外面关闭时不做这个动作，
      // 否则会跟随后续跳转抢焦点。
      setOpenedFor(null)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  /**
   * 每次打开都重新拉一次面板列表：公告是低频事件，一次请求换「打开即最新」。
   *
   * 由点击事件触发而不是 `open` 的 effect：既避免在 effect 里同步 setState，
   * 也让「打开 → 加载」是一次明确的用户动作。
   */
  const openPanel = useCallback(async () => {
    if (!userId) return
    setPanel({ userId, state: 'loading', items: [] })
    const result = await getAnnouncements({ limit: PANEL_LIMIT })
    setPanel((current) => {
      if (!current || current.userId !== userId) return current
      if (!result.data) return { ...current, state: 'error' }
      return { userId, state: 'ready', items: result.data.items }
    })
    if (result.data) setCount({ userId, value: result.data.unreadCount })
  }, [userId])

  const togglePanel = () => {
    if (!userId) return
    if (open) {
      setOpenedFor(null)
      return
    }
    setOpenedFor(userId)
    void openPanel()
  }

  const markAllRead = async () => {
    if (!userId) return
    const previousCount = unreadCount
    const previousItems = currentPanel?.items ?? []
    // 乐观更新：角标清零、圆点消失；失败再整体回滚。
    setCount({ userId, value: 0 })
    setPanel((current) =>
      current && current.userId === userId
        ? { ...current, items: current.items.map((item) => ({ ...item, isRead: true })) }
        : current,
    )
    setMarking(true)
    const result = await markAllAnnouncementsRead()
    setMarking(false)
    if (result.error) {
      setCount({ userId, value: previousCount })
      setPanel((current) =>
        current && current.userId === userId ? { ...current, items: previousItems } : current,
      )
      return
    }
    lastMarkedAtRef.current = Date.now()
    setCount({ userId, value: result.data?.unreadCount ?? 0 })
    // 其它消费方（个人中心 tab 角标等）收到事件后重新拉取未读数。
    window.dispatchEvent(new Event(ANNOUNCEMENT_REFRESH_EVENT))
  }

  if (loading || !userId) return null

  const badge = announcementBadgeLabel(unreadCount)
  const triggerLabel = unreadCount > 0 ? `公告，${unreadCount} 条未读` : '公告'

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        onClick={togglePanel}
        className={cn(
          'relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors',
          'hover:bg-brand-wash hover:text-brand-text',
          open && 'bg-brand-wash text-brand-text',
        )}
      >
        <BellIcon className="size-[18px]" />
        {badge ? (
          <span
            aria-hidden
            data-testid="announcement-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] leading-none text-destructive-foreground"
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <Card
          static
          role="region"
          aria-label="公告"
          className="absolute top-full right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] text-left"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <span className="font-mono text-label text-foreground">公告</span>
            <Button
              variant="text"
              size="sm"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0 || marking}
            >
              全部已读
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <AnnouncementPanelBody
              state={currentPanel?.state ?? 'loading'}
              items={currentPanel?.items ?? []}
              onNavigate={closePanel}
            />
          </div>

          <Link
            href="/me/announcements"
            onClick={closePanel}
            className="block border-t border-border px-4 py-3 text-center font-mono text-label text-brand-text transition-colors hover:bg-brand-wash"
          >
            查看全部 →
          </Link>
        </Card>
      ) : null}
    </div>
  )
}

function AnnouncementPanelBody({
  state,
  items,
  onNavigate,
}: {
  state: PanelState
  items: AnnouncementData[]
  onNavigate: () => void
}) {
  if (state === 'loading' && items.length === 0) {
    return <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">加载中…</p>
  }
  if (state === 'error') {
    return (
      <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">
        公告加载失败，请稍后再试
      </p>
    )
  }
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">暂时没有公告</p>
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} className="border-b border-border-soft last:border-b-0">
          <AnnouncementRow item={item} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  )
}

function AnnouncementRow({
  item,
  onNavigate,
}: {
  item: AnnouncementData
  onNavigate: () => void
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            item.isRead ? 'bg-transparent' : 'bg-brand',
          )}
        />
        <span className="font-mono text-label text-muted-foreground">
          {announcementTypeLabel(item.type)}
        </span>
        <span className="ml-auto font-mono text-label text-subtle-foreground">
          <time dateTime={item.publishedAt}>{formatAnnouncementTime(item.publishedAt)}</time>
        </span>
      </span>
      <span
        className={cn(
          'mt-1 block text-body-sm',
          item.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground',
        )}
      >
        {item.title}
      </span>
      <span className="mt-0.5 line-clamp-2 block text-body-sm text-muted-foreground">
        {item.content}
      </span>
    </>
  )

  const className = 'block px-4 py-3 transition-colors hover:bg-brand-wash'
  return item.linkPath ? (
    <Link href={item.linkPath} className={className} onClick={onNavigate}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** 铃铛图标：24×24 网格、1.5 描边，与 `HeartIcon` 同一套线宽约定。 */
function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn('block shrink-0', className)}>
      <path
        d="M6 10a6 6 0 1 1 12 0c0 3.2 1 4.6 1.6 5.3.3.3.1.7-.4.7H4.8c-.5 0-.7-.4-.4-.7C5 14.6 6 13.2 6 10Z"
        className="fill-none stroke-current"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        className="fill-none stroke-current"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  )
}
