'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createOrganizerOrg } from '@/lib/platform-console-api'
import { validateOrgName } from '@/lib/platform-console'
import { PlatformDialog } from '../dialog'

/**
 * 「新建主办方组织」弹窗（仅平台管理员）。
 *
 * 名称规则与后端 `CreateOrgBody` 一致（trim 后 2—100 字），前端只做提前拦一道：
 * 后端仍是最终裁判，重名（409）与其它错误都原样展示后端文案。
 */
export function CreateOrgButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  function close() {
    setOpen(false)
    setName('')
    setError(null)
    triggerRef.current?.focus()
  }

  async function submit() {
    const invalid = validateOrgName(name)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    const { error: apiError } = await createOrganizerOrg(name.trim())
    setBusy(false)
    if (apiError) {
      setError(apiError.body.error.message || '新建失败，请稍后重试')
      return
    }
    close()
    router.refresh()
  }

  return (
    <>
      <Button ref={triggerRef} onClick={() => setOpen(true)}>
        新建组织
      </Button>
      {open ? (
        <PlatformDialog
          title="新建主办方组织"
          description="组织是赛季主办权的载体：赛季指定组织后，组织成员才在该赛季获得主办方权限。"
          onCancel={close}
          footer={
            <>
              <Button variant="ghost" onClick={close} disabled={busy}>
                取消
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? '创建中…' : '创建组织'}
              </Button>
            </>
          }
        >
          <label className="ui-label" htmlFor="create-org-name">
            组织名称
          </label>
          <input
            id="create-org-name"
            className="ui-input mt-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：SheNicest"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'create-org-error' : 'create-org-hint'}
            maxLength={100}
            // 输入后按回车直接提交：只有一个字段的弹窗不该逼人去找按钮。
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void submit()
            }}
          />
          {error ? (
            <p id="create-org-error" role="alert" className="ui-field-error mt-2">
              {error}
            </p>
          ) : (
            <p id="create-org-hint" className="ui-hint mt-2">
              至少 2 个字，名称不可重复。创建后可以立刻添加成员。
            </p>
          )}
        </PlatformDialog>
      ) : null}
    </>
  )
}
