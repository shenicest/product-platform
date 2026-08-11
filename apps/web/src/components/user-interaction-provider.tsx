'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { followFounder, likeProject, unfollowFounder, unlikeProject } from '@/lib/client-api'

interface InteractionState {
  liked: Set<number>
  following: Set<string>
  likeCounts: Map<number, number>
  followerCounts: Map<string, number>
  registerLikeCount: (id: number, count: number) => void
  registerFollowerCount: (userId: string, count: number) => void
  like: (id: number) => Promise<void>
  unlike: (id: number) => Promise<void>
  follow: (userId: string) => Promise<void>
  unfollow: (userId: string) => Promise<void>
}

const InteractionContext = createContext<InteractionState | null>(null)

export function UserInteractionProvider({ initialLikedProjectIds, initialFollowedFounderUserIds, children }: { initialLikedProjectIds: number[]; initialFollowedFounderUserIds: string[]; children: React.ReactNode }) {
  const { user } = useAuth()
  const hadAuthenticatedUser = useRef(false)
  const [liked, setLiked] = useState(() => new Set(initialLikedProjectIds))
  const [following, setFollowing] = useState(() => new Set(initialFollowedFounderUserIds))
  const [likeCounts, setLikeCounts] = useState(() => new Map<number, number>())
  const [followerCounts, setFollowerCounts] = useState(() => new Map<string, number>())

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Rehydrate interaction sets when the server session changes after login/logout.
    if (user) {
      hadAuthenticatedUser.current = true
      setLiked(new Set(initialLikedProjectIds))
      setFollowing(new Set(initialFollowedFounderUserIds))
    } else if (hadAuthenticatedUser.current) {
      setLiked(new Set())
      setFollowing(new Set())
      hadAuthenticatedUser.current = false
    }
  }, [initialFollowedFounderUserIds, initialLikedProjectIds, user])
  /* eslint-enable react-hooks/set-state-in-effect */

  const registerLikeCount = useCallback((id: number, count: number) => {
    setLikeCounts((current) => current.has(id) ? current : new Map(current).set(id, count))
  }, [])

  const registerFollowerCount = useCallback((userId: string, count: number) => {
    setFollowerCounts((current) => current.has(userId) ? current : new Map(current).set(userId, count))
  }, [])

  const mutateLike = useCallback(async (id: number, nextLiked: boolean) => {
    const wasLiked = liked.has(id)
    if (wasLiked === nextLiked) return
    const previousLiked = new Set(liked)
    const previousCounts = new Map(likeCounts)
    setLiked((current) => {
      const next = new Set(current)
      if (nextLiked) next.add(id)
      else next.delete(id)
      return next
    })
    setLikeCounts((current) => {
      const next = new Map(current)
      if (next.has(id)) next.set(id, Math.max(0, next.get(id)! + (nextLiked ? 1 : -1)))
      return next
    })
    const result = nextLiked ? await likeProject(id) : await unlikeProject(id)
    if (result.error || !result.data) {
      setLiked(previousLiked)
      setLikeCounts(previousCounts)
      throw new Error('Like mutation failed')
    }
    setLikeCounts((current) => new Map(current).set(id, result.data!.likeCount))
  }, [likeCounts, liked])

  const like = useCallback((id: number) => mutateLike(id, true), [mutateLike])
  const unlike = useCallback((id: number) => mutateLike(id, false), [mutateLike])

  const mutateFollow = useCallback(async (userId: string, nextFollowing: boolean) => {
    const wasFollowing = following.has(userId)
    if (wasFollowing === nextFollowing) return
    const previousFollowing = new Set(following)
    const previousCounts = new Map(followerCounts)
    setFollowing((current) => {
      const next = new Set(current)
      if (nextFollowing) next.add(userId)
      else next.delete(userId)
      return next
    })
    setFollowerCounts((current) => {
      const next = new Map(current)
      if (next.has(userId)) next.set(userId, Math.max(0, next.get(userId)! + (nextFollowing ? 1 : -1)))
      return next
    })
    const result = nextFollowing ? await followFounder(userId) : await unfollowFounder(userId)
    if (result.error || !result.data) {
      setFollowing(previousFollowing)
      setFollowerCounts(previousCounts)
      throw new Error('Follow mutation failed')
    }
    setFollowerCounts((current) => new Map(current).set(userId, result.data!.followerCount))
  }, [followerCounts, following])

  const follow = useCallback((userId: string) => mutateFollow(userId, true), [mutateFollow])
  const unfollow = useCallback((userId: string) => mutateFollow(userId, false), [mutateFollow])

  return <InteractionContext value={{ liked, following, likeCounts, followerCounts, registerLikeCount, registerFollowerCount, like, unlike, follow, unfollow }}>{children}</InteractionContext>
}

export function useUserInteraction() {
  const context = useContext(InteractionContext)
  if (!context) throw new Error('useUserInteraction must be used within UserInteractionProvider')
  return context
}

export function useOptionalUserInteraction() {
  return useContext(InteractionContext)
}
