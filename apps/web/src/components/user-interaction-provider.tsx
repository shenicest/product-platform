'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { likeProject, unlikeProject } from '@/lib/client-api'

interface InteractionState {
  liked: Set<number>
  followed: Set<number>
  likeCounts: Map<number, number>
  registerLikeCount: (id: number, count: number) => void
  like: (id: number) => Promise<void>
  unlike: (id: number) => Promise<void>
}

const InteractionContext = createContext<InteractionState | null>(null)

export function UserInteractionProvider({ initialLikedProjectIds, children }: { initialLikedProjectIds: number[]; children: React.ReactNode }) {
  const { user } = useAuth()
  const hadAuthenticatedUser = useRef(false)
  const [liked, setLiked] = useState(() => new Set(initialLikedProjectIds))
  const [followed] = useState(() => new Set<number>())
  const [likeCounts, setLikeCounts] = useState(() => new Map<number, number>())

  useEffect(() => {
    if (user) {
      hadAuthenticatedUser.current = true
      setLiked(new Set(initialLikedProjectIds))
    } else if (hadAuthenticatedUser.current) {
      setLiked(new Set())
      hadAuthenticatedUser.current = false
    }
  }, [initialLikedProjectIds, user])

  const registerLikeCount = useCallback((id: number, count: number) => {
    setLikeCounts((current) => current.has(id) ? current : new Map(current).set(id, count))
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

  return <InteractionContext value={{ liked, followed, likeCounts, registerLikeCount, like, unlike }}>{children}</InteractionContext>
}

export function useUserInteraction() {
  const context = useContext(InteractionContext)
  if (!context) throw new Error('useUserInteraction must be used within UserInteractionProvider')
  return context
}

export function useOptionalUserInteraction() {
  return useContext(InteractionContext)
}
