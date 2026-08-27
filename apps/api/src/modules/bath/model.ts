import { t } from 'elysia'

export const BathSlotsQuery = t.Object({
  date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD' }),
  gender: t.Optional(t.Union([t.Literal('male'), t.Literal('female')])),
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
  eventStart: t.String(),
  eventEnd: t.String(),
  dailyStart: t.String(),
  dailyEnd: t.String(),
  myBooking: t.Nullable(t.Object({
    id: t.Number(),
    timeSlot: t.String(),
    checkedOutAt: t.Nullable(t.String()),
  })),
  slots: t.Array(BathSlot),
})
export type BathSlotsResponse = typeof BathSlotsResponse.static

export const BathConfigResponse = t.Object({
  eventStart: t.String(),
  eventEnd: t.String(),
  dailyStart: t.String(),
  dailyEnd: t.String(),
})
export type BathConfigResponse = typeof BathConfigResponse.static

export const BathConfigBody = t.Object({
  eventStart: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  eventEnd: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  dailyStart: t.String({ pattern: '^\\d{2}:\\d{2}$' }),
  dailyEnd: t.String({ pattern: '^\\d{2}:\\d{2}$' }),
})
export type BathConfigBody = typeof BathConfigBody.static

export const BathBookBody = t.Object({
  date: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  timeSlot: t.String({ pattern: '^\\d{2}:\\d{2}$' }),
  gender: t.Optional(t.Union([t.Literal('male'), t.Literal('female')])),
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

export const BathCheckoutResponse = t.Object({
  success: t.Boolean(),
  checkedOutAt: t.String(),
})
export type BathCheckoutResponse = typeof BathCheckoutResponse.static

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
    super('只能操作自己的预约')
  }
}

export class BathBookingBannedError extends Error {
  readonly code = 'BATH_BOOKING_BANNED'
  constructor() {
    super('您曾未在预约结束后 3 分钟内签退，已无法再次预约洗澡')
  }
}

export class AlreadyCheckedOutError extends Error {
  readonly code = 'ALREADY_CHECKED_OUT'
  constructor() {
    super('该预约已签退')
  }
}

export class CheckoutNotStartedError extends Error {
  readonly code = 'CHECKOUT_NOT_STARTED'
  constructor() {
    super('预约开始后才能签退')
  }
}

export class CheckoutExpiredError extends Error {
  readonly code = 'CHECKOUT_EXPIRED'
  constructor() {
    super('已超过预约结束后 3 分钟的签退期限，您将无法再次预约洗澡')
  }
}

export class CancellationClosedError extends Error {
  readonly code = 'CANCELLATION_CLOSED'
  constructor() {
    super('预约已开始，不能取消，请完成签退')
  }
}

export class InvalidSlotError extends Error {
  readonly code = 'INVALID_SLOT'
  constructor() {
    super('无效的时段')
  }
}

export class InvalidDateError extends Error {
  readonly code = 'INVALID_DATE'
  constructor() {
    super('预约开放日期为 8/27 - 8/30')
  }
}

export class NotAdminError extends Error {
  readonly code = 'FORBIDDEN'
  constructor() {
    super('无管理员权限')
  }
}

export class InvalidConfigError extends Error {
  readonly code = 'INVALID_CONFIG'
  constructor() {
    super('结束日期不能早于开始日期')
  }
}

export class InvalidTimeConfigError extends Error {
  readonly code = 'INVALID_TIME_CONFIG'
  constructor() {
    super('开放时间需为整点或半点，且开始时间需早于结束时间')
  }
}

export class InvalidGenderError extends Error {
  readonly code = 'INVALID_GENDER'
  constructor() {
    super('请选择浴室（男/女）')
  }
}
