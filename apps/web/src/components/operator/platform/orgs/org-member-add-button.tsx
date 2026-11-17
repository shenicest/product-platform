'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { addOrganizerMember } from '@/lib/platform-console-api'
import { validateMemberUserId } from '@/lib/platform-console'
import { PlatformDialog } from '../dialog'

/**
 * 「新增成员」弹窗（仅平台管理员）。
 *
 * 入参是用户 ID 而不是搜索选择器：站内目前没有「按昵称搜人」的开放接口
 * （`/users/:userId/roles` 与 mock 切换器都不适合当人员目录），所以这里明确
 * 让管理员填 ID，并把「这个 ID 是谁」的校验交给后端（不存在会 404、
 * 已在组织里会 409，两条文案都原样展示）。
 *
 * 加进来的成员只在「该组织被指定的赛季」内有主办方权限，跨赛季一律 403 ——
 * 这句提醒必须跟着弹窗走，否则很容易被理解成「加进组织 = 全平台主办方」。
 */
export function OrgMemberAddButton({
  orgId,
  orgName,
}: {
  orgId: number
  orgName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  function close() {
    setOpen(false)
    setUserId('')
    setError(null)
    triggerRef.current?.focus()
  }

  async function submit() {
    const invalid = validateMemberUserId(userId)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    const { error: apiError } = await addOrganizerMember(orgId, userId)
    setBusy(false)
    if (apiError) {
      setError(apiError.body.error.message || '新增成员失败，请稍后重试')
      return
    }
    close()
    router.refresh()
  }

  return (
    <>
      <Button ref={triggerRef} variant="secondary" size="sm" onClick={() => setOpen(true)}>
        新增成员
      </Button>
      {open ? (
        <PlatformDialog
          title={`新增成员 · ${orgName}`}
          description="成员加入组织后，只在该组织被指定的赛季内拥有主办方权限；没有被指定的赛季一律无权。"
          onCancel={close}
          footer={
            <>
              <Button variant="ghost" onClick={close} disabled={busy}>
                取消
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? '添加中…' : '添加成员'}
              </Button>
            </>
          }
        >
          <label className="ui-label" htmlFor={`add-member-${orgId}`}>
            用户 ID
          </label>
          <input
            id={`add-member-${orgId}`}
            className="ui-input mt-2"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="例如：10086"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `add-member-error-${orgId}` : `add-member-hint-${orgId}`}
            maxLength={255}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void submit()
            }}
          />
          {error ? (
            <p id={`add-member-error-${orgId}`} role="alert" className="ui-field-error mt-2">
              {error}
            </p>
          ) : (
            <p id={`add-member-hint-${orgId}`} className="ui-hint mt-2">
              填平台账号的用户 ID。该用户不存在或已是组织成员时会被拒绝。
            </p>
          )}
        </PlatformDialog>
      ) : null}
    </>
  )
}
