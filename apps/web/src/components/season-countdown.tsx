'use client'

import { useEffect, useState } from 'react'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

/**
 * 把剩余毫秒拆成「天 + 时钟」。
 *
 * 独立成纯函数，组件只负责每秒把 `Date.now()` 喂进来；这样测试不需要
 * 假计时器，也不会在渲染期偷偷读时钟。
 */
export function formatCountdown(ms: number): { days: number; clock: string } {
  const remaining = Math.max(0, ms)
  const days = Math.floor(remaining / DAY_MS)
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS)
  const seconds = Math.floor((remaining % MINUTE_MS) / 1000)
  return {
    days,
    clock: [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':'),
  }
}

/**
 * 首页「距作品截止」倒计时。
 *
 * 首帧使用服务端算好的 `initialRemainingMs`，客户端 hydrate 后再接管，
 * 避免「服务端渲染 19 天、客户端立刻跳成 18 天」的 hydration 警告。
 */
export function SeasonCountdown({
  target,
  initialRemainingMs,
}: {
  /** ISO 时间；作品截止节点。 */
  target: string
  /** 服务端渲染那一刻的剩余毫秒数。 */
  initialRemainingMs: number
}) {
  const targetMs = new Date(target).getTime()
  const [remaining, setRemaining] = useState(() => Math.max(0, initialRemainingMs))

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [targetMs])

  if (!Number.isFinite(targetMs)) return null
  if (remaining <= 0) {
    return <span className="season-ticket__countdown-done">作品提交已截止</span>
  }

  const { days, clock } = formatCountdown(remaining)
  return (
    <span
      className="season-ticket__countdown-digits font-digits"
      role="timer"
      aria-live="off"
      aria-label={`距作品截止还剩 ${days} 天 ${clock}`}
    >
      {days > 0 ? (
        <>
          <b>{days}</b>
          <span>天</span>
        </>
      ) : null}
      <b>{clock}</b>
    </span>
  )
}
