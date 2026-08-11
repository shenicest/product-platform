'use client'

import { useEffect } from 'react'
import { FollowButton } from '@/components/follow-button'
import { useOptionalUserInteraction } from '@/components/user-interaction-provider'

export function FounderCard({ founder, projectName }: { founder: { userId: string; nickname: string | null; avatarUrl: string | null; followerCount: number }; projectName: string }) {
  const interaction = useOptionalUserInteraction()
  useEffect(() => interaction?.registerFollowerCount(founder.userId, founder.followerCount), [founder.followerCount, founder.userId, interaction])
  const followerCount = interaction?.followerCounts.get(founder.userId) ?? founder.followerCount

  return <section className="mt-5 flex items-center justify-between gap-4 border border-border bg-card px-4 py-3">
    <div className="flex min-w-0 items-center gap-2.5 font-mono text-xs">
      {founder.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={founder.avatarUrl} alt={founder.nickname ?? `${projectName} 创始人`} className="size-9 border border-border bg-muted object-cover" />
      ) : null}
      <div><p className="text-muted-foreground">FOUNDER</p><p className="mt-0.5 truncate text-foreground">{founder.nickname ?? '匿名创始人'}</p><p className="mt-0.5 text-muted-foreground">{followerCount} followers</p></div>
    </div>
    <FollowButton founderUserId={founder.userId} />
  </section>
}
