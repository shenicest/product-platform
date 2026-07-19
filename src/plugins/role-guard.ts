import { Elysia, status } from 'elysia'
import { authPlugin } from './auth'
import { userIdentityService } from '../modules/user-identity'
import { Role } from '../modules/user-identity/model'
import { ErrorCode, ErrorMessage } from '../common'

export const roleGuardPlugin = new Elysia({ name: 'role-guard' })
  .use(authPlugin)
  .macro('operatorOnly', {
    auth: true,
    resolve: async ({ user }) => {
      const isOperator = await userIdentityService.hasRole(user.userId, Role.Operator)
      if (!isOperator) return status(403, { error: { code: ErrorCode.FORBIDDEN, message: ErrorMessage.FORBIDDEN } })
    },
  })
