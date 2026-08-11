import { t } from 'elysia'

export const FounderUserIdParams = t.Object({
  userId: t.String({ minLength: 1, description: 'Founder user ID' }),
})
export type FounderUserIdParams = typeof FounderUserIdParams.static

export const FollowResponse = t.Object({
  followed: t.Boolean(),
  followerCount: t.Number(),
})
export type FollowResponse = typeof FollowResponse.static

export const MyFollowsResponse = t.Object({
  followed_founder_user_ids: t.Array(t.String()),
})
export type MyFollowsResponse = typeof MyFollowsResponse.static

export class CannotFollowSelfError extends Error {
  readonly code = 'CANNOT_FOLLOW_SELF'

  constructor() {
    super('Cannot follow yourself')
  }
}

export class NotAFounderError extends Error {
  readonly code = 'NOT_A_FOUNDER'

  constructor() {
    super('Target user is not a Founder')
  }
}
