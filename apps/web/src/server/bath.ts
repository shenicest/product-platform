import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'

export interface BathSlot {
  timeSlot: string
  booked: boolean
  name?: string
  bookingId?: number
  isMine?: boolean
}

export interface BathSlotsData {
  date: string
  gender: 'male' | 'female'
  myBooking: { id: number; timeSlot: string } | null
  slots: BathSlot[]
}

export const getBathSlots = cache(async (date: string): Promise<BathSlotsData | null> => {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  if (!token) return null

  try {
    const headers = { cookie: `shenicest_token=${token}` }
    const { data, error } = await api.bath.slots.get({ query: { date }, headers })
    if (error || !data) return null
    return data as BathSlotsData
  } catch {
    return null
  }
})
