'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { ConnectionRequestStatus } from '@shenicest/shared'

export interface ConnectionRequestStatusData {
  id: number
  status: number
  createdAt: string
}

export interface ConnectionRequestGate {
  data: ConnectionRequestStatusData | null
  receiverConfigured: boolean
  viewerIsReceiver: boolean
}

type SendResult = {
  data: ConnectionRequestStatusData | null
  error: { body: { error: { message: string } } } | null
}

type ContactField = 'wechat' | 'phone' | 'email'

const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  wechat: '微信号',
  phone: '手机号',
  email: '邮箱',
}

interface ConnectionRequestButtonProps {
  projectId: number
  initialStatus: ConnectionRequestGate | null
  purposes: readonly string[]
  statusLabels: Record<number, string>
  pendingKey: (projectId: number) => string
  loginReturnTo: string
  send: (
    projectId: number,
    body: { purpose: string; message: string; wechat?: string; phone?: string; email?: string },
  ) => Promise<SendResult>
  contactFields?: readonly ContactField[]
}

// Shared connection entry for project-detail pages: default "connect" button,
// Pending/Accepted status displays, and the login return flow (open the dialog
// after login, never auto-submit). `initialStatus` carries the server-computed
// gating flags; null means "unknown" (logged-out visitor or transient error)
// and still renders the button — the 409/404 backend responses remain the
// fallback for races.
export function ConnectionRequestButton({
  projectId,
  initialStatus,
  purposes,
  statusLabels,
  pendingKey,
  loginReturnTo,
  send,
  contactFields = ['wechat', 'email'],
}: ConnectionRequestButtonProps) {
  const router = useRouter()
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [gate, setGate] = useState<ConnectionRequestGate | null>(initialStatus)
  const [form, setForm] = useState({ purpose: '', message: '', wechat: '', phone: '', email: '' })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const contactHint = contactFields.map((field) => CONTACT_FIELD_LABELS[field]).join(' / ')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(pendingKey(projectId)) !== String(projectId)) return
      sessionStorage.removeItem(pendingKey(projectId))
      setOpen(true)
    })
    return () => window.clearTimeout(timer)
  }, [pendingKey, projectId])

  if (gate && (!gate.receiverConfigured || gate.viewerIsReceiver)) return null

  const status = gate?.data ?? null

  function connect() {
    if (!auth.user) {
      sessionStorage.setItem(pendingKey(projectId), String(projectId))
      router.push(`/login?returnTo=${loginReturnTo}`)
      return
    }
    setOpen(true)
  }

  function validate() {
    const errors: Record<string, string> = {}
    if (!purposes.includes(form.purpose)) errors.purpose = '请选择联系目的'
    if (form.message.trim().length < 30 || form.message.trim().length > 500) {
      errors.message = '留言请输入 30-500 个字符'
    }
    const hasContact = contactFields.some((field) => form[field].trim())
    if (!hasContact) {
      errors.contact = contactFields.includes('phone')
        ? '至少提供微信、手机号或邮箱中的一项'
        : '至少提供微信或邮箱'
    }
    if (contactFields.includes('wechat') && form.wechat && form.wechat.trim().length > 64) {
      errors.wechat = '微信号最长 64 个字符'
    }
    if (contactFields.includes('phone') && form.phone.trim()) {
      const phone = form.phone.trim()
      if (phone.length < 5 || phone.length > 32 || !/^[+\d][\d\s()-]*$/.test(phone)) {
        errors.phone = '手机号格式不正确'
      }
    }
    if (contactFields.includes('email') && form.email && form.email.trim().length > 254) {
      errors.email = '邮箱最长 254 个字符'
    }
    if (contactFields.includes('email') && form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = '邮箱格式不正确'
    }
    return errors
  }

  async function submit() {
    const validation = validate()
    if (Object.keys(validation).length > 0) {
      setError(Object.values(validation)[0])
      return
    }
    setSending(true)
    const result = await send(projectId, {
      purpose: form.purpose,
      message: form.message.trim(),
      wechat: form.wechat.trim() || undefined,
      phone: contactFields.includes('phone') ? form.phone.trim() || undefined : undefined,
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
      <div className="detail-connect-state mt-2">
        <p className="border border-primary/50 bg-primary/5 p-3 text-sm text-primary">
          {statusLabels[status.status] ?? '未知状态'}
        </p>
        {status.status === ConnectionRequestStatus.Pending ? (
          <Link className="detail-link inline-block" href="/connections">
            查看连接记录 ↗
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {status ? (
        <p className="mt-2 text-xs text-muted-foreground">{statusLabels[status.status] ?? '未知状态'}</p>
      ) : null}
      <button type="button" onClick={connect} className="detail-link detail-link-primary mt-2 w-full">
        联系项目方 <span aria-hidden>↗</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connection-dialog-title"
        >
          <div className="scan-frame max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto border border-border bg-card p-6">
            <h2 id="connection-dialog-title" className="text-xl font-bold">
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
                  {purposes.map((purpose) => (
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
              <p className="font-mono text-xs text-muted-foreground">
                联系方式（{contactHint}，至少填写一项）
              </p>
              {contactFields.includes('wechat') && (
                <label className="block font-mono text-xs text-muted-foreground">
                  微信号
                  <input
                    value={form.wechat}
                    onChange={(event) => setForm({ ...form, wechat: event.target.value })}
                    className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                  />
                </label>
              )}
              {contactFields.includes('phone') && (
                <label className="block font-mono text-xs text-muted-foreground">
                  手机号
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                  />
                </label>
              )}
              {contactFields.includes('email') && (
                <label className="block font-mono text-xs text-muted-foreground">
                  邮箱
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                  />
                </label>
              )}
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
