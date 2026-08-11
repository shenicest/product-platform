import { getMyFollows, getMyLikes } from '@/server/interactions'
import { UserInteractionProvider } from '@/components/user-interaction-provider'

export async function PublicInteractionBoundary({ children }: { children: React.ReactNode }) {
  const [initialLikedProjectIds, initialFollowedFounderUserIds] = await Promise.all([getMyLikes(), getMyFollows()])
  return <UserInteractionProvider initialLikedProjectIds={initialLikedProjectIds} initialFollowedFounderUserIds={initialFollowedFounderUserIds}>{children}</UserInteractionProvider>
}
