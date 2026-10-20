'use client'

import { Suspense, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { followFounder, likeProject, sendLoginCode, verifyLoginCode } from '@/lib/client-api'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
      const returnTo = searchParams.get('returnTo')
      router.push(returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/')
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
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 sm:p-10">
        <header className="mb-8">
          <Eyebrow className="mb-3">AUTH / LOGIN</Eyebrow>
          <h1 className="text-[clamp(24px,3vw,32px)] font-bold leading-tight">
            登录到 <span className="text-brand-text">SHE<span className="font-bold">NICEST</span></span>
          </h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            输入邮箱，通过验证码登录。新用户自动注册。
          </p>
        </header>

        {step === 'email' ? (
          <div className="flex flex-col gap-4">
            <div className="ui-field">
              <label htmlFor="identifier" className="ui-label">
                EMAIL
              </label>
              <input
                id="identifier"
                type="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="your@email.com"
                className="ui-input"
                autoFocus
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={loading || !identifier.trim()}
              block
            >
              {loading ? '发送中...' : '发送验证码'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="ui-note">
              <div>
                <p className="mono">验证码已发送至</p>
                <p className="mt-0.5 font-mono text-body-sm text-brand-text">
                  {identifier}
                </p>
              </div>
            </div>
            <div className="ui-field">
              <label htmlFor="code" className="ui-label">
                VERIFICATION CODE
              </label>
              {/* 验证码用 DSEG7 数字墙字体：.ui-input 会锁死 font-sans，
                  因此这里直接用语义工具类重建同一套控件外观。 */}
              <input
                id="code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="000000"
                maxLength={6}
                className="h-[46px] w-full rounded-sm border border-input bg-card px-4 text-center font-digits text-2xl tracking-[0.5em] text-foreground placeholder:text-subtle-foreground focus:border-brand focus:outline-none"
                autoFocus
              />
            </div>
            <Button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              block
            >
              {loading ? '验证中...' : '登录'}
            </Button>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setStep('email'); setCode('') }}
                disabled={loading}
                className="font-mono text-meta text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                更换邮箱
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className="font-mono text-meta text-brand-text transition-colors hover:text-brand disabled:opacity-50"
              >
                {cooldown > 0 ? `重新发送 (${cooldown}s)` : '重新发送'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="ui-note ui-note--danger mt-4" role="alert">
            <p className="font-mono text-meta">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
