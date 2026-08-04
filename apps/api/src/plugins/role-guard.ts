import { Elysia, status } from 'elysia'
import { authPlugin } from './auth'
import { db } from '../db'
import { UserIdentityService } from '../modules/user-identity/service'
import { Role } from '../modules/user-identity/model'
import { ErrorCode, ErrorMessage } from '../common'

const userIdentityService = new UserIdentityService(db)

export const roleGuardPlugin = new Elysia({ name: 'role-guard' })
  .use(authPlugin)
  .macro('operatorOnly', {
    auth: true,
    resolve: async ({ user }) => {
      const isOperator = await userIdentityService.hasRole(user.userId, Role.Operator)
      if (!isOperator) return status(403, { error: { code: ErrorCode.FORBIDDEN, message: ErrorMessage.FORBIDDEN } })
    },
  })
  .macro('founderOnly', {
    auth: true,
    resolve: async ({ user }) => {
      const isFounder = await userIdentityService.hasRole(user.userId, Role.Founder)
      if (!isFounder) return status(403, { error: { code: ErrorCode.FORBIDDEN, message: ErrorMessage.FORBIDDEN } })
    },
  })
