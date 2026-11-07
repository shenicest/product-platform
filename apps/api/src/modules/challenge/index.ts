import { Elysia } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { onBoomlandError } from '../boomland-shared'
import {
  ChallengeIdParams,
  CreateChallengeBody,
  ListSeasonChallengesQuery,
  SeasonChallengesParams,
  UpdateChallengeBody,
} from './model'
import { ChallengeService } from './service'

export const challengeService = new ChallengeService(db)

export const challengeModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .onError(onBoomlandError)
  .get('/seasons/:id/challenges', async ({ params, query, user }) => {
    return challengeService.list(params.id, user?.userId ?? null, query.includeDrafts)
  }, {
    optionalAuth: true,
    params: SeasonChallengesParams,
    query: ListSeasonChallengesQuery,
    detail: { summary: 'List challenges for a season', tags: ['Challenge'], security: [{ bearerAuth: [] }, {}] },
  })
  .get('/challenges/:id', async ({ params, user }) => {
    return challengeService.detail(params.id, user?.userId ?? null)
  }, {
    optionalAuth: true,
    params: ChallengeIdParams,
    detail: { summary: 'Get challenge detail', tags: ['Challenge'], security: [{ bearerAuth: [] }, {}] },
  })
  .post('/seasons/:id/challenges', async ({ user, params, body }) => {
    return challengeService.create(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonChallengesParams,
    body: CreateChallengeBody,
    detail: { summary: 'Create a challenge draft', tags: ['Challenge'] },
  })
  .patch('/challenges/:id', async ({ user, params, body }) => {
    return challengeService.update(params.id, user.userId, body)
  }, {
    auth: true,
    params: ChallengeIdParams,
    body: UpdateChallengeBody,
    detail: { summary: 'Update a challenge', tags: ['Challenge'] },
  })
  .post('/challenges/:id/reference', async ({ user, params }) => {
    return challengeService.reference(params.id, user.userId)
  }, {
    auth: true,
    params: ChallengeIdParams,
    detail: { summary: 'Mark a challenge as reference', tags: ['Challenge'] },
  })
  .post('/challenges/:id/publish', async ({ user, params }) => {
    return challengeService.publish(params.id, user.userId)
  }, {
    auth: true,
    params: ChallengeIdParams,
    detail: { summary: 'Publish a challenge', tags: ['Challenge'] },
  })
  .post('/challenges/:id/close', async ({ user, params }) => {
    return challengeService.close(params.id, user.userId)
  }, {
    auth: true,
    params: ChallengeIdParams,
    detail: { summary: 'Close a published challenge', tags: ['Challenge'] },
  })
  .post('/challenges/:id/archive', async ({ user, params }) => {
    return challengeService.archive(params.id, user.userId)
  }, {
    auth: true,
    params: ChallengeIdParams,
    detail: { summary: 'Archive a challenge', tags: ['Challenge'] },
  })
