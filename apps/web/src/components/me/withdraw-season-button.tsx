'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { withdrawSeasonParticipant } from '@/lib/boomland-api'

/**
 * 报名表格行里的「退出赛季」。
 *
 * 这是从组队 tab 迁过来的动作：退出赛季属于「这场报名」的状态变化，不是组队
 * 工作台的一部分。放在报名表格里，用户能一眼看到「我通过了、现在还在赛季里、
 * 组队截止前可以退出」。
 *
 * 只有报名已通过、选手仍是 active、组队截止前的行才会渲染它（判断在
 * `lib/me-applications.ts` 的 `seasonExitEntry()`，与后端 409 同一套规则）。
 *
 * 退出不可撤销：名额会按顺序递给候补的人，所以走两步确认 —— 第一次点击只把
 * 按钮换成「确认退出 / 取消」，真正的请求只在第二次点击时发出。
 *
 * 成功后 `router.refresh()` 而不是本地改行：退出会同时改选手状态并可能递补
 * 候补，让服务端重新算「已退赛」比在客户端猜要可靠。
 */
export function WithdrawSeasonButton({
  seasonId,
  userId,
  seasonName,
}: {
  seasonId: number
  /** 报名人；个人中心里恒为当前登录用户。 */
  userId: string
  seasonName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onWithdraw() {
    setPending(true)
    setError(null)
    const { error: apiError } = await withdrawSeasonParticipant(seasonId, userId)
    setPending(false)
    if (apiError) {
      setError(apiError.body.error.message || '退出失败，请稍后重试')
      return
    }
    setConfirming(false)
    router.refresh()
  }

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`退出 ${seasonName} 的赛季`}
        onClick={() => {
          setConfirming(true)
          setError(null)
        }}
      >
        退出赛季
      </Button>
    )
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={`确认退出 ${seasonName} 的赛季`}
          onClick={onWithdraw}
          disabled={pending}
        >
          {pending ? '退出中…' : '确认退出'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`取消退出 ${seasonName} 的赛季`}
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          disabled={pending}
        >
          取消
        </Button>
      </span>
      {error ? (
        <span role="alert" className="ui-field-error">
          {error}
        </span>
      ) : null}
    </span>
  )
}
