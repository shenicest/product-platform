'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { hideHackathonProject } from '@/lib/client-api'

export function HackathonHideButton({ projectId }: { projectId: number }) {
  const auth = useOptionalAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const canHide = auth?.user?.email?.toLowerCase().endsWith('@shenicest.cn')

  if (!canHide) return null

  async function hide() {
    if (!window.confirm('确认将这个项目从黑客松项目列表下线吗？')) return
    setLoading(true)
    const result = await hideHackathonProject(projectId)
    setLoading(false)
    if (result.error) {
      window.alert(result.error.body.error.message)
      return
    }
    router.push('/hackathon')
    router.refresh()
  }

  return <button type="button" className="detail-link" disabled={loading} onClick={hide}>{loading ? '下线中...' : '下线项目'}</button>
}
