import { Elysia, status } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { ErrorResponse } from '../../common'
import { CannotFollowSelfError, FollowResponse, FounderUserIdParams, FollowingProjectsQuery, FollowingProjectsResponse, MyFollowsResponse, NotAFounderError } from './model'
import { FollowService } from './service'
import { projectService } from '../project'

const followService = new FollowService(db)

export const followModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .model({ FounderUserIdParams, FollowResponse, MyFollowsResponse, FollowingProjectsQuery, FollowingProjectsResponse })
  .prefix('model', 'Follow.')
  .get('/me/follows', async ({ user }) => ({ followed_founder_user_ids: await followService.getMyFollows(user.userId) }), {
    auth: true,
    response: { 200: 'Follow.MyFollowsResponse', 401: ErrorResponse },
  })
  .get('/me/following/projects', async ({ user, query }) => projectService.listFollowingLiveProjects(user.userId, query), {
    auth: true,
    query: 'Follow.FollowingProjectsQuery',
    response: { 200: 'Follow.FollowingProjectsResponse', 401: ErrorResponse },
  })
  .post('/founders/:userId/follow', async ({ user, params }) => {
    const result = await followService.follow(user.userId, params.userId)
    if (result instanceof CannotFollowSelfError || result instanceof NotAFounderError) {
      return status(400, { error: { code: result.code, message: result.message } })
    }
    return result
  }, {
    auth: true,
    params: 'Follow.FounderUserIdParams',
    response: { 200: 'Follow.FollowResponse', 400: ErrorResponse, 401: ErrorResponse },
  })
  .delete('/founders/:userId/follow', async ({ user, params }) => followService.unfollow(user.userId, params.userId), {
    auth: true,
    params: 'Follow.FounderUserIdParams',
    response: { 200: 'Follow.FollowResponse', 401: ErrorResponse },
  })
