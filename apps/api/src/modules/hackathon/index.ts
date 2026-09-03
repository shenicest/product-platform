import { Elysia, status, t } from 'elysia'
import { eventManagementDbPlugin } from '../../plugins/event-management-db'
import { eventManagementDb } from '../../db/event-management'
import { db } from '../../db'
import { authPlugin } from '../../plugins/auth'
import { ErrorResponse } from '../../common'
import {
  HackathonProject,
  HackathonProjectIdParams,
  HackathonProjectListResponse,
  HackathonProjectQuery,
  LikeResponse,
  HackathonHideResponse,
  HackathonTagBody,
  HackathonTagParams,
  HackathonTagResponse,
} from './model'
import { HackathonService } from './service'

const service = new HackathonService(eventManagementDb, db)

export const hackathonModule = new Elysia()
  .use(eventManagementDbPlugin)
  .use(authPlugin)
  .model({ HackathonProject, HackathonProjectIdParams, HackathonProjectListResponse, HackathonProjectQuery, LikeResponse, HackathonHideResponse, HackathonTagBody, HackathonTagParams, HackathonTagResponse })
  .prefix('model', 'Hackathon.')
  .get('/hackathon/projects', ({ query }) => service.listProjects(query), {
    detail: { summary: 'List event 4 hackathon projects', tags: ['Hackathon'], security: [] },
    query: 'Hackathon.HackathonProjectQuery', response: { 200: 'Hackathon.HackathonProjectListResponse' },
  })
  .get('/hackathon/projects/:id', async ({ params, user }) => {
    const project = await service.getProjectWithTags(params.id, user?.userId)
    if (!project) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: 'Hackathon project not found' } })
    return project
  }, { optionalAuth: true,
    detail: { summary: 'Get event 4 hackathon project', tags: ['Hackathon'], security: [] },
    params: 'Hackathon.HackathonProjectIdParams', response: { 200: 'Hackathon.HackathonProject', 404: ErrorResponse },
  })
  .get('/me/hackathon-likes', async ({ user }) => ({ liked_hackathon_project_ids: await service.getMyLikes(user.userId) }), {
    auth: true,
    response: { 200: t.Object({ liked_hackathon_project_ids: t.Array(t.Number()) }), 401: ErrorResponse },
  })
  .post('/hackathon/projects/:id/like', async ({ user, params }) => {
    const project = await service.like(params.id, user.userId)
    if (!project) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: 'Hackathon project not found' } })
    return { liked: true, likeCount: project.likeCount }
  }, { auth: true, params: 'Hackathon.HackathonProjectIdParams', response: { 200: 'Hackathon.LikeResponse', 401: ErrorResponse, 404: ErrorResponse } })
  .delete('/hackathon/projects/:id/like', async ({ user, params }) => {
    const project = await service.unlike(params.id, user.userId)
    if (!project) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: 'Hackathon project not found' } })
    return { liked: false, likeCount: project.likeCount }
  }, { auth: true, params: 'Hackathon.HackathonProjectIdParams', response: { 200: 'Hackathon.LikeResponse', 401: ErrorResponse, 404: ErrorResponse } })
  .post('/hackathon/projects/:id/hide', async ({ user, params }) => {
    if (!user.email?.toLowerCase().endsWith('@shenicest.cn')) return status(403, { error: { code: 'FORBIDDEN', message: 'Only shenicest.cn accounts can hide hackathon projects' } })
    const hidden = await service.hideProject(params.id, user.userId)
    if (!hidden) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: 'Hackathon project not found' } })
    return { hidden: true }
  }, { auth: true, params: 'Hackathon.HackathonProjectIdParams', response: { 200: 'Hackathon.HackathonHideResponse', 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse } })
  .post('/hackathon/projects/:id/tags', async ({ user, params, body }) => {
    const result = await service.toggleTag(params.id, user.userId, body.tagId, true)
    if (!result) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: 'Hackathon project not found' } })
    if (result === 'INVALID_TAG') return status(400, { error: { code: 'INVALID_TAG', message: 'Tag is not available for this track' } })
    return result
  }, { auth: true, params: 'Hackathon.HackathonProjectIdParams', body: 'Hackathon.HackathonTagBody', response: { 200: 'Hackathon.HackathonTagResponse', 400: ErrorResponse, 401: ErrorResponse, 404: ErrorResponse } })
  .delete('/hackathon/projects/:id/tags/:tagId', async ({ user, params }) => {
    const result = await service.toggleTag(params.id, user.userId, params.tagId, false)
    if (!result) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: 'Hackathon project not found' } })
    if (result === 'INVALID_TAG') return status(400, { error: { code: 'INVALID_TAG', message: 'Tag is not available for this track' } })
    return result
  }, { auth: true, params: 'Hackathon.HackathonTagParams', response: { 200: 'Hackathon.HackathonTagResponse', 400: ErrorResponse, 401: ErrorResponse, 404: ErrorResponse } })
