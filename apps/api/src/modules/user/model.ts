import { t } from 'elysia'

// Public founder profile, read from the shared User table owned by the
// external auth system. Both fields are optional on that table.
export const PublicProfile = t.Object({
  nickname: t.Union([t.String(), t.Null()], { description: 'Founder public display name' }),
  avatarUrl: t.Union([t.String(), t.Null()], { description: 'Founder public avatar URL' }),
})
export type PublicProfile = typeof PublicProfile.static
