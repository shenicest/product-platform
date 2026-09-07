'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { sendHackathonConnection, type HackathonConnectionStatus } from '@/lib/client-api'
import { HACKATHON_CONNECTION_STATUS_LABELS, validateHackathonConnectionBody } from '@/lib/hackathon-project'
import { HACKATHON_CONNECTION_PURPOSES, ConnectionRequestStatus } from '@shenicest/shared'

export function hackathonPendingConnectKey(projectId: number) {
  return `shenicest_pending_hackathon_connect:${projectId}`
}

// Connection entry for hackathon project detail pages: default "connect"
// button, Pending/Accepted status displays, and the login return flow
// (open the dialog after login, never auto-submit).
export function HackathonConnectButton({ projectId, initialStatus }: { projectId: number; initialStatus: HackathonConnectionStatus | null }) {
  const router = useRouter()
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<HackathonConnectionStatus | null>(initialStatus)
  const [form, setForm] = useState({ purpose: '', message: '', wechat: '', email: '' })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(hackathonPendingConnectKey(projectId)) !== String(projectId)) return
      sessionStorage.removeItem(hackathonPendingConnectKey(projectId))
      setOpen(true)
    })
    return () => window.clearTimeout(timer)
  }, [projectId])

  function connect() {
    if (!auth.user) {
      sessionStorage.setItem(hackathonPendingConnectKey(projectId), String(projectId))
      router.push(`/login?returnTo=/hackathon/projects/${projectId}`)
      return
    }
    setOpen(true)
  }

  async function submit() {
    const validation = validateHackathonConnectionBody(form)
    if (Object.keys(validation).length > 0) {
      setError(Object.values(validation)[0])
      return
    }
    setSending(true)
    const result = await sendHackathonConnection(projectId, {
      purpose: form.purpose,
      message: form.message.trim(),
      wechat: form.wechat.trim() || undefined,
      email: form.email.trim() || undefined,
    })
    setSending(false)
    if (result.error) {
      setError(result.error.body.error.message)
      return
    }
    setOpen(false)
    setError('')
    if (result.data) {
      setStatus({ id: result.data.id, status: result.data.status, createdAt: result.data.createdAt })
    }
    router.refresh()
  }

  if (status && (status.status === ConnectionRequestStatus.Pending || status.status === ConnectionRequestStatus.Accepted)) {
    return (
      <div className="detail-connect-state mt-2">
        <p className="border border-primary/50 bg-primary/5 p-3 text-sm text-primary">
          {HACKATHON_CONNECTION_STATUS_LABELS[status.status] ?? '未知状态'}
        </p>
        {status.status === ConnectionRequestStatus.Pending ? (
          <Link className="detail-link inline-block" href="/connections">查看连接记录 ↗</Link>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {status ? (
        <p className="mt-2 text-xs text-muted-foreground">{HACKATHON_CONNECTION_STATUS_LABELS[status.status] ?? '未知状态'}</p>
      ) : null}
      <button type="button" onClick={connect} className="detail-link detail-link-primary mt-2 w-full">
        联系项目方 <span aria-hidden>↗</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hackathon-connection-dialog-title"
        >
          <div className="scan-frame max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto border border-border bg-card p-6">
            <h2 id="hackathon-connection-dialog-title" className="text-xl font-bold">
              联系项目方
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              提交后你的联系方式不会出现在通知邮件中；项目方接受后双方联系方式才会解锁。
            </p>
            <div className="mt-5 space-y-3">
              <label className="block font-mono text-xs text-muted-foreground">
                联系目的
                <select
                  value={form.purpose}
                  onChange={(event) => setForm({ ...form, purpose: event.target.value })}
                  className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm text-foreground"
                >
                  <option value="">请选择联系目的</option>
                  {HACKATHON_CONNECTION_PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>
                      {purpose}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-mono text-xs text-muted-foreground">
                留言（30-500 字）
                <textarea
                  required
                  minLength={30}
                  maxLength={500}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  className="mt-1 min-h-28 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                />
              </label>
              <label className="block font-mono text-xs text-muted-foreground">
                微信号（微信或邮箱至少一项）
                <input
                  value={form.wechat}
                  onChange={(event) => setForm({ ...form, wechat: event.target.value })}
                  className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                />
              </label>
              <label className="block font-mono text-xs text-muted-foreground">
                邮箱
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={submit} disabled={sending} className="btn-hard btn-primary flex-1">
                  {sending ? '发送中...' : '发送申请'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-hard btn-ghost">
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
