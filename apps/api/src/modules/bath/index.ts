import { Elysia, status, t } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { ErrorResponse } from '../../common'
import {
  AlreadyBookedTodayError,
  BathBookBody,
  BathBookResponse,
  BathSlotsQuery,
  BathSlotsResponse,
  BookingNotFoundError,
  InvalidSlotError,
  NotBookingOwnerError,
  NotCheckedInError,
  SlotTakenError,
} from './model'
import { BathService } from './service'

const bathService = new BathService(db)

const errorResponse = (err: unknown) => {
  if (err instanceof Error && 'code' in err) {
    return status(400 as any, { error: { code: (err as any).code, message: err.message } })
  }
  return status(500 as any, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
}

export const bathModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .model({ BathSlotsQuery, BathSlotsResponse, BathBookBody, BathBookResponse })
  .prefix('model', 'Bath.')
  .get('/bath/slots', async ({ user, query }) => {
    const result = await bathService.getSlots(user.userId, query.date)
    if (result.error) return errorResponse(result.error)
    return result
  }, {
    auth: true,
    query: 'Bath.BathSlotsQuery',
    response: { 200: 'Bath.BathSlotsResponse', 400: ErrorResponse, 401: ErrorResponse },
  })
  .post('/bath/bookings', async ({ user, body }) => {
    const result = await bathService.book(user.userId, body.date, body.timeSlot)
    if (result.error) return errorResponse(result.error)
    return result.data
  }, {
    auth: true,
    body: 'Bath.BathBookBody',
    response: { 200: 'Bath.BathBookResponse', 400: ErrorResponse, 401: ErrorResponse },
  })
  .delete('/bath/bookings/:id', async ({ user, params }) => {
    const id = Number(params.id)
    if (isNaN(id)) return errorResponse(new InvalidSlotError())
    const result = await bathService.cancel(user.userId, id)
    if (result.error) return errorResponse(result.error)
    return result.data
  }, {
    auth: true,
    params: t.Object({ id: t.String() }),
    response: { 200: t.Object({ success: t.Boolean() }), 400: ErrorResponse, 401: ErrorResponse },
  })
