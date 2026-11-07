import { t } from 'elysia'

const ReviewStatusSchema = t.Union([
  t.Literal('submitted'),
  t.Literal('accepted'),
  t.Literal('pending'),
  t.Literal('waitlisted'),
  t.Literal('rejected'),
])

const ApplicationStatusSchema = t.Union([
  t.Literal('submitted'),
  t.Literal('accepted'),
  t.Literal('pending'),
  t.Literal('waitlisted'),
  t.Literal('rejected'),
  t.Literal('withdrawn'),
])

const VisibilitySchema = t.Union([t.Literal('public'), t.Literal('organizer_only')])

const ParticipantStatusSchema = t.Union([t.Literal('active'), t.Literal('withdrawn')])

const WechatStatusSchema = t.Union([
  t.Literal('not_invited'),
  t.Literal('invited'),
  t.Literal('joined'),
  t.Literal('failed'),
])

export const ApplicationIdParams = t.Object({
  id: t.Numeric({ description: 'Application ID' }),
})

export const SeasonApplicationParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
})

export const ParticipantParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
  userId: t.String({ minLength: 1 }),
})

export const CreateApplicationBody = t.Object({
  skills: t.String({ minLength: 1, maxLength: 2000 }),
  experience: t.String({ minLength: 1, maxLength: 4000 }),
  themes: t.Array(t.String({ minLength: 1, maxLength: 50 }), { maxItems: 3 }),
  teamIntent: t.String({ minLength: 1, maxLength: 1000 }),
  acceptsSolo: t.Boolean(),
  availability: t.String({ minLength: 1, maxLength: 500 }),
  cityMode: t.String({ minLength: 1, maxLength: 200 }),
  contact: t.Object({
    wechat: t.Optional(t.String({ maxLength: 100 })),
    phone: t.Optional(t.String({ maxLength: 50 })),
  }),
  visibility: t.Optional(VisibilitySchema),
  agreementVersion: t.String({ minLength: 1, maxLength: 32 }),
})

export const MyApplicationsQuery = t.Object({
  seasonId: t.Optional(t.Numeric({ minimum: 1 })),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const SeasonApplicationsQuery = t.Object({
  status: t.Optional(ApplicationStatusSchema),
  visibility: t.Optional(VisibilitySchema),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const UpdateApplicationStatusBody = t.Object({
  status: ReviewStatusSchema,
  reason: t.Optional(t.String({ minLength: 2, maxLength: 2000 })),
})

export const WithdrawParticipantBody = t.Object({
  confirm: t.Boolean(),
  reason: t.Optional(t.String({ minLength: 2, maxLength: 2000 })),
})

export const ParticipantsQuery = t.Object({
  status: t.Optional(ParticipantStatusSchema),
  wechatStatus: t.Optional(WechatStatusSchema),
  q: t.Optional(t.String()),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const UpdateWechatBody = t.Object({
  status: WechatStatusSchema,
})

export type CreateApplicationBody = typeof CreateApplicationBody.static
export type UpdateApplicationStatusBody = typeof UpdateApplicationStatusBody.static
