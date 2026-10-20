import { t } from 'elysia'
import {
  CATEGORIES,
  COLLABORATION_DURATIONS,
  CONNECTION_PURPOSES,
  TALENT_SKILLS,
  TalentAvailability,
} from '@shenicest/shared'

const literalArray = <const T extends readonly string[]>(values: T) => t.Array(t.Union(values.map((value) => t.Literal(value)) as [any, ...any[]]))

const availabilityLiterals = Object.values(TalentAvailability) as [TalentAvailability, ...TalentAvailability[]]

// `links` entries are raw strings at the DB contract layer; the http(s)
// format check lives in the service (XSS boundary, mirrors project links).
export const TalentProfileBody = t.Object({
  headline: t.String({ minLength: 4, maxLength: 50 }),
  bio: t.Optional(t.String({ minLength: 30, maxLength: 500 })),
  links: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 500 }), { maxItems: 3 })),
  city: t.Optional(t.String({ maxLength: 100 })),
  skills: literalArray(TALENT_SKILLS),
  seekingSkills: t.Optional(literalArray(TALENT_SKILLS)),
  domains: literalArray(CATEGORIES),
  durations: literalArray(COLLABORATION_DURATIONS),
  availability: t.Union(availabilityLiterals.map((value) => t.Literal(value)) as [any, ...any[]]),
})
export type TalentProfileBody = typeof TalentProfileBody.static

export const TalentListQuery = t.Object({
  q: t.Optional(t.String()),
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
  message: t.String({ minLength: 10, maxLength: 500 }),
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
