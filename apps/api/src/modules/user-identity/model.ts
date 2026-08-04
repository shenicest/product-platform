import { t } from 'elysia'

export { Role } from '@shenicest/shared'

export const RolesResponse = t.Object({
  roles: t.Array(t.Number(), { description: 'Role IDs: 0=Founder, 1=Operator' }),
})
export type RolesResponse = typeof RolesResponse.static

export const UserIdParams = t.Object({
  userId: t.String({ description: 'Target user ID' }),
})
export type UserIdParams = typeof UserIdParams.static
