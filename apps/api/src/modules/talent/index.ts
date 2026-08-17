import { Elysia, status, t } from 'elysia'
import { db } from '../../db'
import { ErrorResponse } from '../../common'
import { authPlugin } from '../../plugins/auth'
import { dbPlugin } from '../../plugins/db'
import { roleGuardPlugin } from '../../plugins/role-guard'
import { TalentError, TalentService } from './service'
import {
  AcceptBody,
  ConnectionBody,
  ConnectionParams,
  ErrorResponse as TalentErrorResponse,
  OperatorTalentQuery,
  SuspendBody,
  TalentListQuery,
  TalentProfileBody,
} from './model'

const service = new TalentService(db)

function errorBody(error: TalentError) {
  return { error: { code: error.code, message: error.message } }
}

function isCode(error: TalentError, codes: string[]) {
  return codes.includes(error.code)
}

function handleError(error: unknown) {
  if (!(error instanceof TalentError)) return status(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  if (isCode(error, ['PROFILE_NOT_FOUND', 'REQUEST_NOT_FOUND', 'PROJECT_NOT_FOUND', 'RECEIVER_NOT_PUBLISHED'])) return status(404, errorBody(error))
  if (isCode(error, ['REQUEST_FORBIDDEN', 'CONTACTS_FORBIDDEN', 'PROJECT_FORBIDDEN'])) return status(403, errorBody(error))
  if (isCode(error, ['PENDING_EXISTS', 'ALREADY_CONNECTED', 'REQUEST_NOT_PENDING', 'PROFILE_SUSPENDED', 'RATE_LIMITED', 'PROJECT_NOT_LIVE'])) return status(409, errorBody(error))
  return status(400, errorBody(error))
}

export const talentModule = new Elysia({ prefix: '/talents' })
  .use(dbPlugin)
  .use(authPlugin)
  .model({ TalentProfileBody, TalentListQuery, ConnectionBody, AcceptBody, ConnectionParams })
  .prefix('model', 'Talent.')
  .get('/', async ({ query }) => service.list(query), {
    optionalAuth: true,
    query: 'Talent.TalentListQuery',
    detail: { tags: ['Talent'], summary: 'List published talent profiles' },
  })
  .get('/me', async ({ user }) => {
    try { return await service.management(user.userId) } catch (error) { return handleError(error) }
  }, {
    auth: true,
    detail: { tags: ['Talent'], summary: 'Get my talent profile management data' },
    response: { 200: t.Any(), 401: ErrorResponse, 404: TalentErrorResponse },
  })
  .get('/connections', async ({ user }) => service.connections(user.userId), {
    auth: true,
    detail: { tags: ['Talent'], summary: 'List my connection requests' },
  })
  .get('/connections/:id/contacts', async ({ user, params }) => {
    try { return await service.contacts(user.userId, params.id) } catch (error) { return handleError(error) }
  }, {
    auth: true,
    params: 'Talent.ConnectionParams',
    detail: { tags: ['Talent'], summary: 'Get contacts for an accepted connection' },
    response: { 200: t.Any(), 403: ErrorResponse, 404: ErrorResponse },
  })
  .post('/connections', async ({ user, body }) => {
    try {
      const request = await service.send(user.userId, body)
      return service.connection(user.userId, request.id)
    } catch (error) { return handleError(error) }
  }, {
    auth: true,
    body: 'Talent.ConnectionBody',
    detail: { tags: ['Talent'], summary: 'Create a connection request' },
    response: { 200: t.Any(), 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .post('/connections/:id/accept', async ({ user, params, body }) => {
    try {
      await service.accept(user.userId, params.id, body)
      return service.connection(user.userId, params.id)
    } catch (error) { return handleError(error) }
  }, {
    auth: true,
    params: 'Talent.ConnectionParams',
    body: 'Talent.AcceptBody',
    detail: { tags: ['Talent'], summary: 'Accept a connection request' },
    response: { 200: t.Any(), 400: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .post('/connections/:id/ignore', async ({ user, params }) => {
    try {
      await service.ignore(user.userId, params.id)
      return service.connection(user.userId, params.id)
    } catch (error) { return handleError(error) }
  }, {
    auth: true,
    params: 'Talent.ConnectionParams',
    detail: { tags: ['Talent'], summary: 'Ignore a connection request' },
    response: { 400: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .post('/me', async ({ user, body }) => {
    try { return await service.publish(user.userId, body) } catch (error) { return handleError(error) }
  }, {
    auth: true,
    body: 'Talent.TalentProfileBody',
    detail: { tags: ['Talent'], summary: 'Publish or resume my talent profile' },
    response: { 200: t.Any(), 400: ErrorResponse, 409: ErrorResponse },
  })
  .post('/me/resume', async ({ user, body }) => {
    try { return await service.resume(user.userId, body) } catch (error) { return handleError(error) }
  }, {
    auth: true,
    body: 'Talent.TalentProfileBody',
    detail: { tags: ['Talent'], summary: 'Resume my paused talent profile' },
    response: { 200: t.Any(), 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .put('/me', async ({ user, body }) => {
    try { return await service.update(user.userId, body) } catch (error) { return handleError(error) }
  }, {
    auth: true,
    body: 'Talent.TalentProfileBody',
    detail: { tags: ['Talent'], summary: 'Edit my talent profile' },
    response: { 200: t.Any(), 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .post('/me/pause', async ({ user }) => {
    try { return await service.pause(user.userId) } catch (error) { return handleError(error) }
  }, {
    auth: true,
    detail: { tags: ['Talent'], summary: 'Pause my talent profile' },
    response: { 200: t.Any(), 404: ErrorResponse, 409: ErrorResponse },
  })
  .get('/:userId', async ({ params, user }) => {
    try { return await service.detail(params.userId, user?.userId) } catch (error) { return handleError(error) }
  }, {
    optionalAuth: true,
    detail: { tags: ['Talent'], summary: 'Get a published talent profile' },
    response: { 200: t.Any(), 404: ErrorResponse },
  })

export const talentOperatorModule = new Elysia({ prefix: '/operator/talents' })
  .use(dbPlugin)
  .use(authPlugin)
  .use(roleGuardPlugin)
  .model({ OperatorTalentQuery, SuspendBody })
  .prefix('model', 'Talent.')
  .get('/', async ({ query }) => service.operatorList(query), {
    operatorOnly: true,
    query: 'Talent.OperatorTalentQuery',
    detail: { tags: ['Operator'], summary: 'Search talent profiles' },
  })
  .get('/:userId/suspension-audit', async ({ params }) => {
    try { return await service.suspensionAudit(params.userId) } catch (error) { return handleError(error) }
  }, {
    operatorOnly: true,
    detail: { tags: ['Operator'], summary: 'Get talent suspension audit' },
    response: { 200: t.Any(), 404: ErrorResponse },
  })
  .get('/:userId', async ({ params }) => {
    try { return await service.management(params.userId) } catch (error) { return handleError(error) }
  }, {
    operatorOnly: true,
    detail: { tags: ['Operator'], summary: 'View a talent profile' },
    response: { 200: t.Any(), 404: ErrorResponse },
  })
  .post('/:userId/suspend', async ({ user, params, body }) => {
    try { return await service.suspend(user.userId, params.userId, body.reason) } catch (error) { return handleError(error) }
  }, {
    operatorOnly: true,
    body: 'Talent.SuspendBody',
    detail: { tags: ['Operator'], summary: 'Suspend a talent profile' },
    response: { 200: t.Any(), 404: ErrorResponse, 409: ErrorResponse },
  })
