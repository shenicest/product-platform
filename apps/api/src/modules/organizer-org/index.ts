import { Elysia } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { roleGuardPlugin } from '../../plugins/role-guard'
import { db } from '../../db'
import { onBoomlandError } from '../boomland-shared'
import { AddMemberBody, CreateOrgBody, OrgIdParams, OrgMemberParams } from './model'
import { OrganizerOrgService } from './service'

export const organizerOrgService = new OrganizerOrgService(db)

export const organizerOrgModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .use(roleGuardPlugin)
  .onError(onBoomlandError)
  .get('/organizer-orgs', async ({ user }) => {
    return { items: await organizerOrgService.list(user.userId) }
  }, {
    auth: true,
    detail: { summary: 'List organizer orgs', tags: ['OrganizerOrg'] },
  })
  .get('/organizer-orgs/:id/members', async ({ user, params }) => {
    return { items: await organizerOrgService.listMembers(params.id, user.userId) }
  }, {
    auth: true,
    params: OrgIdParams,
    detail: { summary: 'List organizer org members', tags: ['OrganizerOrg'] },
  })
  .post('/admin/organizer-orgs', async ({ user, body }) => {
    return organizerOrgService.create(body.name, user.userId)
  }, {
    operatorOnly: true,
    body: CreateOrgBody,
    detail: { summary: 'Create organizer org', tags: ['OrganizerOrg'] },
  })
  .patch('/admin/organizer-orgs/:id', async ({ user, params, body }) => {
    return organizerOrgService.rename(params.id, body.name, user.userId)
  }, {
    operatorOnly: true,
    params: OrgIdParams,
    body: CreateOrgBody,
    detail: { summary: 'Rename organizer org', tags: ['OrganizerOrg'] },
  })
  .delete('/admin/organizer-orgs/:id', async ({ user, params, set }) => {
    await organizerOrgService.remove(params.id, user.userId)
    set.status = 204
  }, {
    operatorOnly: true,
    params: OrgIdParams,
    detail: { summary: 'Delete organizer org', tags: ['OrganizerOrg'] },
  })
  .post('/admin/organizer-orgs/:id/members', async ({ user, params, body }) => {
    return organizerOrgService.addMember(params.id, body.userId, user.userId)
  }, {
    operatorOnly: true,
    params: OrgIdParams,
    body: AddMemberBody,
    detail: { summary: 'Add organizer org member', tags: ['OrganizerOrg'] },
  })
  .delete('/admin/organizer-orgs/:id/members/:userId', async ({ user, params, set }) => {
    await organizerOrgService.removeMember(params.id, params.userId, user.userId)
    set.status = 204
  }, {
    operatorOnly: true,
    params: OrgMemberParams,
    detail: { summary: 'Remove organizer org member', tags: ['OrganizerOrg'] },
  })
