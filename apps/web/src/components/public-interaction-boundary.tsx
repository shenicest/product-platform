import { getMyFollows, getMyHackathonLikes, getMyLikes } from '@/server/interactions'
import { UserInteractionProvider } from '@/components/user-interaction-provider'

export async function PublicInteractionBoundary({ children }: { children: React.ReactNode }) {
  const [initialLikedProjectIds, initialFollowedFounderUserIds, initialLikedHackathonProjectIds] = await Promise.all([getMyLikes(), getMyFollows(), getMyHackathonLikes()])
  return <UserInteractionProvider initialLikedProjectIds={initialLikedProjectIds} initialFollowedFounderUserIds={initialFollowedFounderUserIds} initialLikedHackathonProjectIds={initialLikedHackathonProjectIds}>{children}</UserInteractionProvider>
}
