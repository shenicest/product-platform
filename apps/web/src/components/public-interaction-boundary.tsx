import { getMyLikes } from '@/server/interactions'
import { UserInteractionProvider } from '@/components/user-interaction-provider'

export async function PublicInteractionBoundary({ children }: { children: React.ReactNode }) {
  const initialLikedProjectIds = await getMyLikes()
  return <UserInteractionProvider initialLikedProjectIds={initialLikedProjectIds}>{children}</UserInteractionProvider>
}
