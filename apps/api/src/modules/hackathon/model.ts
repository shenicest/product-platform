import { t } from 'elysia'

export const HackathonProject = t.Object({
  id: t.Number(), name: t.String(), tagline: t.Union([t.String(), t.Null()]),
  description: t.Union([t.String(), t.Null()]), coverUrl: t.Union([t.String(), t.Null()]),
  demoLink: t.Union([t.String(), t.Null()]), demoVideoUrl: t.Union([t.String(), t.Null()]),
  demoImages: t.Array(t.String()), teamName: t.Union([t.String(), t.Null()]),
  track: t.Union([t.String(), t.Null()]), githubUrl: t.Union([t.String(), t.Null()]),
  likeCount: t.Number(), eventId: t.Number(),
  tagCounts: t.Record(t.String(), t.Number()), myTagIds: t.Array(t.String()),
})
export type HackathonProject = typeof HackathonProject.static

export const HackathonProjectListResponse = t.Object({ data: t.Array(HackathonProject), total: t.Number() })
export const LikeResponse = t.Object({ liked: t.Boolean(), likeCount: t.Number() })
export const HackathonProjectQuery = t.Object({
  track: t.Optional(t.Union([
    t.Literal('software'), t.Literal('hardware'), t.Literal('game'), t.Literal('aigc'),
  ])),
  q: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()), offset: t.Optional(t.Numeric()),
})
export type HackathonProjectQuery = typeof HackathonProjectQuery.static

export const HackathonProjectIdParams = t.Object({ id: t.Numeric({ description: 'Hackathon project ID' }) })
export const HackathonHideResponse = t.Object({ hidden: t.Boolean() })
export const HackathonProjectUpdateBody = t.Object({
  description: t.Optional(t.Union([t.String({ maxLength: 20000 }), t.Null()])),
  coverUrl: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
  demoLink: t.Optional(t.Union([t.String({ maxLength: 2048, format: 'uri' }), t.Null()])),
})
export const HackathonProjectUpdateResponse = t.Object({ updated: t.Boolean() })
export const HackathonTagBody = t.Object({ tagId: t.String({ minLength: 1, maxLength: 100 }) })
export const HackathonTagParams = t.Object({
  id: t.Numeric({ description: 'Hackathon project ID' }),
  tagId: t.String({ minLength: 1, maxLength: 100 }),
})
export const HackathonTagResponse = t.Object({ tagId: t.String(), selected: t.Boolean(), tagCounts: t.Record(t.String(), t.Number()) })
