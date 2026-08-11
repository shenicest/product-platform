'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { followFounder, likeProject, sendLoginCode, verifyLoginCode } from '@/lib/client-api'

export default function LoginPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const startCooldown = useCallback(() => {
    setCooldown(60)
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleSend = async () => {
    if (!identifier.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data, error } = await sendLoginCode(identifier.trim())
      if (error || !data) {
        setError('发送失败')
        return
      }
      if (!data.success) {
        setError((data as { error?: string }).error || '发送失败')
        return
      }
      setStep('code')
      startCooldown()
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data, error } = await verifyLoginCode(identifier.trim(), code.trim())
      if (error || !data) {
        setError('验证失败')
        return
      }
      if (!data.success) {
        setError((data as { error?: string }).error || '验证失败')
        return
      }
      const pendingLike = window.sessionStorage.getItem('shenicest_pending_like')
      if (pendingLike) {
        const projectId = Number(pendingLike)
        window.sessionStorage.removeItem('shenicest_pending_like')
        if (Number.isSafeInteger(projectId) && projectId > 0) await likeProject(projectId)
      }
      const pendingFollow = window.sessionStorage.getItem('shenicest_pending_follow')
      if (pendingFollow) {
        window.sessionStorage.removeItem('shenicest_pending_follow')
        await followFounder(pendingFollow)
      }
      await refresh()
      router.push('/')
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    await handleSend()
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4">
      <div className="scan-frame w-full max-w-md border border-border bg-card p-8 sm:p-10">
        <header className="mb-8">
          <p className="eyebrow mb-3">AUTH / LOGIN</p>
          <h1 className="text-[clamp(24px,3vw,32px)] font-bold leading-tight">
            登录到 <span className="text-primary">SHE<span className="font-bold">NICEST</span></span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            输入邮箱，通过验证码登录。新用户自动注册。
          </p>
        </header>

        {step === 'email' ? (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block font-mono text-xs tracking-wider text-muted-foreground"
              >
                EMAIL
              </label>
              <input
                id="identifier"
                type="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="your@email.com"
                className="w-full border border-border bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={handleSend}
              disabled={loading || !identifier.trim()}
              className="btn-hard btn-primary w-full"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-border bg-background/50 px-4 py-3">
              <p className="font-mono text-xs text-muted-foreground">
                验证码已发送至
              </p>
              <p className="mt-0.5 font-mono text-sm text-primary">
                {identifier}
              </p>
            </div>
            <div>
              <label
                htmlFor="code"
                className="mb-1.5 block font-mono text-xs tracking-wider text-muted-foreground"
              >
                VERIFICATION CODE
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="000000"
                maxLength={6}
                className="w-full border border-border bg-background px-4 py-3 text-center font-digits text-2xl tracking-[0.5em] text-foreground placeholder:text-muted-foreground/30 focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="btn-hard btn-primary w-full"
            >
              {loading ? '验证中...' : '登录'}
            </button>
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep('email'); setCode('') }}
                disabled={loading}
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                更换邮箱
              </button>
              <button
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className="font-mono text-xs text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
              >
                {cooldown > 0 ? `重新发送 (${cooldown}s)` : '重新发送'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 border border-destructive/50 bg-destructive/10 px-4 py-2.5">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
