import { Elysia } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { onBoomlandError } from '../boomland-shared'
import {
  ApplicationIdParams,
  CreateApplicationBody,
  MyApplicationsQuery,
  ParticipantParams,
  ParticipantsQuery,
  SeasonApplicationParams,
  SeasonApplicationsQuery,
  UpdateApplicationStatusBody,
  UpdateWechatBody,
  WithdrawParticipantBody,
} from './model'
import { SeasonApplicationService } from './service'

export const seasonApplicationService = new SeasonApplicationService(db)

export const seasonApplicationModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .onError(onBoomlandError)
  .post('/seasons/:id/applications', async ({ user, params, body }) => {
    return seasonApplicationService.create(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonApplicationParams,
    body: CreateApplicationBody,
    detail: { summary: 'Apply to a season', tags: ['SeasonApplication'] },
  })
  .get('/me/applications', async ({ user, query }) => {
    return seasonApplicationService.listMine(user.userId, query)
  }, {
    auth: true,
    query: MyApplicationsQuery,
    detail: { summary: 'List my season applications', tags: ['SeasonApplication'] },
  })
  .post('/applications/:id/withdraw', async ({ user, params }) => {
    return seasonApplicationService.withdraw(params.id, user.userId)
  }, {
    auth: true,
    params: ApplicationIdParams,
    detail: { summary: 'Withdraw an application before review', tags: ['SeasonApplication'] },
  })
  .get('/applications/:id', async ({ user, params }) => {
    return seasonApplicationService.detail(params.id, user.userId)
  }, {
    auth: true,
    params: ApplicationIdParams,
    detail: { summary: 'Get a season application', tags: ['SeasonApplication'] },
  })
  .get('/seasons/:id/applications', async ({ user, params, query }) => {
    return seasonApplicationService.listSeasonApplications(params.id, user.userId, query)
  }, {
    auth: true,
    params: SeasonApplicationParams,
    query: SeasonApplicationsQuery,
    detail: { summary: 'List season applications', tags: ['SeasonApplication'] },
  })
  .patch('/applications/:id/status', async ({ user, params, body }) => {
    return seasonApplicationService.updateStatus(params.id, user.userId, body)
  }, {
    auth: true,
    params: ApplicationIdParams,
    body: UpdateApplicationStatusBody,
    detail: { summary: 'Update an application status', tags: ['SeasonApplication'] },
  })
  .get('/seasons/:id/participants', async ({ user, params, query }) => {
    return seasonApplicationService.listParticipants(params.id, user.userId, query)
  }, {
    auth: true,
    params: SeasonApplicationParams,
    query: ParticipantsQuery,
    detail: { summary: 'List season participants', tags: ['SeasonApplication'] },
  })
  .post('/seasons/:id/participants/:userId/withdraw', async ({ user, params, body }) => {
    return seasonApplicationService.withdrawParticipant(params.id, params.userId, user.userId, body)
  }, {
    auth: true,
    params: ParticipantParams,
    body: WithdrawParticipantBody,
    detail: { summary: 'Withdraw a participant from the season', tags: ['SeasonApplication'] },
  })
  .patch('/seasons/:id/participants/:userId/wechat', async ({ user, params, body }) => {
    return seasonApplicationService.updateWechat(params.id, params.userId, user.userId, body.status)
  }, {
    auth: true,
    params: ParticipantParams,
    body: UpdateWechatBody,
    detail: { summary: 'Update participant WeChat status', tags: ['SeasonApplication'] },
  })
