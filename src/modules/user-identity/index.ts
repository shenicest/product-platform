import { Elysia, t } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { roleGuardPlugin } from '../../plugins/role-guard'
import { UserIdentityService } from './service'
import { RolesResponse, UserIdParams } from './model'

export const userIdentityModule = new Elysia({ prefix: '/identity' })
  .use(dbPlugin)
  .use(authPlugin)
  .use(roleGuardPlugin)
  .model({
    'UserIdentity.RolesResponse': RolesResponse,
    'UserIdentity.UserIdParams': UserIdParams,
  })
  .get('/roles', async ({ user, db }) => {
    const service = new UserIdentityService(db)
    const roles = await service.getRoles(user.userId)
    return { roles }
  }, {
    auth: true,
    response: {
      200: 'UserIdentity.RolesResponse',
      401: t.Literal('Unauthorized'),
    },
  })
  .get('/users/:userId/roles', async ({ db, params }) => {
    const service = new UserIdentityService(db)
    const roles = await service.getRoles(params.userId)
    return { roles }
  }, {
    auth: true,
    operatorOnly: true,
    params: 'UserIdentity.UserIdParams',
    response: {
      200: 'UserIdentity.RolesResponse',
      401: t.Literal('Unauthorized'),
      403: t.Literal('Forbidden'),
    },
  })
