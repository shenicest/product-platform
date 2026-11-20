import { Elysia, status } from 'elysia'
import { db } from '../../db'
import { importAuthPlugin } from '../../plugins/import-auth'
import { clientIp, consumeRateLimit, rateLimitExceeded, rateLimitUnavailable } from '../../lib/rate-limit'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'
import { UserProfileService } from '../user/service'
import { UserIdentityService } from '../user-identity/service'
import { ProjectImportService } from './service'
import { ProjectImportBody, ProjectImportResponse } from './model'

export const projectImportService = new ProjectImportService(db, new UserProfileService(db), new UserIdentityService(db))

const tooManyRequests = (set: { headers: Record<string, string | number>; status?: number | string }, retryAfter: number) => {
  set.headers['retry-after'] = String(retryAfter)
  return rateLimitExceeded(retryAfter)
}

export const projectImportModule = new Elysia()
  .use(importAuthPlugin)
  .model({ ProjectImportBody, ProjectImportResponse })
  .prefix('model', 'Import.')
  .post('/import/projects', async ({ body, request, set, importSourceName }) => {
    const sourceLimited = await consumeRateLimit(importSourceName, [
      { scope: 'import.projects.source.minute', windowSeconds: 60, limit: 10 },
      { scope: 'import.projects.source.hour', windowSeconds: 3600, limit: 100 },
      { scope: 'import.projects.source.day', windowSeconds: 86400, limit: 500 },
    ])
    if ('unavailable' in sourceLimited) return rateLimitUnavailable()
    if (!sourceLimited.allowed) return tooManyRequests(set, sourceLimited.retryAfter)

    const ipLimited = await consumeRateLimit(clientIp(request), [
      { scope: 'import.projects.ip.minute', windowSeconds: 60, limit: 30 },
    ])
    if ('unavailable' in ipLimited) return rateLimitUnavailable()
    if (!ipLimited.allowed) return tooManyRequests(set, ipLimited.retryAfter)

    // The key authenticates the source; the body's source_name must agree so a
    // valid key cannot write projects under a different source's name.
    if (body.source_name !== importSourceName) {
      return status(403, { error: { code: ErrorCode.FORBIDDEN, message: ErrorMessage.FORBIDDEN } })
    }

    return projectImportService.importProjects(body.source_name, body.projects)
  }, {
    apiKey: true,
    detail: {
      summary: 'Import projects (external)',
      description:
        'Batch import of projects from an external source. Authenticated by a per-source API key (`X-Api-Key`); the body `source_name` must match the key. Idempotent on (source_name, external_id): re-importing the same external_id upserts. Each item resolves its owner by email (creating the user when missing) and lands Live without review. Rate-limited per source and per IP; at most 20 items per request.',
      tags: ['Project'],
      operationId: 'project.import',
      security: [],
    },
    body: 'Import.ProjectImportBody',
    response: {
      200: 'Import.ProjectImportResponse',
      401: ErrorResponse,
      403: ErrorResponse,
      429: ErrorResponse,
      503: ErrorResponse,
    },
  })
