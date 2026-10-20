'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { useOptionalUserInteraction } from '@/components/user-interaction-provider'
import { Button } from '@/components/ui/button'

export function FollowButton({ founderUserId }: { founderUserId: string }) {
  const router = useRouter()
  const auth = useOptionalAuth()
  const interaction = useOptionalUserInteraction()
  const [busy, setBusy] = useState(false)
  const isSelf = auth?.user ? String(auth.user.user_id) === founderUserId : false
  const isFollowing = interaction?.following.has(founderUserId) ?? false

  if (isSelf) return null

  const handleClick = async () => {
    if (!auth?.user) {
      window.sessionStorage.setItem('shenicest_pending_follow', founderUserId)
      router.push('/login')
      return
    }
    if (!interaction || busy) return
    setBusy(true)
    try {
      if (isFollowing) await interaction.unfollow(founderUserId)
      else await interaction.follow(founderUserId)
    } catch { /* provider rolls back */ } finally { setBusy(false) }
  }

  return (
    <Button
      variant={isFollowing ? 'tertiary' : 'secondary'}
      size="sm"
      aria-pressed={isFollowing}
      disabled={busy}
      onClick={handleClick}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  )
}
