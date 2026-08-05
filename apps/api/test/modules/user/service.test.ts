import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { db } from '../../../src/db'
import { SHARED_USERS_TABLE, UserProfileService } from '../../../src/modules/user/service'

// The shared User table keys users by integer ids; pick ids that can't
// collide with real external users.
const PROFILE_USER_ID = '9999901'
const EMPTY_PROFILE_USER_ID = '9999902'
const MISSING_USER_ID = '9999903'

describe('UserProfileService', () => {
  const service = new UserProfileService(db)

  beforeAll(async () => {
    await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname, avatar_url)
      VALUES (${PROFILE_USER_ID}, '测试创始人', 'https://example.com/avatar.png'),
             (${EMPTY_PROFILE_USER_ID}, NULL, NULL)`)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id IN (${PROFILE_USER_ID}, ${EMPTY_PROFILE_USER_ID})`)
  })

  it('returns the public profile when the shared users table has a row', async () => {
    const profile = await service.getPublicProfile(PROFILE_USER_ID)
    expect(profile).toEqual({
      nickname: '测试创始人',
      avatarUrl: 'https://example.com/avatar.png',
    })
  })

  it('returns null fields when the row has no nickname or avatar', async () => {
    const profile = await service.getPublicProfile(EMPTY_PROFILE_USER_ID)
    expect(profile).toEqual({ nickname: null, avatarUrl: null })
  })

  it('returns null when the user has no row in the shared table', async () => {
    expect(await service.getPublicProfile(MISSING_USER_ID)).toBeNull()
  })

  it('returns null for ids that cannot match the integer-keyed shared table', async () => {
    expect(await service.getPublicProfile('founder-001')).toBeNull()
    expect(await service.getPublicProfile(crypto.randomUUID())).toBeNull()
    expect(await service.getPublicProfile('')).toBeNull()
  })
})
