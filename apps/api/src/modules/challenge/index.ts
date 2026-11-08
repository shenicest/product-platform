import { Elysia, t } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { onBoomlandError } from '../boomland-shared'
import {
  ChallengeIdParams,
  ChallengeResourceIdParams,
  CreateChallengeBody,
  ListSeasonChallengesQuery,
  PatchChallengeResourceBody,
  PublishChallengeBody,
  ReplaceChallengeResourcesBody,
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
  // 关注 / 取消关注（契约 §3.2）。两者都幂等：重复关注不报错、不重复计数。
  .post('/challenges/:id/follow', async ({ user, params }) => {
    return challengeService.follow(params.id, user.userId)
  }, {
    auth: true,
    params: ChallengeIdParams,
    detail: { summary: 'Follow a challenge', tags: ['Challenge'] },
  })
  .delete('/challenges/:id/follow', async ({ user, params }) => {
    return challengeService.unfollow(params.id, user.userId)
  }, {
    auth: true,
    params: ChallengeIdParams,
    detail: { summary: 'Unfollow a challenge', tags: ['Challenge'] },
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
  .post('/challenges/:id/publish', async ({ user, params, body }) => {
    return challengeService.publish(params.id, user.userId, body?.changeNote)
  }, {
    auth: true,
    params: ChallengeIdParams,
    // body 可选：老的调用方（按钮直接 POST 无 body）必须继续可用。
    body: t.Optional(PublishChallengeBody),
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
  // 资源清单：整表替换 + 单条更新。路径前缀放在 `/challenges` 下而不是嵌进
  // `/challenges/:id/resources/:resourceId` —— 单条更新只靠资源 id 就能定位命题，
  // 少一段参数，前端改状态下拉框时也不用同时持有命题 id。
  .put('/challenges/:id/resources', async ({ user, params, body }) => {
    return challengeService.replaceResources(params.id, user.userId, body)
  }, {
    auth: true,
    params: ChallengeIdParams,
    body: ReplaceChallengeResourcesBody,
    detail: { summary: 'Replace a challenge resource list', tags: ['Challenge'] },
  })
  .patch('/challenges/resources/:id', async ({ user, params, body }) => {
    return challengeService.patchResource(params.id, user.userId, body)
  }, {
    auth: true,
    params: ChallengeResourceIdParams,
    body: PatchChallengeResourceBody,
    detail: { summary: 'Update one challenge resource', tags: ['Challenge'] },
  })
