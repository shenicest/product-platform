import { Elysia, status } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { ErrorResponse } from '../../common'
import { ProjectIdParams } from '../project/model'
import { LikeResponse, MyLikesResponse, NotLikableError } from './model'
import { LikeService } from './service'

const likeService = new LikeService(db)

export const likeModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .model({ ProjectIdParams, LikeResponse, MyLikesResponse })
  .get('/me/likes', async ({ user }) => ({ liked_project_ids: await likeService.getMyLikes(user.userId) }), {
    auth: true,
    response: { 200: 'MyLikesResponse', 401: ErrorResponse },
  })
  .post('/projects/:id/like', async ({ user, params }) => {
    const result = await likeService.like(params.id, user.userId)
    if (result === null) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: `Project ${params.id} not found` } })
    if (result instanceof NotLikableError) return status(409, { error: { code: result.code, message: result.message } })
    return result
  }, {
    auth: true,
    params: 'ProjectIdParams',
    response: { 200: 'LikeResponse', 401: ErrorResponse, 404: ErrorResponse, 409: ErrorResponse },
  })
  .delete('/projects/:id/like', async ({ user, params }) => {
    const result = await likeService.unlike(params.id, user.userId)
    if (result === null) return status(404, { error: { code: 'PROJECT_NOT_FOUND', message: `Project ${params.id} not found` } })
    return result
  }, {
    auth: true,
    params: 'ProjectIdParams',
    response: { 200: 'LikeResponse', 401: ErrorResponse, 404: ErrorResponse },
  })
