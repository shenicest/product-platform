'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { useUserInteraction } from '@/components/user-interaction-provider'
import { ChipButton } from '@/components/ui/chip'
import { HeartIcon } from '@/components/ui/heart-icon'

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

  return (
    <ChipButton
      aria-label={liked ? '取消黑客松项目点赞' : '为黑客松项目点赞'}
      aria-pressed={liked}
      className="font-mono"
      onClick={toggle}
      disabled={pending}
    >
      <HeartIcon
        filled={liked}
        className={liked ? 'size-3.5 text-brand motion-safe:scale-110' : 'size-3.5'}
      />{' '}
      {likeCount} LIKES
    </ChipButton>
  )
}
