import { t } from 'elysia'

export const Role = {
  Founder: 0,
  Operator: 1,
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const RolesResponse = t.Object({
  roles: t.Array(t.Number()),
})
export type RolesResponse = typeof RolesResponse.static

export const UserIdParams = t.Object({
  userId: t.String(),
})
export type UserIdParams = typeof UserIdParams.static
