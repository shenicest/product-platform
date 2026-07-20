import { Elysia, status } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { roleGuardPlugin } from '../../plugins/role-guard'
import { db } from '../../db'
import { FounderService } from './service'
import {
  AuditReasonNotFoundError,
  AuditReasonResponse,
  FounderProjectQuery,
  ProjectListResponse,
  ProposalListResponse,
  StatsResponse,
} from './model'
import { ForbiddenError, ProjectIdParams, ProjectNotFoundError, type DomainError } from '../project/model'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'

const founderService = new FounderService(db)

function errorBody(error: DomainError) {
  return { error: { code: error.code, message: error.message } }
}

function forbiddenBody() {
  return { error: { code: ErrorCode.FORBIDDEN, message: ErrorMessage.FORBIDDEN } }
}

export const founderModule = new Elysia({ prefix: '/founder' })
  .use(dbPlugin)
  .use(authPlugin)
  .use(roleGuardPlugin)
  .model({
    FounderProjectQuery,
    ProjectListResponse,
    ProposalListResponse,
    StatsResponse,
    AuditReasonResponse,
    ProjectIdParams,
  })
  .prefix('model', 'Founder.')
  .get('/projects', async ({ user, query }) => {
    return founderService.listProjects(user.userId, query)
  }, {
    founderOnly: true,
    detail: {
      summary: 'List my projects',
      description: 'Lists all projects owned by the authenticated founder, with optional status/stage filters and keyword search on name/tagline. Requires the founder role.',
      tags: ['Founder'],
    },
    query: 'Founder.FounderProjectQuery',
    response: {
      200: 'Founder.ProjectListResponse',
      401: ErrorResponse,
      403: ErrorResponse,
    },
  })
  .get('/stats', async ({ user }) => {
    return founderService.getStats(user.userId)
  }, {
    founderOnly: true,
    detail: {
      summary: 'My project statistics',
      description: 'Real-time counts of the authenticated founder\'s projects: total, live, and pending review. Requires the founder role.',
      tags: ['Founder'],
    },
    response: {
      200: 'Founder.StatsResponse',
      401: ErrorResponse,
      403: ErrorResponse,
    },
  })
  .get('/projects/:id/audit-reason', async ({ user, params }) => {
    const result = await founderService.getAuditReason(user.userId, params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof ForbiddenError) return status(403, forbiddenBody())
    if (result instanceof AuditReasonNotFoundError) return status(404, errorBody(result))
    return result
  }, {
    founderOnly: true,
    detail: {
      summary: 'Latest audit reason for my project',
      description: 'Returns the reason from the latest project-level audit record (revision required, rejection, or delisting) for the founder\'s own project. Requires the founder role.',
      tags: ['Founder'],
    },
    params: 'Founder.ProjectIdParams',
    response: {
      200: 'Founder.AuditReasonResponse',
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .get('/projects/:id/proposals', async ({ user, params }) => {
    const result = await founderService.listProposals(user.userId, params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof ForbiddenError) return status(403, forbiddenBody())
    return result
  }, {
    founderOnly: true,
    detail: {
      summary: 'List my proposals for a project',
      description: 'Returns the proposal history (status, changes diff, reason, reviewed_at) for the founder\'s own project. Requires the founder role.',
      tags: ['Founder'],
    },
    params: 'Founder.ProjectIdParams',
    response: {
      200: 'Founder.ProposalListResponse',
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
