import { t } from 'elysia'

export const SeasonIdParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
})

export const SeasonScheduleSchema = t.Object({
  applyOpen: t.String({ description: 'ISO 8601' }),
  applyClose: t.String({ description: 'ISO 8601' }),
  startAt: t.String({ description: 'ISO 8601' }),
  teamDeadline: t.String({ description: 'ISO 8601' }),
  challengeFreezeAt: t.String({ description: 'ISO 8601' }),
  workDeadline: t.String({ description: 'ISO 8601' }),
  scoreDeadline: t.String({ description: 'ISO 8601' }),
  settleDate: t.String({ description: 'ISO 8601' }),
})

export const SeasonRulesSchema = t.Object({
  maxChallengesPerProject: t.Number({ minimum: 1, maximum: 3 }),
  maxProjectsPerParticipant: t.Number({ minimum: 1, maximum: 20 }),
  maxCoreMembers: t.Number({ minimum: 1, maximum: 3 }),
  singleWorkCap: t.Number({ minimum: 1, maximum: 1_000_000 }),
  exchangeRatio: t.Number({ minimum: 0.0001, maximum: 1_000_000 }),
  reviewThreshold: t.Number({ minimum: 0, maximum: 1_000_000 }),
  dailyQuotaEnabled: t.Boolean(),
})

const SeasonTypeSchema = t.Union([t.Literal('season'), t.Literal('hackathon')])

export const CreateSeasonBody = t.Object({
  code: t.String({ minLength: 1, maxLength: 32, pattern: '^[A-Za-z0-9_-]+$' }),
  name: t.String({ minLength: 2, maxLength: 255 }),
  type: t.Optional(SeasonTypeSchema),
  city: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  intro: t.Optional(t.Union([t.String({ maxLength: 5000 }), t.Null()])),
  themes: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 20 })),
  schedule: t.Optional(t.Union([SeasonScheduleSchema, t.Null()])),
  rules: t.Optional(t.Partial(SeasonRulesSchema)),
  organizerOrgIds: t.Array(t.Number(), { minItems: 1 }),
  agreementVersion: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
  awardingEntity: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  participantCapacity: t.Optional(t.Union([t.Integer({ minimum: 1, maximum: 100000 }), t.Null()])),
})

export const UpdateSeasonBody = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
  type: t.Optional(SeasonTypeSchema),
  city: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Null()])),
  intro: t.Optional(t.Union([t.String({ maxLength: 5000 }), t.Null()])),
  themes: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 20 })),
  agreementVersion: t.Optional(t.String({ minLength: 1, maxLength: 32 })),
  awardingEntity: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  participantCapacity: t.Optional(t.Union([t.Integer({ minimum: 1, maximum: 100000 }), t.Null()])),
})

const AnnouncementInput = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
  content: t.Optional(t.String({ minLength: 1, maxLength: 5000 })),
})

export const UpdateScheduleBody = t.Object({
  schedule: SeasonScheduleSchema,
  announcement: t.Optional(AnnouncementInput),
})

export const UpdateRulesBody = t.Object({
  rules: SeasonRulesSchema,
  announcement: t.Optional(AnnouncementInput),
})

export const UpdateRuleCardBody = t.Object({
  items: t.Array(t.Object({
    key: t.String({ minLength: 1, maxLength: 64 }),
    label: t.String({ minLength: 1, maxLength: 255 }),
    value: t.String({ minLength: 1 }),
    visible: t.Optional(t.Boolean()),
  })),
  announcement: t.Optional(AnnouncementInput),
})

export const UpdateOrganizersBody = t.Object({
  organizerOrgIds: t.Array(t.Number(), { minItems: 1 }),
})

export const ReasonBody = t.Object({
  reason: t.String({ minLength: 2, maxLength: 2000 }),
})

export const CloneSeasonBody = t.Object({
  code: t.String({ minLength: 1, maxLength: 32, pattern: '^[A-Za-z0-9_-]+$' }),
  name: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
})

export const PinBody = t.Object({
  pinned: t.Boolean(),
})

export const AnnouncementBody = t.Object({
  title: t.String({ minLength: 2, maxLength: 255 }),
  content: t.String({ minLength: 1, maxLength: 5000 }),
  category: t.Optional(t.Union([
    t.Literal('general'),
    t.Literal('schedule'),
    t.Literal('rules'),
  ])),
})

export const ListSeasonsQuery = t.Object({
  status: t.Optional(t.String()),
  type: t.Optional(SeasonTypeSchema),
  city: t.Optional(t.String()),
  theme: t.Optional(t.String()),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const ListManageQuery = t.Object({
  status: t.Optional(t.String()),
  pendingApproval: t.Optional(t.String()),
  type: t.Optional(SeasonTypeSchema),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const AuditQuery = t.Object({
  action: t.Optional(t.String()),
  targetType: t.Optional(t.String()),
  targetId: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export type CreateSeasonBody = typeof CreateSeasonBody.static
export type UpdateSeasonBody = typeof UpdateSeasonBody.static
export type UpdateScheduleBody = typeof UpdateScheduleBody.static
export type UpdateRulesBody = typeof UpdateRulesBody.static
export type UpdateRuleCardBody = typeof UpdateRuleCardBody.static
export type UpdateOrganizersBody = typeof UpdateOrganizersBody.static
export type CloneSeasonBody = typeof CloneSeasonBody.static
export type AnnouncementBody = typeof AnnouncementBody.static
export type ListSeasonsQuery = typeof ListSeasonsQuery.static
export type ListManageQuery = typeof ListManageQuery.static
export type AuditQuery = typeof AuditQuery.static
