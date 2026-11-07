import { Elysia } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { onBoomlandError } from '../boomland-shared'
import {
  AddBudgetBody,
  AddPointsBody,
  AllocationParams,
  CreateAllocationBody,
  GrantVerifierBody,
  ReclaimBody,
  RevokeVerifierBody,
  SeasonConfigParams,
  VerifierParams,
} from './model'
import { SeasonConfigService } from './service'

export const seasonConfigService = new SeasonConfigService(db)

export const seasonConfigModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .onError(onBoomlandError)
  .get('/seasons/:id/budgets', async ({ user, params }) => {
    return seasonConfigService.listBudgets(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonConfigParams,
    detail: { summary: 'List season budget versions', tags: ['SeasonConfig'] },
  })
  .post('/seasons/:id/budgets', async ({ user, params, body }) => {
    return seasonConfigService.addBudget(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonConfigParams,
    body: AddBudgetBody,
    detail: { summary: 'Add a season budget version', tags: ['SeasonConfig'] },
  })
  .get('/seasons/:id/point-pool', async ({ user, params }) => {
    return seasonConfigService.getPointPool(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonConfigParams,
    detail: { summary: 'Get season point pool', tags: ['SeasonConfig'] },
  })
  .post('/seasons/:id/point-pool', async ({ user, params, body }) => {
    return seasonConfigService.addPoints(params.id, user.userId, body.addPoints)
  }, {
    auth: true,
    params: SeasonConfigParams,
    body: AddPointsBody,
    detail: { summary: 'Add points to a season pool', tags: ['SeasonConfig'] },
  })
  .get('/seasons/:id/allocations', async ({ user, params }) => {
    return seasonConfigService.listAllocations(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonConfigParams,
    detail: { summary: 'List scorer point allocations', tags: ['SeasonConfig'] },
  })
  .post('/seasons/:id/allocations', async ({ user, params, body }) => {
    return seasonConfigService.createAllocation(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonConfigParams,
    body: CreateAllocationBody,
    detail: { summary: 'Allocate points to a scorer', tags: ['SeasonConfig'] },
  })
  .post('/seasons/:id/allocations/:allocationId/reclaim', async ({ user, params, body }) => {
    return seasonConfigService.reclaimAllocation(params.id, params.allocationId, user.userId, body.reason)
  }, {
    auth: true,
    params: AllocationParams,
    body: ReclaimBody,
    detail: { summary: 'Reclaim a scorer allocation', tags: ['SeasonConfig'] },
  })
  .get('/seasons/:id/verifiers', async ({ user, params }) => {
    return seasonConfigService.listVerifiers(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonConfigParams,
    detail: { summary: 'List season verifier grants', tags: ['SeasonConfig'] },
  })
  .post('/seasons/:id/verifiers', async ({ user, params, body }) => {
    return seasonConfigService.grantVerifier(params.id, user.userId, body.userId)
  }, {
    auth: true,
    params: SeasonConfigParams,
    body: GrantVerifierBody,
    detail: { summary: 'Grant season verifier access', tags: ['SeasonConfig'] },
  })
  .post('/seasons/:id/verifiers/:userId/revoke', async ({ user, params, body }) => {
    return seasonConfigService.revokeVerifier(params.id, user.userId, params.userId, body.reason)
  }, {
    auth: true,
    params: VerifierParams,
    body: RevokeVerifierBody,
    detail: { summary: 'Revoke season verifier access', tags: ['SeasonConfig'] },
  })
