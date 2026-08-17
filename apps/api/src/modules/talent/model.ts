import { t } from 'elysia'
import { CATEGORIES, COLLABORATION_DURATIONS, CONNECTION_PURPOSES, TALENT_ROLES, TALENT_SKILLS } from '@shenicest/shared'

const literalArray = <const T extends readonly string[]>(values: T) => t.Array(t.Union(values.map((value) => t.Literal(value)) as [any, ...any[]]))

export const TalentProfileBody = t.Object({
  headline: t.String({ minLength: 2, maxLength: 30 }),
  bio: t.String({ minLength: 30, maxLength: 500 }),
  city: t.Optional(t.String({ maxLength: 100 })),
  roles: literalArray(TALENT_ROLES),
  skills: literalArray(TALENT_SKILLS),
  seekingSkills: t.Optional(literalArray(TALENT_SKILLS)),
  domains: literalArray(CATEGORIES),
  durations: literalArray(COLLABORATION_DURATIONS),
})
export type TalentProfileBody = typeof TalentProfileBody.static

export const TalentListQuery = t.Object({
  q: t.Optional(t.String()),
  role: t.Optional(t.String()),
  skills: t.Optional(t.String()),
  duration: t.Optional(t.String()),
  sort: t.Optional(t.Union([t.Literal('new'), t.Literal('active')])),
  offset: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
export type TalentListQuery = typeof TalentListQuery.static

export const ConnectionBody = t.Object({
  receiverUserId: t.String(),
  projectId: t.Optional(t.Numeric()),
  purpose: t.Union(CONNECTION_PURPOSES.map((value) => t.Literal(value)) as [any, ...any[]]),
  message: t.String({ minLength: 30, maxLength: 500 }),
  wechat: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  email: t.Optional(t.String({ minLength: 1, maxLength: 254 })),
})
export type ConnectionBody = typeof ConnectionBody.static

export const AcceptBody = t.Object({
  wechat: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  email: t.Optional(t.String({ minLength: 1, maxLength: 254 })),
})
export type AcceptBody = typeof AcceptBody.static

export const ConnectionParams = t.Object({ id: t.Numeric() })
export const OperatorTalentQuery = t.Object({
  q: t.Optional(t.String()),
  status: t.Optional(t.Numeric()),
  offset: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
export const SuspendBody = t.Object({ reason: t.String({ minLength: 1, maxLength: 5000 }) })

export const ErrorResponse = t.Object({ error: t.Object({ code: t.String(), message: t.String() }) })
