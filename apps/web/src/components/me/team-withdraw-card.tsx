'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { withdrawSeasonParticipant } from '@/lib/team-api'

/**
 * 「退出赛季」卡。
 *
 * 二次确认不是礼貌，是必要的：退出会释放名额、按顺序递给候补的人，
 * 点错一次没法自己撤销。所以第一次点击只把按钮换成「确认退出 / 取消」，
 * 真正的请求只在第二次点击时发出。
 *
 * 按钮文案带赛季编号（`退出 A4BBS`）：同一个人可能同时在几个赛季里，
 * 「退出赛季」这种通用文案会让人不确定退的是哪一个。
 */
export function TeamWithdrawCard({
  seasonId,
  seasonCode,
  userId,
  canWithdraw,
  deadlinePassed,
}: {
  seasonId: number
  seasonCode: string
  userId: string
  /** 后端 `participant.canWithdraw`：组队截止前且 status=active。 */
  canWithdraw: boolean
  deadlinePassed: boolean
}) {
  const router = useRouter()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
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

  function cancel() {
    setConfirming(false)
    setError(null)
    triggerRef.current?.focus()
  }

  return (
    <article className="ui-card ui-card--static">
      <div className="card-body">
        <h2 className="card-title">退出赛季</h2>
        <p className="card-text">
          组队截止前可以退出；退出不删除作品、积分与 Track Record。
          名额会按顺序递补给候补的人（待定 14、15）。
        </p>
      </div>

      <footer className="card-footer">
        {canWithdraw ? (
          confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onWithdraw}
                disabled={pending}
                aria-label={`确认退出 ${seasonCode}`}
              >
                {pending ? '退出中…' : `确认退出 ${seasonCode}`}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={pending}>
                取消
              </Button>
            </div>
          ) : (
            <Button
              ref={triggerRef}
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              退出 {seasonCode}
            </Button>
          )
        ) : (
          <span className="ui-hint m-0">
            {deadlinePassed ? '组队已截止，退出请找主办方处理。' : '你当前不是该赛季的选手。'}
          </span>
        )}
      </footer>

      {error ? (
        <p role="alert" className="ui-field-error px-5 pb-4">
          {error}
        </p>
      ) : null}
    </article>
  )
}
