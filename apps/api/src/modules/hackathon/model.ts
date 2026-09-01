import { t } from 'elysia'

export const HackathonProject = t.Object({
  id: t.Number(), name: t.String(), tagline: t.Union([t.String(), t.Null()]),
  description: t.Union([t.String(), t.Null()]), coverUrl: t.Union([t.String(), t.Null()]),
  demoLink: t.Union([t.String(), t.Null()]), demoVideoUrl: t.Union([t.String(), t.Null()]),
  demoImages: t.Array(t.String()), teamName: t.Union([t.String(), t.Null()]),
  track: t.Union([t.String(), t.Null()]), githubUrl: t.Union([t.String(), t.Null()]),
  likeCount: t.Number(), eventId: t.Number(),
})
export type HackathonProject = typeof HackathonProject.static

export const HackathonProjectListResponse = t.Object({ data: t.Array(HackathonProject), total: t.Number() })
export const LikeResponse = t.Object({ liked: t.Boolean(), likeCount: t.Number() })
export const HackathonProjectQuery = t.Object({
  track: t.Optional(t.Union([
    t.Literal('software'), t.Literal('hardware'), t.Literal('game'), t.Literal('aigc'),
  ])),
  limit: t.Optional(t.Numeric()), offset: t.Optional(t.Numeric()),
})
export type HackathonProjectQuery = typeof HackathonProjectQuery.static

export const HackathonProjectIdParams = t.Object({ id: t.Numeric({ description: 'Hackathon project ID' }) })
export const HackathonHideResponse = t.Object({ hidden: t.Boolean() })
