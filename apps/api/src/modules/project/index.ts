import { Elysia, status } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { userIdentityService } from '../user-identity'
import { userProfileService } from '../user'
import { ProjectService } from './service'
import {
  InvalidTransitionError,
  MissingRequiredFieldError,
  ProjectDraftBody,
  ProjectIdParams,
  ProjectListQuery,
  ProjectListResponse,
  ProjectNotFoundError,
  ProjectResponse,
  ProjectDetailResponse,
  FieldErrorResponse,
  type DomainError,
} from './model'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'

export const projectService = new ProjectService(db, userIdentityService, userProfileService)

function errorBody(error: DomainError) {
  return { error: { code: error.code, message: error.message } }
}

function forbiddenBody() {
  return { error: { code: ErrorCode.FORBIDDEN, message: ErrorMessage.FORBIDDEN } }
}

export const projectModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .model({
    ProjectResponse,
    ProjectDetailResponse,
    ProjectIdParams,
    ProjectDraftBody,
    FieldErrorResponse,
    ProjectListQuery,
    ProjectListResponse,
  })
  .prefix('model', 'Project.')
  .post('/projects', async ({ user, body }) => {
    return projectService.createProject(user.userId, body)
  }, {
    auth: true,
    detail: {
      summary: 'Create a project',
      description: 'Creates a new Draft project (status=0) owned by the authenticated user and grants the Founder role if not already held. Only `name` is required at this stage.',
      tags: ['Project'],
      operationId: 'project.create',
    },
    body: 'Project.ProjectDraftBody',
    response: {
      200: 'Project.ProjectResponse',
      401: ErrorResponse,
    },
  })
  .get('/projects', async ({ query }) => {
    return projectService.listLiveProjects(query)
  }, {
    detail: {
      summary: 'List live projects',
      description: 'Paginated list of Live (status=3) projects. Supports filtering by category, stage, and keyword search on name/tagline. Public — no authentication required.',
      tags: ['Project'],
      operationId: 'project.listLive',
      security: [],
    },
    query: 'Project.ProjectListQuery',
    response: {
      200: 'Project.ProjectListResponse',
    },
  })
  .put('/projects/:id/draft', async ({ user, params, body }) => {
    const owned = await projectService.getProject(params.id)
    if (!owned) return status(404, errorBody(new ProjectNotFoundError(params.id)))
    if (owned.userId !== user.userId) return status(403, forbiddenBody())
    const result = await projectService.saveDraft(params.id, body)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    auth: true,
    detail: {
      summary: 'Save draft',
      description: 'Updates the project row in place. Only allowed while status is Draft (0) or Revision Required (2). Only the project owner may call this.',
      tags: ['Project'],
      operationId: 'project.saveDraft',
    },
    params: 'Project.ProjectIdParams',
    body: 'Project.ProjectDraftBody',
    response: {
      200: 'Project.ProjectResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
  })
  .put('/projects/:id/submit', async ({ user, params }) => {
    const owned = await projectService.getProject(params.id)
    if (!owned) return status(404, errorBody(new ProjectNotFoundError(params.id)))
    if (owned.userId !== user.userId) return status(403, forbiddenBody())
    const result = await projectService.submitForReview(params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    if (result instanceof MissingRequiredFieldError) {
      return status(422, { error: { code: result.code, message: result.message, field: result.field } })
    }
    if (result instanceof InvalidTransitionError) return status(400, errorBody(result))
    return result
  }, {
    auth: true,
    detail: {
      summary: 'Submit for review',
      description: 'Validates all required fields and transitions status to Pending Review (0/2 → 1). Returns 422 with the first missing field name if validation fails.',
      tags: ['Project'],
      operationId: 'project.submit',
    },
    params: 'Project.ProjectIdParams',
    response: {
      200: 'Project.ProjectResponse',
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
      422: 'Project.FieldErrorResponse',
    },
  })
  .get('/projects/:id', async ({ params, user }) => {
    const result = await projectService.getProjectDetail(user?.userId ?? null, params.id)
    if (result instanceof ProjectNotFoundError) return status(404, errorBody(result))
    return result
  }, {
    optionalAuth: true,
    detail: {
      summary: 'Get project detail',
      description: 'Returns the full project content plus the founder\'s public profile (`founder`: nickname and avatarUrl from the shared users table, null when unavailable). Live projects (status=3) are public. Non-Live projects return 404 for anonymous users and non-owners; the owning founder or an operator sees full content.',
      tags: ['Project'],
      operationId: 'project.getDetail',
      security: [{ bearerAuth: [] }, {}],
    },
    params: 'Project.ProjectIdParams',
    response: {
      200: 'Project.ProjectDetailResponse',
      404: ErrorResponse,
    },
  })
