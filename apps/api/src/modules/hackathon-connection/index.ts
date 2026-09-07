import { Elysia, status, t } from 'elysia'
import { db } from '../../db'
import { eventManagementDb } from '../../db/event-management'
import { logEvent, type EventFields } from '../../lib/log-event'
import { authPlugin } from '../../plugins/auth'
import { ErrorResponse } from '../../common'
import { HACKATHON_EVENT_ID, HackathonService } from '../hackathon/service'
import { ConnectionRequestStatus } from '@shenicest/shared'
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
const webBaseUrl = process.env.SHENICEST_WEB_BASE_URL
const service = new HackathonConnectionService(db, {
  getVisibleProject: (hackathonProjectId) => hackathonService.getProject(hackathonProjectId),
  getProjectSummary: async (hackathonProjectId) => {
    const project = await hackathonService.getProject(hackathonProjectId)
    return project
      ? {
          name: project.name,
          ...(webBaseUrl ? { url: `${webBaseUrl.replace(/\/+$/, '')}/hackathon/projects/${hackathonProjectId}` } : {}),
        }
      : null
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

// Funnel events (PRD 15) are emitted here, at the request boundary: an event
// records "this API call ended in X", including validation and conflict codes
// the service knows nothing about. Fields stay inside the PRD 15.2 allow-list
// — never contacts, message bodies, or emails.
function logConnectionEvent(event: string, fields: EventFields = {}): void {
  logEvent(event, { eventId: HACKATHON_EVENT_ID, source: 'hackathon', ...fields })
}

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
      const created = await service.create(user.userId, params.id, body)
      logConnectionEvent('connection_submit_success', {
        hackathonProjectId: created.hackathonProjectId,
        requestId: created.id,
        status: created.status,
      })
      return created
    } catch (error) {
      if (error instanceof HackathonConnectionError) {
        logConnectionEvent('connection_submit_failed', {
          hackathonProjectId: params.id,
          errorCode: error.code,
        })
      }
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
      return await service.statusFor(user.userId, params.id)
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
      const accepted = await service.accept(user.userId, params.id, body)
      logConnectionEvent('connection_accept_success', {
        requestId: accepted.id,
        status: accepted.status,
      })
      return accepted
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
      const ignored = await service.ignore(user.userId, params.id)
      logConnectionEvent('connection_ignore_success', {
        requestId: ignored.id,
        status: ignored.status,
      })
      return ignored
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
      const contacts = await service.contacts(user.userId, params.id)
      logConnectionEvent('connection_contacts_unlocked', {
        requestId: params.id,
        status: ConnectionRequestStatus.Accepted,
      })
      return contacts
    } catch (error) {
      return handleError(error)
    }
  }, {
    auth: true,
    params: 'HackathonConnection.ConnectionIdParams',
    detail: { tags: ['Hackathon'], summary: 'Read authorized contacts of an accepted hackathon connection' },
    response: { 200: t.Any(), 403: ErrorResponse },
  })
