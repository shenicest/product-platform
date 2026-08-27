import { afterAll, describe, expect, it } from 'bun:test'
import { inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { bathBookings } from '../../../src/db/schema'
import {
  BathBookingBannedError,
  CancellationClosedError,
  CheckoutExpiredError,
} from '../../../src/modules/bath/model'
import { BathService } from '../../../src/modules/bath/service'

const userIds: string[] = []

async function createBooking(userId: string, date: string, timeSlot: string) {
  userIds.push(userId)
  const [result] = await db.insert(bathBookings).values({
    userId,
    date,
    timeSlot,
    gender: 'male',
    checkoutDeadline: new Date(new Date(`${date}T${timeSlot}:00+08:00`).getTime() + 33 * 60_000),
  }).execute()
  return Number(result.insertId)
}

describe('BathService checkout', () => {
  afterAll(async () => {
    if (userIds.length > 0) {
      await db.delete(bathBookings).where(inArray(bathBookings.userId, userIds))
    }
  })

  it('checks out during the booking and records the checkout time', async () => {
    const userId = `bath-checkout-${crypto.randomUUID()}`
    const bookingId = await createBooking(userId, '2026-08-27', '10:00')
    const now = new Date('2026-08-27T10:30:00+08:00')
    const service = new BathService(db, () => now)

    const result = await service.checkout(userId, bookingId)

    expect(result).toEqual({ data: { success: true, checkedOutAt: now.toISOString() } })
    expect(await service.hasMissedCheckout(userId)).toBe(false)
  })

  it('allows checkout exactly three minutes after the booking ends', async () => {
    const userId = `bath-deadline-${crypto.randomUUID()}`
    const bookingId = await createBooking(userId, '2026-08-27', '11:00')
    const now = new Date('2026-08-27T11:33:00+08:00')
    const service = new BathService(db, () => now)

    const result = await service.checkout(userId, bookingId)

    expect(result.error).toBeUndefined()
  })

  it('permanently rejects future bookings after a missed checkout', async () => {
    const userId = `bath-banned-${crypto.randomUUID()}`
    const bookingId = await createBooking(userId, '2026-08-27', '12:00')
    const service = new BathService(db, () => new Date('2026-08-27T12:33:01+08:00'))

    const checkout = await service.checkout(userId, bookingId)
    const booking = await service.book(userId, null, '2026-08-28', '12:00')

    expect(checkout.error).toBeInstanceOf(CheckoutExpiredError)
    expect(booking.error).toBeInstanceOf(BathBookingBannedError)
  })

  it('does not allow cancellation after the booking starts', async () => {
    const userId = `bath-cancel-${crypto.randomUUID()}`
    const bookingId = await createBooking(userId, '2026-08-27', '13:00')
    const service = new BathService(db, () => new Date('2026-08-27T13:00:00+08:00'))

    const result = await service.cancel(userId, bookingId)

    expect(result.error).toBeInstanceOf(CancellationClosedError)
  })

  it('also evaluates legacy bookings without a stored deadline', async () => {
    const userId = `bath-legacy-${crypto.randomUUID()}`
    userIds.push(userId)
    await db.insert(bathBookings).values({
      userId,
      date: '2026-08-27',
      timeSlot: '09:00',
      gender: 'male',
    })
    const service = new BathService(db, () => new Date('2026-08-27T09:34:00+08:00'))

    expect(await service.hasMissedCheckout(userId)).toBe(true)
  })
})
