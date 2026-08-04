import { Elysia, status } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { userIdentityService } from '../user-identity'
import { ProposalService } from './service'
import {
  DuplicateProposalError,
  ProposalBody,
  ProposalIdParams,
  ProposalListResponse,
  ProposalNotFoundError,
  ProposalResponse,
  ProjectIdParams,
  ValidationError,
  type ProjectChanges,
} from './model'
import {
  ForbiddenError,
  InvalidTransitionError,
  ProjectNotFoundError,
  type DomainError,
} from '../project/model'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'

export const proposalService = new ProposalService(db, userIdentityService)

function errorBody(error: DomainError) {
  return { error: { code: error.code, message: error.message } }
}

function forbiddenBody() {
  return { error: { code: ErrorCode.FORBIDDEN, message: ErrorMessage.FORBIDDEN } }
}

export const proposalModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .model({
    ProposalResponse,
    ProposalListResponse,
    ProposalBody,
    ProjectIdParams,
    ProposalIdParams,
  })
  .prefix('model', 'Proposal.')
  .post('/projects/:id/proposals', async ({ user, params, body }) => {
    const project = await proposalService.getProject(params.id)
    if (!project) return status(404, errorBody(new ProjectNotFoundError(params.id)))
    if (project.userId !== user.userId) return status(403, forbiddenBody())

    const result = await proposalService.createProposal(params.id, body.changes as Record<string, unknown>)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    if (result instanceof ValidationError) return status(422, errorBody(result))
    if (result instanceof DuplicateProposalError) return status(409, errorBody(result))
    return result
  }, {
    auth: true,
    detail: {
      summary: 'Create a proposal',
      description: 'Creates a post-live edit proposal (status=0 Pending) on a Live project. The `changes` object holds only the fields to update. The project row is not modified until an operator approves. Fails with 409 if the project already has a pending or revision-required proposal.',
      tags: ['Proposal'],
      operationId: 'proposal.create',
    },
    params: 'Proposal.ProjectIdParams',
    body: 'Proposal.ProposalBody',
    response: {
      200: 'Proposal.ProposalResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
      409: ErrorResponse,
      422: ErrorResponse,
    },
  })
  .put('/projects/:id/proposals/:proposalId', async ({ user, params, body }) => {
    const project = await proposalService.getProject(params.id)
    if (!project) return status(404, errorBody(new ProjectNotFoundError(params.id)))
    if (project.userId !== user.userId) return status(403, forbiddenBody())

    const proposal = await proposalService.getProposal(params.proposalId)
    if (!proposal) return status(404, errorBody(new ProposalNotFoundError(params.proposalId)))
    if (proposal.projectId !== project.id) return status(404, errorBody(new ProposalNotFoundError(params.proposalId)))

    const result = await proposalService.updateProposal(params.proposalId, body.changes as Record<string, unknown>)
    if (result instanceof ProposalNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    if (result instanceof ValidationError) return status(422, errorBody(result))
    return result
  }, {
    auth: true,
    detail: {
      summary: 'Edit and resubmit a proposal',
      description: 'Updates the `changes` diff of a Revision Required proposal (status 3 → 0). Only the project owner may call this. No new proposal is created.',
      tags: ['Proposal'],
      operationId: 'proposal.editResubmit',
    },
    params: 'Proposal.ProposalIdParams',
    body: 'Proposal.ProposalBody',
    response: {
      200: 'Proposal.ProposalResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
      422: ErrorResponse,
    },
  })
  .get('/projects/:id/proposals', async ({ user, params }) => {
    const result = await proposalService.getProjectForProposals(user.userId, params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof ForbiddenError) return status(403, forbiddenBody())

    const data = await proposalService.listProposals(params.id)
    return { data, total: data.length }
  }, {
    auth: true,
    detail: {
      summary: 'List project proposals',
      description: 'Returns the full proposal history for a project (all statuses). Accessible to the owning founder or an operator.',
      tags: ['Proposal'],
      operationId: 'proposal.listByProject',
    },
    params: 'Proposal.ProjectIdParams',
    response: {
      200: 'Proposal.ProposalListResponse',
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .get('/projects/:id/proposals/:proposalId', async ({ user, params }) => {
    const result = await proposalService.getProjectForProposals(user.userId, params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof ForbiddenError) return status(403, forbiddenBody())

    const proposal = await proposalService.getProposal(params.proposalId)
    if (!proposal) return status(404, errorBody(new ProposalNotFoundError(params.proposalId)))
    if (proposal.projectId !== params.id) return status(404, errorBody(new ProposalNotFoundError(params.proposalId)))
    return proposal
  }, {
    auth: true,
    detail: {
      summary: 'Get proposal detail',
      description: 'Returns a single proposal with its `changes` diff, status, review reason, and reviewer info. Accessible to the owning founder or an operator.',
      tags: ['Proposal'],
      operationId: 'proposal.getDetail',
    },
    params: 'Proposal.ProposalIdParams',
    response: {
      200: 'Proposal.ProposalResponse',
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
