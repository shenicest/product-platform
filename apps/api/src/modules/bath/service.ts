import { and, eq, sql } from 'drizzle-orm'
import { bathBookings } from '../../db/schema'
import type { Database } from '../../db'
import { AlreadyBookedTodayError, BookingNotFoundError, InvalidDateError, InvalidSlotError, NotBookingOwnerError, NotCheckedInError, SlotTakenError } from './model'

const APPLICATION_TABLE = 'event_management.applications'
const EVENT_ID = 4

function getTodayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const ALL_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) + 9
  const m = (i % 2) * 30
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

type AppRow = {
  user_id: number
  form_data: string | null
}

type BookingRow = {
  id: number
  userId: string
  date: string
  timeSlot: string
  gender: string
}

export class BathService {
  constructor(private db: Database) {}

  async getUserGender(userId: string): Promise<'male' | 'female' | null> {
    if (!/^\d+$/.test(userId)) return null
    try {
      const [rows] = (await this.db.execute(
        sql`SELECT form_data FROM ${sql.raw(APPLICATION_TABLE)} WHERE user_id = ${userId} AND event_id = ${EVENT_ID} AND status = 'checked_in' LIMIT 1`,
      )) as unknown as [AppRow[]]
      const row = rows[0]
      if (!row || !row.form_data) return null

      const formData = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data
      const genderRaw = formData.gender
      if (!genderRaw) return null

      const genderValue = Array.isArray(genderRaw) ? genderRaw[0] : genderRaw
      if (genderValue === '男性') return 'male'
      if (genderValue === '女性') return 'female'
      return null
    } catch {
      return null
    }
  }

  async getUserDisplayName(userId: string): Promise<string | null> {
    if (!/^\d+$/.test(userId)) return null
    try {
      const [rows] = (await this.db.execute(
        sql`SELECT form_data FROM ${sql.raw(APPLICATION_TABLE)} WHERE user_id = ${userId} AND event_id = ${EVENT_ID} AND status = 'checked_in' LIMIT 1`,
      )) as unknown as [AppRow[]]
      const row = rows[0]
      if (!row || !row.form_data) return null

      const formData = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data
      return formData.name ?? null
    } catch {
      return null
    }
  }

  async isCheckedIn(userId: string): Promise<boolean> {
    const gender = await this.getUserGender(userId)
    return gender !== null
  }

  async getSlots(userId: string, date: string) {
    if (date !== getTodayStr()) return { error: new InvalidDateError() }

    const gender = await this.getUserGender(userId)
    if (!gender) return { error: new NotCheckedInError() }

    const todayBookings = await this.db
      .select()
      .from(bathBookings)
      .where(and(eq(bathBookings.date, date), eq(bathBookings.gender, gender)))

    const myBooking = todayBookings.find((b) => b.userId === userId) ?? null

    const bookingsBySlot = new Map<string, { userId: string; id: number }>()
    for (const b of todayBookings) {
      bookingsBySlot.set(b.timeSlot, { userId: b.userId, id: b.id })
    }

    const nameCache = new Map<string, string>()
    const getName = async (uid: string): Promise<string> => {
      if (nameCache.has(uid)) return nameCache.get(uid)!
      const name = await this.getUserDisplayName(uid)
      const resolved = name ?? '未知用户'
      nameCache.set(uid, resolved)
      return resolved
    }

    const slots = await Promise.all(
      ALL_SLOTS.map(async (slot) => {
        const booking = bookingsBySlot.get(slot)
        if (!booking) {
          return { timeSlot: slot, booked: false }
        }
        const name = await getName(booking.userId)
        return {
          timeSlot: slot,
          booked: true,
          name,
          bookingId: booking.id,
          isMine: booking.userId === userId,
        }
      }),
    )

    return {
      date,
      gender,
      myBooking: myBooking ? { id: myBooking.id, timeSlot: myBooking.timeSlot } : null,
      slots,
    }
  }

  async book(userId: string, date: string, timeSlot: string) {
    if (date !== getTodayStr()) return { error: new InvalidDateError() }
    if (!ALL_SLOTS.includes(timeSlot)) return { error: new InvalidSlotError() }

    const gender = await this.getUserGender(userId)
    if (!gender) return { error: new NotCheckedInError() }

    const existing = await this.db
      .select()
      .from(bathBookings)
      .where(and(eq(bathBookings.userId, userId), eq(bathBookings.date, date)))
      .limit(1)
    if (existing.length > 0) return { error: new AlreadyBookedTodayError() }

    try {
      const [result] = await this.db
        .insert(bathBookings)
        .values({ userId, date, timeSlot, gender })
        .execute()
      return {
        data: {
          id: Number(result.insertId),
          date,
          timeSlot,
          gender,
        },
      }
    } catch {
      return { error: new SlotTakenError() }
    }
  }

  async cancel(userId: string, bookingId: number) {
    const [booking] = await this.db
      .select()
      .from(bathBookings)
      .where(eq(bathBookings.id, bookingId))
      .limit(1)

    if (!booking) return { error: new BookingNotFoundError() }
    if (booking.userId !== userId) return { error: new NotBookingOwnerError() }

    await this.db.delete(bathBookings).where(eq(bathBookings.id, bookingId))
    return { data: { success: true } }
  }
}
