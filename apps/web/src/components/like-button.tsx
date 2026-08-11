'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { useOptionalUserInteraction } from '@/components/user-interaction-provider'

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden className="size-4"><path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.3 4.3 0 0 1 11 6.1a4.3 4.3 0 0 1 7.8 2.7Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" /></svg>
}

export function LikeButton({ projectId, likeCount }: { projectId: number; likeCount: number }) {
  const router = useRouter()
  const auth = useOptionalAuth()
  const interaction = useOptionalUserInteraction()
  const user = auth?.user
  const [busy, setBusy] = useState(false)
  useEffect(() => interaction?.registerLikeCount(projectId, likeCount), [interaction, likeCount, projectId])
  const count = interaction?.likeCounts.get(projectId) ?? likeCount
  const isLiked = interaction?.liked.has(projectId) ?? false

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!user) {
      window.sessionStorage.setItem('shenicest_pending_like', String(projectId))
      router.push('/login')
      return
    }
    if (busy) return
    setBusy(true)
    try {
      if (!interaction) return
      if (isLiked) await interaction.unlike(projectId)
      else await interaction.like(projectId)
    } catch { /* provider rolls back */ } finally { setBusy(false) }
  }

  return <button type="button" aria-label={isLiked ? '取消喜欢' : '喜欢项目'} aria-pressed={isLiked} disabled={busy} onClick={handleClick} className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"><HeartIcon filled={isLiked} /><span>{count}</span></button>
}
