'use client'

import { useEffect, useState } from 'react'
import { BathBooking } from '@/components/bath-booking'
import { BathLogin } from '@/components/bath-login'

export default function BathPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user?.user_id) {
          setUserId(String(data.user.user_id))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!userId) {
    return <BathLogin onLogin={() => window.location.reload()} />
  }

  return <BathBooking userId={userId} />
}
