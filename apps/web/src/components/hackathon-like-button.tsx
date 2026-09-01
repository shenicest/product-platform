'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { useUserInteraction } from '@/components/user-interaction-provider'

export function HackathonLikeButton({ projectId, count }: { projectId: number; count: number }) {
  const router = useRouter()
  const auth = useOptionalAuth()
  const { likedHackathon, likeHackathon, unlikeHackathon } = useUserInteraction()
  const [pending, setPending] = useState(false)
  const liked = likedHackathon.has(projectId)
  const [likeCount, setLikeCount] = useState(count)

  async function toggle() {
    if (!auth?.user) {
      window.sessionStorage.setItem('shenicest_pending_hackathon_like', String(projectId))
      router.push('/login')
      return
    }
    if (pending) return
    setPending(true)
    setLikeCount((current) => Math.max(0, current + (liked ? -1 : 1)))
    try {
      if (liked) await unlikeHackathon(projectId)
      else await likeHackathon(projectId)
    } catch {
      setLikeCount((current) => current + (liked ? 1 : -1))
    } finally {
      setPending(false)
    }
  }

  return <button type="button" aria-label={liked ? '取消黑客松项目点赞' : '为黑客松项目点赞'} className={`hackathon-like ${liked ? 'active' : ''}`} onClick={toggle} disabled={pending} aria-pressed={liked}>{liked ? '♥' : '♡'} {likeCount} LIKES</button>
}
