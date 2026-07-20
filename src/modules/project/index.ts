import { Elysia, status } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { userIdentityService } from '../user-identity'
import { ProjectService } from './service'
import {
  InvalidTransitionError,
  MissingRequiredFieldError,
  ProjectDraftBody,
  ProjectIdParams,
  ProjectNotFoundError,
  ProjectResponse,
  FieldErrorResponse,
  type DomainError,
} from './model'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'

export const projectService = new ProjectService(db, userIdentityService)

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
    ProjectIdParams,
    ProjectDraftBody,
    FieldErrorResponse,
  })
  .prefix('model', 'Project.')
  .post('/projects', async ({ user, body }) => {
    return projectService.createProject(user.userId, body)
  }, {
    auth: true,
    detail: {
      summary: 'Create a project',
      description: 'Creates a new Draft project owned by the authenticated user and grants the founder role.',
      tags: ['Project'],
    },
    body: 'Project.ProjectDraftBody',
    response: {
      200: 'Project.ProjectResponse',
      401: ErrorResponse,
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
      description: 'Updates the project row in place. Only allowed while status is Draft or Revision Required.',
      tags: ['Project'],
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
      description: 'Validates all required fields and transitions status to Pending Review. Allowed from Draft or Revision Required.',
      tags: ['Project'],
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
