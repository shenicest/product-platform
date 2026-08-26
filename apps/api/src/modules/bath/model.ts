import { t } from 'elysia'

export const BathSlotsQuery = t.Object({
  date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' }),
})
export type BathSlotsQuery = typeof BathSlotsQuery.static

export const BathSlot = t.Object({
  timeSlot: t.String(),
  booked: t.Boolean(),
  name: t.Optional(t.String()),
  bookingId: t.Optional(t.Number()),
  isMine: t.Optional(t.Boolean()),
})

export const BathSlotsResponse = t.Object({
  date: t.String(),
  gender: t.Union([t.Literal('male'), t.Literal('female')]),
  myBooking: t.Nullable(t.Object({
    id: t.Number(),
    timeSlot: t.String(),
  })),
  slots: t.Array(BathSlot),
})
export type BathSlotsResponse = typeof BathSlotsResponse.static

export const BathBookBody = t.Object({
  date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  timeSlot: t.String({ pattern: '^\\d{2}:\\d{2}$' }),
})
export type BathBookBody = typeof BathBookBody.static

export const BathBookResponse = t.Object({
  id: t.Number(),
  date: t.String(),
  timeSlot: t.String(),
  gender: t.String(),
})
export type BathBookResponse = typeof BathBookResponse.static

export const BathCancelParams = t.Object({
  id: t.String({ minLength: 1 }),
})
export type BathCancelParams = typeof BathCancelParams.static

export class NotCheckedInError extends Error {
  readonly code = 'NOT_CHECKED_IN'
  constructor() {
    super('您尚未签到，请先完成签到')
  }
}

export class AlreadyBookedTodayError extends Error {
  readonly code = 'ALREADY_BOOKED_TODAY'
  constructor() {
    super('您今天已预约过，每人每天仅限 1 次')
  }
}

export class SlotTakenError extends Error {
  readonly code = 'SLOT_TAKEN'
  constructor() {
    super('该时段已被预约')
  }
}

export class BookingNotFoundError extends Error {
  readonly code = 'BOOKING_NOT_FOUND'
  constructor() {
    super('预约不存在')
  }
}

export class NotBookingOwnerError extends Error {
  readonly code = 'NOT_BOOKING_OWNER'
  constructor() {
    super('只能取消自己的预约')
  }
}

export class InvalidSlotError extends Error {
  readonly code = 'INVALID_SLOT'
  constructor() {
    super('无效的时段')
  }
}
