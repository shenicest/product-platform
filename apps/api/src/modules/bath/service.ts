import { and, eq, isNull, sql } from 'drizzle-orm'
import { bathBookings, bathConfig } from '../../db/schema'
import type { Database } from '../../db'
import { AlreadyBookedTodayError, AlreadyCheckedOutError, BathBookingBannedError, BookingNotFoundError, CancellationClosedError, CheckoutExpiredError, CheckoutNotStartedError, InvalidConfigError, InvalidDateError, InvalidGenderError, InvalidSlotError, InvalidTimeConfigError, NotAdminError, NotBookingOwnerError, NotCheckedInError, SlotTakenError } from './model'

const APPLICATION_TABLE = 'event_management.applications'
const EVENT_ID = 4
const DEFAULT_EVENT_START = '2026-08-27'
const DEFAULT_EVENT_END = '2026-08-30'
const DEFAULT_DAILY_START = '09:00'
const DEFAULT_DAILY_END = '21:00'
const ADMIN_EMAIL_SUFFIX = '@shenicest.cn'
const SLOT_DURATION_MINUTES = 30
const CHECKOUT_GRACE_MINUTES = 3

type AppRow = {
  user_id: number
  form_data: string | null
}

function getTodayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function add30Min(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const totalMin = h * 60 + m + 30
  const nh = Math.floor(totalMin / 60)
  const nm = totalMin % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function bookingStart(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`)
}

function calculateCheckoutDeadline(date: string, time: string, durationSlots: number): Date {
  return new Date(bookingStart(date, time).getTime() + (durationSlots * SLOT_DURATION_MINUTES + CHECKOUT_GRACE_MINUTES) * 60_000)
}

function bookingEnd(date: string, time: string, durationSlots: number): Date {
  return new Date(bookingStart(date, time).getTime() + durationSlots * SLOT_DURATION_MINUTES * 60_000)
}

function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false
  const [h, m] = t.split(':').map(Number)
  return h >= 0 && h <= 23 && (m === 0 || m === 30)
}

function generateSlots(dailyStart: string, dailyEnd: string): string[] {
  const slots: string[] = []
  let cur = dailyStart
  while (cur < dailyEnd) {
    slots.push(cur)
    cur = add30Min(cur)
  }
  return slots
}

export class BathService {
  constructor(private db: Database, private now: () => Date = () => new Date()) {}

  async hasMissedCheckout(userId: string): Promise<boolean> {
    const uncheckedBookings = await this.db
      .select({
        date: bathBookings.date,
        timeSlot: bathBookings.timeSlot,
        durationSlots: bathBookings.durationSlots,
        checkoutDeadline: bathBookings.checkoutDeadline,
      })
      .from(bathBookings)
      .where(and(eq(bathBookings.userId, userId), isNull(bathBookings.checkedOutAt)))

    const now = this.now()
    return uncheckedBookings.some((booking) => {
      const deadline = booking.checkoutDeadline ?? calculateCheckoutDeadline(booking.date, booking.timeSlot, booking.durationSlots)
      return now > deadline
    })
  }

  isAdmin(email: string | null): boolean {
    return !!email && email.toLowerCase().endsWith(ADMIN_EMAIL_SUFFIX)
  }

  async getConfig(): Promise<{ eventStart: string; eventEnd: string; dailyStart: string; dailyEnd: string }> {
    const [row] = await this.db.select().from(bathConfig).limit(1)
    if (!row) {
      return {
        eventStart: DEFAULT_EVENT_START,
        eventEnd: DEFAULT_EVENT_END,
        dailyStart: DEFAULT_DAILY_START,
        dailyEnd: DEFAULT_DAILY_END,
      }
    }
    return { eventStart: row.eventStart, eventEnd: row.eventEnd, dailyStart: row.dailyStart, dailyEnd: row.dailyEnd }
  }

  async updateConfig(email: string | null, eventStart: string, eventEnd: string, dailyStart: string, dailyEnd: string) {
    if (!this.isAdmin(email)) return { error: new NotAdminError() }
    if (eventEnd < eventStart) return { error: new InvalidConfigError() }
    if (!isValidTime(dailyStart) || !isValidTime(dailyEnd) || dailyStart >= dailyEnd) return { error: new InvalidTimeConfigError() }

    const existing = await this.db.select({ id: bathConfig.id }).from(bathConfig).limit(1)
    if (existing.length > 0) {
      await this.db.update(bathConfig)
        .set({ eventStart, eventEnd, dailyStart, dailyEnd, updatedBy: email ?? null })
        .where(eq(bathConfig.id, existing[0].id))
    } else {
      await this.db.insert(bathConfig).values({ eventStart, eventEnd, dailyStart, dailyEnd, updatedBy: email ?? null })
    }

    return { data: { eventStart, eventEnd, dailyStart, dailyEnd } }
  }

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

  // Admins (@shenicest.cn) are exempt from the check-in requirement: they may
  // pass an explicit gender to choose a bathroom when their application record
  // is absent or not checked in. Non-admins always use the application gender.
  async resolveGender(userId: string, email: string | null, fallbackGender?: 'male' | 'female'): Promise<'male' | 'female' | NotCheckedInError | InvalidGenderError> {
    const isAdmin = this.isAdmin(email)
    if (isAdmin && fallbackGender) return fallbackGender

    const appGender = await this.getUserGender(userId)
    if (appGender) return appGender
    if (isAdmin) return new InvalidGenderError()
    return new NotCheckedInError()
  }

  async isCheckedIn(userId: string): Promise<boolean> {
    const gender = await this.getUserGender(userId)
    return gender !== null
  }

  async getSlots(userId: string, email: string | null, date: string, fallbackGender?: 'male' | 'female') {
    const config = await this.getConfig()
    if (!(date >= config.eventStart && date <= config.eventEnd)) return { error: new InvalidDateError() }

    const gender = await this.resolveGender(userId, email, fallbackGender)
    if (gender instanceof NotCheckedInError || gender instanceof InvalidGenderError) return { error: gender }

    const slotsList = generateSlots(config.dailyStart, config.dailyEnd)

    const todayBookings = await this.db
      .select()
      .from(bathBookings)
      .where(and(eq(bathBookings.date, date), eq(bathBookings.gender, gender)))

    const myBooking = todayBookings.find((b) => b.userId === userId) ?? null

    const bookingsBySlot = new Map<string, { userId: string; id: number }>()
    for (const b of todayBookings) {
      bookingsBySlot.set(b.timeSlot, { userId: b.userId, id: b.id })
      if (b.durationSlots === 2) bookingsBySlot.set(add30Min(b.timeSlot), { userId: b.userId, id: b.id })
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
      slotsList.map(async (slot) => {
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
      eventStart: config.eventStart,
      eventEnd: config.eventEnd,
      dailyStart: config.dailyStart,
      dailyEnd: config.dailyEnd,
      myBooking: myBooking ? {
        id: myBooking.id,
        timeSlot: myBooking.timeSlot,
        durationSlots: myBooking.durationSlots as 1 | 2,
        checkedOutAt: myBooking.checkedOutAt?.toISOString() ?? null,
      } : null,
      slots,
    }
  }

  async book(userId: string, email: string | null, date: string, timeSlot: string, durationSlots = 1, fallbackGender?: 'male' | 'female') {
    if (await this.hasMissedCheckout(userId)) return { error: new BathBookingBannedError() }

    const config = await this.getConfig()
    if (!(date >= config.eventStart && date <= config.eventEnd)) return { error: new InvalidDateError() }
    const availableSlots = generateSlots(config.dailyStart, config.dailyEnd)
    const requestedSlots = Array.from({ length: durationSlots }, (_, index) => index === 0 ? timeSlot : add30Min(timeSlot))
    if (![1, 2].includes(durationSlots) || requestedSlots.some((slot) => !availableSlots.includes(slot))) return { error: new InvalidSlotError() }

    const gender = await this.resolveGender(userId, email, fallbackGender)
    if (gender instanceof NotCheckedInError || gender instanceof InvalidGenderError) return { error: gender }

    const existing = await this.db
      .select()
      .from(bathBookings)
      .where(and(eq(bathBookings.userId, userId), eq(bathBookings.date, date)))
      .limit(1)
    if (existing.length > 0) return { error: new AlreadyBookedTodayError() }

    const occupied = await this.db.select({ timeSlot: bathBookings.timeSlot, durationSlots: bathBookings.durationSlots })
      .from(bathBookings)
      .where(and(eq(bathBookings.date, date), eq(bathBookings.gender, gender)))
    const occupiedSlots = new Set(occupied.flatMap((booking) => Array.from({ length: booking.durationSlots }, (_, index) => index === 0 ? booking.timeSlot : add30Min(booking.timeSlot))))
    if (requestedSlots.some((slot) => occupiedSlots.has(slot))) return { error: new SlotTakenError() }

    try {
      const [result] = await this.db
        .insert(bathBookings)
        .values({
          userId,
          date,
          timeSlot,
          gender,
          durationSlots: durationSlots as 1 | 2,
          checkoutDeadline: calculateCheckoutDeadline(date, timeSlot, durationSlots),
        })
        .execute()
      return {
        data: {
          id: Number(result.insertId),
          date,
          timeSlot,
          durationSlots: durationSlots as 1 | 2,
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
    if (this.now() >= bookingStart(booking.date, booking.timeSlot)) return { error: new CancellationClosedError() }

    await this.db.delete(bathBookings).where(eq(bathBookings.id, bookingId))
    return { data: { success: true } }
  }

  async checkout(userId: string, bookingId: number) {
    const [booking] = await this.db
      .select()
      .from(bathBookings)
      .where(eq(bathBookings.id, bookingId))
      .limit(1)

    if (!booking) return { error: new BookingNotFoundError() }
    if (booking.userId !== userId) return { error: new NotBookingOwnerError() }
    if (booking.checkedOutAt) return { error: new AlreadyCheckedOutError() }

    const now = this.now()
    if (now < bookingEnd(booking.date, booking.timeSlot, booking.durationSlots)) return { error: new CheckoutNotStartedError() }
    const deadline = booking.checkoutDeadline ?? calculateCheckoutDeadline(booking.date, booking.timeSlot, booking.durationSlots)
    if (now > deadline) return { error: new CheckoutExpiredError() }

    const result = await this.db.update(bathBookings)
      .set({ checkedOutAt: now })
      .where(and(eq(bathBookings.id, bookingId), isNull(bathBookings.checkedOutAt)))
    if (result[0].affectedRows === 0) return { error: new AlreadyCheckedOutError() }
    return { data: { success: true, checkedOutAt: now.toISOString() } }
  }
}
