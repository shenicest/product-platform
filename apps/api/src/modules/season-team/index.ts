import { Elysia } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { db } from '../../db'
import { onBoomlandError } from '../boomland-shared'
import {
  ApplyRecruitmentCardBody,
  CreateSeasonProjectBody,
  PublishRecruitmentCardBody,
  RecruitmentApplicationParams,
  RecruitmentCardParams,
  SeasonProjectQuery,
  SeasonTeamParams,
  UpdateRecruitmentApplicationBody,
  UpdateRecruitmentCardBody,
} from './model'
import { SeasonTeamService } from './service'

const service = new SeasonTeamService(db)

export const seasonTeamModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .onError(onBoomlandError)
  .get('/seasons/:id/team/me', async ({ user, params }) => {
    return service.workbench(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonTeamParams,
    detail: { summary: 'Get my team workbench for a season', tags: ['SeasonTeam'] },
  })
  .post('/seasons/:id/projects', async ({ user, params, body }) => {
    return service.createProject(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonTeamParams,
    body: CreateSeasonProjectBody,
    detail: { summary: 'Create or bring a project into a season', tags: ['SeasonTeam'] },
  })
  .get('/me/season-projects', async ({ user, query }) => {
    return service.listMyProjects(user.userId, query)
  }, {
    auth: true,
    query: SeasonProjectQuery,
    detail: { summary: 'List my season projects', tags: ['SeasonTeam'] },
  })
  .post('/seasons/:id/recruitment-cards', async ({ user, params, body }) => {
    return service.publishRecruitmentCard(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonTeamParams,
    body: PublishRecruitmentCardBody,
    detail: { summary: 'Publish a recruitment card', tags: ['SeasonTeam'] },
  })
  .patch('/recruitment-cards/:id', async ({ user, params, body }) => {
    return service.updateRecruitmentCard(params.id, user.userId, body)
  }, {
    auth: true,
    params: RecruitmentCardParams,
    body: UpdateRecruitmentCardBody,
    detail: { summary: 'Close or reopen a recruitment card', tags: ['SeasonTeam'] },
  })
  .post('/recruitment-cards/:id/apply', async ({ user, params, body }) => {
    return service.applyToCard(params.id, user.userId, body)
  }, {
    auth: true,
    params: RecruitmentCardParams,
    body: ApplyRecruitmentCardBody,
    detail: { summary: 'Apply to a recruitment card', tags: ['SeasonTeam'] },
  })
  .get('/me/recruitment-applications', async ({ user, query }) => {
    return service.listMyApplications(user.userId, query)
  }, {
    auth: true,
    query: SeasonProjectQuery,
    detail: { summary: 'List recruitment applications I sent', tags: ['SeasonTeam'] },
  })
  .get('/recruitment-cards/:id/applications', async ({ user, params }) => {
    return service.listCardApplications(params.id, user.userId)
  }, {
    auth: true,
    params: RecruitmentCardParams,
    detail: { summary: 'List applications received on a recruitment card', tags: ['SeasonTeam'] },
  })
  .patch('/recruitment-applications/:id', async ({ user, params, body }) => {
    return service.decideApplication(params.id, user.userId, body)
  }, {
    auth: true,
    params: RecruitmentApplicationParams,
    body: UpdateRecruitmentApplicationBody,
    detail: { summary: 'Accept or decline a recruitment application', tags: ['SeasonTeam'] },
  })
