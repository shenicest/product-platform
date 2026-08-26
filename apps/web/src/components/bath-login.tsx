'use client'

import { useState, useCallback } from 'react'
import { sendLoginCode, verifyLoginCode } from '@/lib/client-api'

export function BathLogin({ onLogin }: { onLogin: () => void }) {
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
    const { data, error } = await sendLoginCode(identifier.trim())
    if (error || !data) {
      setError('发送失败')
      setLoading(false)
      return
    }
    if (!data.success) {
      setError((data as { error?: string }).error || '发送失败')
      setLoading(false)
      return
    }
    setStep('code')
    startCooldown()
    setLoading(false)
  }

  const handleVerify = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    const { data, error } = await verifyLoginCode(identifier.trim(), code.trim())
    if (error || !data) {
      setError('验证失败')
      setLoading(false)
      return
    }
    if (!data.success) {
      setError((data as { error?: string }).error || '验证失败')
      setLoading(false)
      return
    }
    onLogin()
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm border border-border bg-card p-8">
        <h1 className="mb-2 text-xl font-bold">🚿 洗澡间预约</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          登录后即可预约洗澡间时段。
        </p>

        {step === 'email' ? (
          <div className="space-y-4">
            <input
              type="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入邮箱"
              className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={loading || !identifier.trim()}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-mono text-xs text-muted-foreground">
              验证码已发送至 <span className="text-primary">{identifier}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="输入 6 位验证码"
              maxLength={6}
              className="w-full border border-border bg-background px-4 py-3 text-center text-2xl tracking-widest text-foreground placeholder:text-muted-foreground/30 focus:border-primary focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '验证中...' : '登录'}
            </button>
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep('email'); setCode('') }}
                disabled={loading}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                更换邮箱
              </button>
              <button
                onClick={() => { if (cooldown <= 0) handleSend() }}
                disabled={loading || cooldown > 0}
                className="text-xs text-primary hover:text-primary/80 disabled:opacity-50"
              >
                {cooldown > 0 ? `重新发送 (${cooldown}s)` : '重新发送'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
