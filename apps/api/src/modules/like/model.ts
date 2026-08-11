import { t } from 'elysia'

export const LikeResponse = t.Object({
  liked: t.Boolean(),
  likeCount: t.Number(),
})
export type LikeResponse = typeof LikeResponse.static

export const MyLikesResponse = t.Object({
  liked_project_ids: t.Array(t.Number()),
})
export type MyLikesResponse = typeof MyLikesResponse.static

export class NotLikableError extends Error {
  readonly code = 'NOT_LIKABLE'

  constructor() {
    super('Only Live projects can be liked')
    this.name = 'NotLikableError'
  }
}
