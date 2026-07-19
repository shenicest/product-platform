import { Elysia, t } from 'elysia'
import { dbPlugin } from '../../plugins/db'
import { authPlugin } from '../../plugins/auth'
import { roleGuardPlugin } from '../../plugins/role-guard'
import { db } from '../../db'
import { UserIdentityService } from './service'
import { RolesResponse, UserIdParams } from './model'
import { ErrorResponse } from '../../common'

export const userIdentityService = new UserIdentityService(db)

export const userIdentityModule = new Elysia({ prefix: '/identity' })
  .use(dbPlugin)
  .use(authPlugin)
  .use(roleGuardPlugin)
  .model({
    RolesResponse,
    UserIdParams,
  })
  .prefix('model', 'UserIdentity.')
  .get('/roles', async ({ user }) => {
    const roles = await userIdentityService.getRoles(user.userId)
    return { roles }
  }, {
    auth: true,
    detail: {
      summary: 'Get my roles',
      description: 'Returns the roles of the authenticated user',
      tags: ['UserIdentity'],
    },
    response: {
      200: 'UserIdentity.RolesResponse',
      401: ErrorResponse,
    },
  })
  .get('/users/:userId/roles', async ({ params }) => {
    const roles = await userIdentityService.getRoles(params.userId)
    return { roles }
  }, {
    operatorOnly: true,
    detail: {
      summary: 'Get user roles (operator)',
      description: 'Returns the roles of a specific user. Operator only.',
      tags: ['UserIdentity'],
    },
    params: 'UserIdentity.UserIdParams',
    response: {
      200: 'UserIdentity.RolesResponse',
      401: ErrorResponse,
      403: ErrorResponse,
    },
  })
