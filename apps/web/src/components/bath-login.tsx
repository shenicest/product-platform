'use client'

import { useCallback, useState } from 'react'
import { sendLoginCode, verifyLoginCode } from '@/lib/client-api'
import { Button } from '@/components/ui/button'

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
    <div className="min-h-screen bg-background">
      {/* 浴室小站自己的页头带：天空蓝，与主站区分 */}
      <header className="border-b border-border bg-sky-soft">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <p className="eyebrow">BATH HOUSE / SIGN IN</p>
          <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-fg">
            🚿 洗澡间预约
          </h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            登录后即可预约洗澡间时段。
          </p>
        </div>
      </header>

      <div className="flex justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="ui-card ui-card--static p-6">
          {step === 'email' ? (
            <div className="flex flex-col gap-4">
              <label className="ui-field">
                <span className="ui-label">邮箱</span>
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="输入邮箱"
                  className="ui-input"
                  autoFocus
                />
              </label>
              <Button
                block
                onClick={handleSend}
                disabled={loading || !identifier.trim()}
              >
                {loading ? '发送中...' : '发送验证码'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="mono">
                验证码已发送至 <span className="text-brand-text">{identifier}</span>
              </p>
              <label className="ui-field">
                <span className="ui-label">验证码</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="输入 6 位验证码"
                  maxLength={6}
                  className="ui-input ui-input--otp"
                  autoFocus
                />
              </label>
              <Button block onClick={handleVerify} disabled={loading || code.length !== 6}>
                {loading ? '验证中...' : '登录'}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode('') }}
                  disabled={loading}
                  className="ui-btn ui-btn--text ui-btn--small"
                >
                  更换邮箱
                </button>
                <button
                  type="button"
                  onClick={() => { if (cooldown <= 0) handleSend() }}
                  disabled={loading || cooldown > 0}
                  className="ui-btn ui-btn--text ui-btn--small text-brand-text disabled:opacity-50"
                >
                  {cooldown > 0 ? `重新发送 (${cooldown}s)` : '重新发送'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="ui-note ui-note--danger mt-4 text-xs" role="alert">
              {error}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
