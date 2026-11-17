'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { removeOrganizerMember } from '@/lib/platform-console-api'
import { PlatformDialog } from '../dialog'

/**
 * 「移除成员」确认弹窗（仅平台管理员）。
 *
 * 移除是不可逆的写操作（重新加回来要再填一次 ID），所以走二次确认而不是一点就走。
 * 两个业务例外必须提前说清楚，否则用户只会在提交后吃一个 409：
 *   · 组织仍关联着赛季时，不能移除**最后一名**成员（否则没人能管这些赛季）；
 *   · 移除只影响未来的权限，已经发生过的评分 / 审计记录不会回滚。
 */
export function OrgMemberRemoveButton({
  orgId,
  orgName,
  userId,
  memberName,
  isLastMember,
}: {
  orgId: number
  orgName: string
  userId: string
  memberName: string | null
  isLastMember: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const displayName = memberName ?? `用户 ${userId}`

  function close() {
    setOpen(false)
    setError(null)
    triggerRef.current?.focus()
  }

  async function submit() {
    setBusy(true)
    setError(null)
    const { error: apiError } = await removeOrganizerMember(orgId, userId)
    setBusy(false)
    if (apiError) {
      setError(apiError.body.error.message || '移除失败，请稍后重试')
      return
    }
    close()
    router.refresh()
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="text"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`从 ${orgName} 移除 ${displayName}`}
      >
        移除
      </Button>
      {open ? (
        <PlatformDialog
          title="移除组织成员"
          description={`把「${displayName}」从「${orgName}」移出后，他将在该组织主办的所有赛季失去主办方权限。`}
          onCancel={close}
          footer={
            <>
              <Button variant="ghost" onClick={close} disabled={busy}>
                取消
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? '移除中…' : '确认移除'}
              </Button>
            </>
          }
        >
          {isLastMember ? (
            <p className="ui-note ui-note--warning">
              这是该组织唯一的成员。组织仍关联着赛季时，后端会拒绝移除最后一名成员 —— 先给组织补一名成员，再移除。
            </p>
          ) : (
            <p className="ui-hint">
              移除只影响未来的权限：已经发生过的评分、报名审核与审计记录不会因此回滚。
            </p>
          )}
          {error ? (
            <p role="alert" className="ui-field-error mt-3">
              {error}
            </p>
          ) : null}
        </PlatformDialog>
      ) : null}
    </>
  )
}
