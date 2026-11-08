'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { withdrawSeasonApplication } from '@/lib/boomland-api'

/**
 * 表格行里的「撤回报名」。
 *
 * 整个报名表格是 Server Component（纯展示），只有这一颗按钮需要交互，
 * 所以单独拆成 Client Component —— 这样表格本体不必背 `'use client'`，
 * 整页仍然是服务端渲染出来的。
 *
 * 撤回是**不可撤销**的写操作，所以走两步确认（先点「撤回报名」，
 * 再点「确认撤回」），并且用 `aria-label` 把赛季名带进可访问名 ——
 * 表格里同时有好几行时，读屏念出来的是「撤回 A4BBS 产业商业赛季的报名」
 * 而不是一串无法区分的「撤回报名」。
 *
 * 成功后 `router.refresh()` 而不是本地删除行：撤回会同时改报名状态与选手行，
 * 让服务端重新算一遍比在客户端猜要可靠。
 */
export function WithdrawApplicationButton({
  applicationId,
  seasonName,
}: {
  applicationId: number
  seasonName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onWithdraw() {
    setPending(true)
    setError(null)
    const { error: apiError } = await withdrawSeasonApplication(applicationId)
    setPending(false)
    if (apiError) {
      setError(apiError.body.error.message || '撤回失败，请稍后重试')
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
        aria-label={`撤回 ${seasonName} 的报名`}
        onClick={() => {
          setConfirming(true)
          setError(null)
        }}
      >
        撤回报名
      </Button>
    )
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label={`确认撤回 ${seasonName} 的报名`}
          onClick={onWithdraw}
          disabled={pending}
        >
          {pending ? '撤回中…' : '确认撤回'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`取消撤回 ${seasonName} 的报名`}
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
