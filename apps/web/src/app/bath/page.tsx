'use client'

import { useEffect, useState } from 'react'
import { BathBooking } from '@/components/bath-booking'
import { BathLogin } from '@/components/bath-login'

export default function BathPage() {
  const [user, setUser] = useState<{ email: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user?.user_id) {
          setUser({ email: data.user.email ?? null })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="ui-empty w-full max-w-sm">加载中...</p>
      </div>
    )
  }

  if (!user) {
    return <BathLogin onLogin={() => window.location.reload()} />
  }

  return <BathBooking email={user.email} />
}
