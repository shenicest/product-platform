'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { sendHackathonConnection, type MyHackathonConnectionStatus } from '@/lib/client-api'
import { HACKATHON_CONNECTION_STATUS_LABELS, validateHackathonConnectionBody } from '@/lib/hackathon-project'
import { HACKATHON_CONNECTION_PURPOSES, ConnectionRequestStatus } from '@shenicest/shared'
import { Button } from '@/components/ui/button'

export function hackathonPendingConnectKey(projectId: number) {
  return `shenicest_pending_hackathon_connect:${projectId}`
}

const fieldLabel = 'block font-mono text-meta tracking-[0.08em] text-muted-foreground'

// Connection entry for hackathon project detail pages: default "connect"
// button, Pending/Accepted status displays, and the login return flow
// (open the dialog after login, never auto-submit). `initialStatus` carries
// the server-computed gating flags; null means "unknown" (logged-out visitor
// or transient error) and still renders the button — the 409/404 backend
// responses remain the fallback for races.
export function HackathonConnectButton({ projectId, initialStatus }: { projectId: number; initialStatus: MyHackathonConnectionStatus | null }) {
  const router = useRouter()
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [gate, setGate] = useState<MyHackathonConnectionStatus | null>(initialStatus)
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

  // Grayscale: unconfigured projects and the receiver themselves never see
  // the entry (PRD 18 阶段 3; tech-review risk table). After every hook —
  // this is a render gate, not a hook skip.
  if (gate && (!gate.receiverConfigured || gate.viewerIsReceiver)) return null

  const status = gate?.data ?? null

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
    const created = result.data
    if (created) {
      setGate((prev) => ({
        data: { id: created.id, status: created.status, createdAt: created.createdAt },
        receiverConfigured: prev?.receiverConfigured ?? true,
        viewerIsReceiver: false,
      }))
    }
    router.refresh()
  }

  if (status && (status.status === ConnectionRequestStatus.Pending || status.status === ConnectionRequestStatus.Accepted)) {
    return (
      <div className="mt-2 space-y-2">
        <p className="ui-note ui-note--accent font-bold">
          {HACKATHON_CONNECTION_STATUS_LABELS[status.status] ?? '未知状态'}
        </p>
        {status.status === ConnectionRequestStatus.Pending ? (
          <Link
            href="/connections"
            className="inline-block font-mono text-label text-muted-foreground transition-colors hover:text-brand-text"
          >
            查看连接记录 ↗
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {status ? (
        <p className="mt-2 text-meta text-muted-foreground">{HACKATHON_CONNECTION_STATUS_LABELS[status.status] ?? '未知状态'}</p>
      ) : null}
      <Button variant="primary" block className="mt-2" onClick={connect}>
        联系项目方 <span className="ui-btn__arrow" aria-hidden>↗</span>
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hackathon-connection-dialog-title"
        >
          <div className="ui-panel max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto">
            <h2 id="hackathon-connection-dialog-title" className="text-h3 font-bold text-foreground">
              联系项目方
            </h2>
            <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">
              提交后你的联系方式不会出现在通知邮件中；项目方接受后双方联系方式才会解锁。
            </p>
            <div className="mt-5 space-y-3">
              <label className={fieldLabel}>
                联系目的
                <select
                  value={form.purpose}
                  onChange={(event) => setForm({ ...form, purpose: event.target.value })}
                  className="ui-select mt-1 font-sans"
                >
                  <option value="">请选择联系目的</option>
                  {HACKATHON_CONNECTION_PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>
                      {purpose}
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldLabel}>
                留言（30-500 字）
                <textarea
                  required
                  minLength={30}
                  maxLength={500}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  className="ui-textarea mt-1 font-sans"
                />
              </label>
              <label className={fieldLabel}>
                微信号（微信或邮箱至少一项）
                <input
                  value={form.wechat}
                  onChange={(event) => setForm({ ...form, wechat: event.target.value })}
                  className="ui-input mt-1 font-sans"
                />
              </label>
              <label className={fieldLabel}>
                邮箱
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="ui-input mt-1 font-sans"
                />
              </label>
              {error && (
                <p className="ui-note ui-note--danger" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={submit} disabled={sending}>
                  {sending ? '发送中...' : '发送申请'}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
