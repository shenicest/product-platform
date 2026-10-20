import { Elysia, status, t } from 'elysia'
import { db } from '../../db'
import { authPlugin } from '../../plugins/auth'
import { ErrorResponse } from '../../common'
import { ProjectConnectionError, ProjectConnectionService } from './service'
import {
  AcceptConnectionBody,
  ConnectionIdParams,
  ConnectionProjectParams,
  CreateConnectionBody,
} from './model'

export const projectConnectionService = new ProjectConnectionService(db, {
  webBaseUrl: process.env.SHENICEST_WEB_BASE_URL,
})

function errorBody(error: ProjectConnectionError) {
  return { error: { code: error.code, message: error.message } }
}

function handleError(error: unknown) {
  if (!(error instanceof ProjectConnectionError)) {
    return status(500, { error: { code: 'INTERNAL_ERROR', message: '服务器内部错误，请稍后再试' } })
  }
  const code = error.code
  if (['PROJECT_NOT_FOUND', 'REQUEST_NOT_FOUND'].includes(code)) return status(404, errorBody(error))
  if (
    [
      'CANNOT_CONNECT_SELF',
      'PENDING_EXISTS',
      'ALREADY_CONNECTED',
      'RATE_LIMITED',
      'REQUEST_NOT_PENDING',
      'RETRY_COOLDOWN',
    ].includes(code)
  ) {
    return status(409, errorBody(error))
  }
  if (['REQUEST_FORBIDDEN', 'CONTACTS_FORBIDDEN'].includes(code)) return status(403, errorBody(error))
  return status(400, errorBody(error))
}

export const projectConnectionModule = new Elysia()
  .use(authPlugin)
  .model({
    CreateConnectionBody,
    ConnectionProjectParams,
    ConnectionIdParams,
    AcceptConnectionBody,
  })
  .prefix('model', 'ProjectConnection.')
  .post('/projects/:id/connections', async ({ user, params, body }) => {
    try {
      return await projectConnectionService.create(user.userId, params.id, body)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'ProjectConnection.ConnectionProjectParams',
    body: 'ProjectConnection.CreateConnectionBody',
    detail: { tags: ['Project'], summary: 'Create a platform-project connection request' },
    response: { 200: t.Any(), 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .get('/projects/:id/connections/me', async ({ user, params }) => {
    return projectConnectionService.statusFor(user.userId, params.id)
  }, {
    auth: true,
    params: 'ProjectConnection.ConnectionProjectParams',
    detail: { tags: ['Project'], summary: 'My connection request status for a platform project' },
    response: { 200: t.Any(), 401: ErrorResponse },
  })
  .post('/connections/projects/:id/accept', async ({ user, params, body }) => {
    try {
      return await projectConnectionService.accept(user.userId, params.id, body)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'ProjectConnection.ConnectionIdParams',
    body: 'ProjectConnection.AcceptConnectionBody',
    detail: { tags: ['Connections'], summary: 'Accept a project connection request and authorize my contact' },
    response: { 200: t.Any(), 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .post('/connections/projects/:id/ignore', async ({ user, params }) => {
    try {
      return await projectConnectionService.ignore(user.userId, params.id)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'ProjectConnection.ConnectionIdParams',
    detail: { tags: ['Connections'], summary: 'Ignore a project connection request' },
    response: { 200: t.Any(), 404: ErrorResponse, 409: ErrorResponse },
  })
  .get('/connections/projects/:id/contacts', async ({ user, params }) => {
    try {
      return await projectConnectionService.contacts(user.userId, params.id)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'ProjectConnection.ConnectionIdParams',
    detail: { tags: ['Connections'], summary: 'Read authorized contacts of an accepted project connection' },
    response: { 200: t.Any(), 403: ErrorResponse },
  })
