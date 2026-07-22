import { Elysia, status } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { roleGuardPlugin } from '../../plugins/role-guard'
import { db } from '../../db'
import { OperatorService } from './service'
import {
  InvalidTransitionError,
  ProjectIdParams,
  ProjectNotFoundError,
  ProjectResponse,
  type DomainError,
} from '../project/model'
import { ProposalNotFoundError } from '../proposal/model'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'
import {
  AuditRecordListResponse,
  AuditRecordQuery,
  OperatorProjectQuery,
  OperatorProposalQuery,
  ProjectListResponse,
  ProposalIdParams,
  ProposalListResponse,
  ProposalResponse,
  ReviewReasonBody,
  StatsResponse,
} from './model'

const operatorService = new OperatorService(db)

function errorBody(error: DomainError) {
  return { error: { code: error.code, message: error.message } }
}

export const operatorModule = new Elysia({ prefix: '/operator' })
  .use(dbPlugin)
  .use(authPlugin)
  .use(roleGuardPlugin)
  .model({
    ProjectResponse,
    ProjectIdParams,
    ReviewReasonBody,
    ProposalIdParams,
    OperatorProjectQuery,
    OperatorProposalQuery,
    AuditRecordQuery,
    ProjectListResponse,
    ProposalListResponse,
    AuditRecordListResponse,
    StatsResponse,
    ProposalResponse,
  })
  .prefix('model', 'Operator.')
  // ── Project-level review (first submission) ──────────────────────────
  .post('/projects/:id/approve', async ({ user, params }) => {
    const result = await operatorService.approveProject(user.userId, params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Approve a project',
      description: 'Transitions a Pending Review project to Live (status 1 → 3).',
      tags: ['Operator'],
    },
    params: 'Operator.ProjectIdParams',
    response: {
      200: 'Operator.ProjectResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .post('/projects/:id/require-revision', async ({ user, params, body }) => {
    const result = await operatorService.requireProjectRevision(user.userId, params.id, body.reason)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Require revision on a project',
      description: 'Transitions a Pending Review project to Revision Required (status 1 → 2).',
      tags: ['Operator'],
    },
    params: 'Operator.ProjectIdParams',
    body: 'Operator.ReviewReasonBody',
    response: {
      200: 'Operator.ProjectResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .post('/projects/:id/reject', async ({ user, params, body }) => {
    const result = await operatorService.rejectProject(user.userId, params.id, body.reason)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Reject a project',
      description: 'Transitions a Pending Review project to Rejected (status 1 → 5, terminal).',
      tags: ['Operator'],
    },
    params: 'Operator.ProjectIdParams',
    body: 'Operator.ReviewReasonBody',
    response: {
      200: 'Operator.ProjectResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .post('/projects/:id/delist', async ({ user, params, body }) => {
    const result = await operatorService.delistProject(user.userId, params.id, body.reason)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Delist a project',
      description: 'Transitions a Live project to Delisted (status 3 → 4).',
      tags: ['Operator'],
    },
    params: 'Operator.ProjectIdParams',
    body: 'Operator.ReviewReasonBody',
    response: {
      200: 'Operator.ProjectResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .post('/projects/:id/restore', async ({ user, params }) => {
    const result = await operatorService.restoreProject(user.userId, params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Restore a delisted project',
      description: 'Transitions a Delisted project back to Live (status 4 → 3).',
      tags: ['Operator'],
    },
    params: 'Operator.ProjectIdParams',
    response: {
      200: 'Operator.ProjectResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  // ── Proposal-level review (post-live edit) ───────────────────────────
  .post('/proposals/:proposalId/approve', async ({ user, params }) => {
    const result = await operatorService.approveProposal(user.userId, params.proposalId)
    if (result instanceof ProposalNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Approve a proposal',
      description: 'Applies the proposal diff to the project and marks it Approved (status 0 → 1).',
      tags: ['Operator'],
    },
    params: 'Operator.ProposalIdParams',
    response: {
      200: 'Operator.ProposalResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .post('/proposals/:proposalId/reject', async ({ user, params, body }) => {
    const result = await operatorService.rejectProposal(user.userId, params.proposalId, body.reason)
    if (result instanceof ProposalNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Reject a proposal',
      description: 'Rejects the proposal (status 0 → 2). Project row is unchanged.',
      tags: ['Operator'],
    },
    params: 'Operator.ProposalIdParams',
    body: 'Operator.ReviewReasonBody',
    response: {
      200: 'Operator.ProposalResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .post('/proposals/:proposalId/require-revision', async ({ user, params, body }) => {
    const result = await operatorService.requireProposalRevision(user.userId, params.proposalId, body.reason)
    if (result instanceof ProposalNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Require revision on a proposal',
      description: 'Moves the proposal to Revision Required (status 0 → 3).',
      tags: ['Operator'],
    },
    params: 'Operator.ProposalIdParams',
    body: 'Operator.ReviewReasonBody',
    response: {
      200: 'Operator.ProposalResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  // ── Management lists ─────────────────────────────────────────────────
  .get('/projects', async ({ query }) => {
    return operatorService.listProjects(query)
  }, {
    operatorOnly: true,
    detail: {
      summary: 'List all projects',
      description: 'Project management list with filters (status, stage, category), search, and sort.',
      tags: ['Operator'],
    },
    query: 'Operator.OperatorProjectQuery',
    response: {
      200: 'Operator.ProjectListResponse',
      401: ErrorResponse,
      403: ErrorResponse,
    },
  })
  .get('/proposals', async ({ query }) => {
    return operatorService.listPendingProposals(query)
  }, {
    operatorOnly: true,
    detail: {
      summary: 'List pending proposals',
      description: 'Review queue of pending proposals (status=0), optionally filtered by project, stage, or category.',
      tags: ['Operator'],
    },
    query: 'Operator.OperatorProposalQuery',
    response: {
      200: 'Operator.ProposalListResponse',
      401: ErrorResponse,
      403: ErrorResponse,
    },
  })
  .get('/projects/:id/proposals', async ({ params }) => {
    const project = await operatorService.getProject(params.id)
    if (!project) return status(404, errorBody(new ProjectNotFoundError(params.id)))
    const data = await operatorService.listProjectProposals(params.id)
    return { data, total: data.length }
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Proposal history for a project',
      description: 'Lists all proposals (any status) for a specific project.',
      tags: ['Operator'],
    },
    params: 'Operator.ProjectIdParams',
    response: {
      200: 'Operator.ProposalListResponse',
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  // ── Audit records ────────────────────────────────────────────────────
  .get('/audit-records', async ({ query }) => {
    return operatorService.listAuditRecords(query)
  }, {
    operatorOnly: true,
    detail: {
      summary: 'List audit records',
      description: 'Query audit records with optional filters (project, time range).',
      tags: ['Operator'],
    },
    query: 'Operator.AuditRecordQuery',
    response: {
      200: 'Operator.AuditRecordListResponse',
      401: ErrorResponse,
      403: ErrorResponse,
    },
  })
  // ── Statistics ───────────────────────────────────────────────────────
  .get('/stats', async () => {
    return operatorService.getStats()
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Platform statistics',
      description: 'Aggregated project counts by status, stage, and category.',
      tags: ['Operator'],
    },
    response: {
      200: 'Operator.StatsResponse',
      401: ErrorResponse,
      403: ErrorResponse,
    },
  })
