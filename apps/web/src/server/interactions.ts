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
