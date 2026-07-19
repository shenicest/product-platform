import { Elysia, status } from 'elysia'
import { dbPlugin } from './db'
import { authPlugin, type AuthUser } from './auth'
import { UserIdentityService } from '../modules/user-identity/service'
import { Role } from '../modules/user-identity/model'

export const roleGuardPlugin = new Elysia({ name: 'role-guard' })
  .use(dbPlugin)
  .use(authPlugin)
  .macro({
    operatorOnly: {
      resolve: async ({ db, ...ctx }) => {
        const { user } = ctx as unknown as { user: AuthUser }
        const service = new UserIdentityService(db)
        const isOperator = await service.hasRole(user.userId, Role.Operator)
        if (!isOperator) return status(403, 'Forbidden')
      },
    },
  })
