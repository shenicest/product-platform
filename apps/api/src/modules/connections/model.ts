import { t } from 'elysia'

export const ConnectionsQuery = t.Object({
  source: t.Optional(t.Union([t.Literal('all'), t.Literal('talent'), t.Literal('hackathon')])),
  direction: t.Optional(t.Union([t.Literal('all'), t.Literal('sent'), t.Literal('received')])),
})
export type ConnectionsQuery = typeof ConnectionsQuery.static
