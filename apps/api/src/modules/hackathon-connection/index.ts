import { Elysia, status, t } from 'elysia'
import { db } from '../../db'
import { eventManagementDb } from '../../db/event-management'
import { authPlugin } from '../../plugins/auth'
import { ErrorResponse } from '../../common'
import { HackathonService } from '../hackathon/service'
import { HackathonConnectionError, HackathonConnectionService } from './service'
import {
  AcceptConnectionBody,
  ConnectionIdParams,
  ConnectionProjectParams,
  CreateConnectionBody,
} from './model'

// The seam (D5) is wired to the real HackathonService here; tests inject
// stubs into HackathonConnectionService directly and never import this file
// (it needs the event database).
const hackathonService = new HackathonService(eventManagementDb, db)
const service = new HackathonConnectionService(db, {
  getVisibleProject: (hackathonProjectId) => hackathonService.getProject(hackathonProjectId),
  getProjectSummary: async (hackathonProjectId) => {
    const project = await hackathonService.getProject(hackathonProjectId)
    return project ? { name: project.name } : null
  },
})

function errorBody(error: HackathonConnectionError) {
  return { error: { code: error.code, message: error.message } }
}

function handleError(error: unknown) {
  if (!(error instanceof HackathonConnectionError)) {
    return status(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
  }
  const code = error.code
  if (['PROJECT_NOT_FOUND', 'REQUEST_NOT_FOUND'].includes(code)) return status(404, errorBody(error))
  if (['NO_RECEIVER_CONFIGURED', 'PENDING_EXISTS', 'ALREADY_CONNECTED', 'RATE_LIMITED', 'REQUEST_NOT_PENDING', 'RETRY_COOLDOWN'].includes(code)) {
    return status(409, errorBody(error))
  }
  if (['REQUEST_FORBIDDEN', 'CONTACTS_FORBIDDEN'].includes(code)) return status(403, errorBody(error))
  return status(400, errorBody(error))
}

export { service as hackathonConnectionService }

export const hackathonConnectionModule = new Elysia()
  .use(authPlugin)
  .model({
    CreateConnectionBody,
    ConnectionProjectParams,
    ConnectionIdParams,
    AcceptConnectionBody,
  })
  .prefix('model', 'HackathonConnection.')
  .post('/hackathon/projects/:id/connections', async ({ user, params, body }) => {
    try {
      return await service.create(user.userId, params.id, body)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'HackathonConnection.ConnectionProjectParams',
    body: 'HackathonConnection.CreateConnectionBody',
    detail: { tags: ['Hackathon'], summary: 'Create a hackathon project connection request' },
    response: { 200: t.Any(), 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .get('/hackathon/projects/:id/connections/me', async ({ user, params }) => {
    try {
      return { data: await service.statusFor(user.userId, params.id) }
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'HackathonConnection.ConnectionProjectParams',
    detail: { tags: ['Hackathon'], summary: 'My connection request status for a hackathon project' },
    response: { 200: t.Any(), 401: ErrorResponse },
  })
  .post('/connections/hackathon/:id/accept', async ({ user, params, body }) => {
    try {
      return await service.accept(user.userId, params.id, body)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'HackathonConnection.ConnectionIdParams',
    body: 'HackathonConnection.AcceptConnectionBody',
    detail: { tags: ['Hackathon'], summary: 'Accept a hackathon connection request and authorize my contact' },
    response: { 200: t.Any(), 400: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .post('/connections/hackathon/:id/ignore', async ({ user, params }) => {
    try {
      return await service.ignore(user.userId, params.id)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'HackathonConnection.ConnectionIdParams',
    detail: { tags: ['Hackathon'], summary: 'Ignore a hackathon connection request' },
    response: { 200: t.Any(), 404: ErrorResponse, 409: ErrorResponse },
  })
  .get('/connections/hackathon/:id/contacts', async ({ user, params }) => {
    try {
      return await service.contacts(user.userId, params.id)
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'HackathonConnection.ConnectionIdParams',
    detail: { tags: ['Hackathon'], summary: 'Read authorized contacts of an accepted hackathon connection' },
    response: { 200: t.Any(), 403: ErrorResponse },
  })
