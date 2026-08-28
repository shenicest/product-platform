import { afterAll, describe, expect, it } from 'bun:test'
import { inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { bathBookings } from '../../../src/db/schema'
import {
  BathBookingBannedError,
  CancellationClosedError,
  CheckoutExpiredError,
  CheckoutNotStartedError,
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

  it('allows checkout as soon as the booking starts and records the checkout time', async () => {
    const userId = `bath-checkout-${crypto.randomUUID()}`
    const bookingId = await createBooking(userId, '2026-08-27', '10:00')
    const now = new Date('2026-08-27T10:00:00+08:00')
    const service = new BathService(db, () => now)

    const result = await service.checkout(userId, bookingId)

    expect(result).toEqual({ data: { success: true, checkedOutAt: now.toISOString() } })
    expect(await service.hasMissedCheckout(userId)).toBe(false)
  })

  it('rejects checkout before the booking starts', async () => {
    const userId = `bath-not-started-${crypto.randomUUID()}`
    const bookingId = await createBooking(userId, '2026-08-27', '10:30')
    const service = new BathService(db, () => new Date('2026-08-27T10:29:59+08:00'))

    const result = await service.checkout(userId, bookingId)

    expect(result.error).toBeInstanceOf(CheckoutNotStartedError)
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

  it('books two consecutive slots and blocks the second slot', async () => {
    const userId = `bath-double-${crypto.randomUUID()}`
    const bookingId = await createBooking(`bath-occupied-${crypto.randomUUID()}`, '2026-08-28', '14:30')
    const service = new BathService(db, () => new Date('2026-08-27T09:00:00+08:00'))

    const result = await service.book(userId, 'admin@shenicest.cn', '2026-08-28', '13:30', 2, 'male')
    const blockedUserId = `bath-blocked-${crypto.randomUUID()}`
    userIds.push(blockedUserId)
    const blocked = await service.book(blockedUserId, 'admin@shenicest.cn', '2026-08-28', '14:00', 1, 'male')

    expect(result.error).toBeUndefined()
    expect((result.data as { durationSlots: number }).durationSlots).toBe(2)
    expect(blocked.error?.code).toBe('SLOT_TAKEN')
    await db.delete(bathBookings).where(inArray(bathBookings.id, [bookingId]))
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

describe('BathService gender resolution', () => {
  it.each([
    ['male', 'male'],
    ['female', 'female'],
  ] as const)('accepts the %s gender value from application form data', async (formGender, expectedGender) => {
    const service = new BathService({
      execute: async () => [[{ form_data: JSON.stringify({ gender: formGender }) }]],
    } as unknown as typeof db)

    expect(await service.getUserGender('123')).toBe(expectedGender)
  })
})
