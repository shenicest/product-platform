import { Elysia } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { roleGuardPlugin } from '../../plugins/role-guard'
import { db } from '../../db'
import { onBoomlandError } from '../boomland-shared'
import {
  AnnouncementBody,
  AuditQuery,
  CloneSeasonBody,
  CreateSeasonBody,
  ListManageQuery,
  ListSeasonsQuery,
  PinBody,
  ReasonBody,
  SeasonIdParams,
  UpdateOrganizersBody,
  UpdateRuleCardBody,
  UpdateRulesBody,
  UpdateScheduleBody,
  UpdateSeasonBody,
} from './model'
import { SeasonService } from './service'

export const seasonService = new SeasonService(db)

export const seasonModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .use(roleGuardPlugin)
  .onError(onBoomlandError)
  .get('/seasons', async ({ query }) => {
    return seasonService.listPublic(query)
  }, {
    query: ListSeasonsQuery,
    detail: { summary: 'List public seasons', tags: ['Season'], security: [] },
  })
  .get('/seasons/:id', async ({ params }) => {
    return seasonService.getPublicDetail(params.id)
  }, {
    params: SeasonIdParams,
    detail: { summary: 'Get public season detail', tags: ['Season'], security: [] },
  })
  .get('/seasons/:id/announcements', async ({ params, user }) => {
    return seasonService.listAnnouncements(params.id, user?.userId ?? null)
  }, {
    optionalAuth: true,
    params: SeasonIdParams,
    detail: { summary: 'List season announcements', tags: ['Season'], security: [{ bearerAuth: [] }, {}] },
  })
  .get('/organizer/seasons', async ({ user, query }) => {
    return seasonService.listManage(user.userId, query)
  }, {
    auth: true,
    query: ListManageQuery,
    detail: { summary: 'List manageable seasons', tags: ['Season'] },
  })
  .get('/admin/seasons', async ({ user, query }) => {
    return seasonService.listManage(user.userId, query)
  }, {
    operatorOnly: true,
    query: ListManageQuery,
    detail: { summary: 'List all seasons (admin)', tags: ['Season'] },
  })
  .post('/seasons', async ({ user, body }) => {
    return seasonService.create(user.userId, body)
  }, {
    auth: true,
    body: CreateSeasonBody,
    detail: { summary: 'Create a season draft', tags: ['Season'] },
  })
  .get('/seasons/:id/manage', async ({ user, params }) => {
    return seasonService.getManageDetail(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonIdParams,
    detail: { summary: 'Get season management detail', tags: ['Season'] },
  })
  .patch('/seasons/:id', async ({ user, params, body }) => {
    return seasonService.updateCore(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: UpdateSeasonBody,
    detail: { summary: 'Update season core fields', tags: ['Season'] },
  })
  .put('/seasons/:id/schedule', async ({ user, params, body }) => {
    return seasonService.updateSchedule(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: UpdateScheduleBody,
    detail: { summary: 'Update season schedule', tags: ['Season'] },
  })
  .put('/seasons/:id/rules', async ({ user, params, body }) => {
    return seasonService.updateRules(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: UpdateRulesBody,
    detail: { summary: 'Update typed season rules', tags: ['Season'] },
  })
  .put('/seasons/:id/rule-card', async ({ user, params, body }) => {
    return seasonService.updateRuleCard(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: UpdateRuleCardBody,
    detail: { summary: 'Replace season rule card', tags: ['Season'] },
  })
  .put('/seasons/:id/organizers', async ({ user, params, body }) => {
    return seasonService.updateOrganizers(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: UpdateOrganizersBody,
    detail: { summary: 'Replace season organizer orgs', tags: ['Season'] },
  })
  .post('/seasons/:id/submit', async ({ user, params }) => {
    return seasonService.submit(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonIdParams,
    detail: { summary: 'Submit season for approval', tags: ['Season'] },
  })
  .post('/seasons/:id/approve', async ({ user, params }) => {
    return seasonService.approve(params.id, user.userId)
  }, {
    operatorOnly: true,
    params: SeasonIdParams,
    detail: { summary: 'Approve a pending season', tags: ['Season'] },
  })
  .post('/seasons/:id/reject', async ({ user, params, body }) => {
    return seasonService.reject(params.id, user.userId, body.reason)
  }, {
    operatorOnly: true,
    params: SeasonIdParams,
    body: ReasonBody,
    detail: { summary: 'Reject a pending season', tags: ['Season'] },
  })
  .post('/seasons/:id/start', async ({ user, params }) => {
    return seasonService.start(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonIdParams,
    detail: { summary: 'Start an approved season', tags: ['Season'] },
  })
  .post('/seasons/:id/suspend', async ({ user, params }) => {
    return seasonService.suspend(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonIdParams,
    detail: { summary: 'Suspend a season', tags: ['Season'] },
  })
  .post('/seasons/:id/resume', async ({ user, params }) => {
    return seasonService.resume(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonIdParams,
    detail: { summary: 'Resume a suspended season', tags: ['Season'] },
  })
  .post('/seasons/:id/cancel', async ({ user, params, body }) => {
    return seasonService.cancel(params.id, user.userId, body.reason)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: ReasonBody,
    detail: { summary: 'Cancel a pre-start season', tags: ['Season'] },
  })
  .post('/seasons/:id/clone', async ({ user, params, body }) => {
    return seasonService.clone(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: CloneSeasonBody,
    detail: { summary: 'Clone a season into a new draft', tags: ['Season'] },
  })
  .put('/seasons/:id/pin', async ({ user, params, body }) => {
    return seasonService.pin(params.id, user.userId, body.pinned)
  }, {
    operatorOnly: true,
    params: SeasonIdParams,
    body: PinBody,
    detail: { summary: 'Pin or unpin a season', tags: ['Season'] },
  })
  .get('/seasons/:id/readiness', async ({ user, params }) => {
    return seasonService.readiness(params.id, user.userId)
  }, {
    auth: true,
    params: SeasonIdParams,
    detail: { summary: 'Get season publish readiness', tags: ['Season'] },
  })
  .post('/seasons/:id/announcements', async ({ user, params, body }) => {
    return seasonService.createAnnouncement(params.id, user.userId, body)
  }, {
    auth: true,
    params: SeasonIdParams,
    body: AnnouncementBody,
    detail: { summary: 'Create a season announcement', tags: ['Season'] },
  })
  .get('/seasons/:id/audit-logs', async ({ user, params, query }) => {
    return seasonService.listAuditLogs(params.id, user.userId, query)
  }, {
    auth: true,
    params: SeasonIdParams,
    query: AuditQuery,
    detail: { summary: 'List season audit logs', tags: ['Season'] },
  })
