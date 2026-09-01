import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'

export const getMyLikes = cache(async (): Promise<number[]> => {
  const token = (await cookies()).get('shenicest_token')?.value
  if (!token) return []
  const { data, error } = await api.me.likes.get({ headers: { cookie: `shenicest_token=${token}` } })
  if (error || !data) return []
  return data.liked_project_ids
})

export const getMyFollows = cache(async (): Promise<string[]> => {
  const token = (await cookies()).get('shenicest_token')?.value
  if (!token) return []
  const { data, error } = await api.me.follows.get({ headers: { cookie: `shenicest_token=${token}` } })
  if (error || !data) return []
  return data.followed_founder_user_ids
})

export const getMyHackathonLikes = cache(async (): Promise<number[]> => {
  const token = (await cookies()).get('shenicest_token')?.value
  if (!token) return []
  const { data, error } = await api.me['hackathon-likes'].get({ headers: { cookie: `shenicest_token=${token}` } })
  if (error || !data) return []
  return data.liked_hackathon_project_ids
})
