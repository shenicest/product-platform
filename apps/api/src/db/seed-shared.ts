import { sql } from 'drizzle-orm'
import { db } from './index'
import { SHARED_USERS_TABLE } from '../modules/user/service'

// Pieces shared by every dev seed script (seed.ts, seed-season.ts). Keeping
// them here means the demo user ids, organizer orgs and the shared-users
// fixture stay in sync no matter which seed you run.

// Integer-string ids to match the external auth system's user ids, which the
// shared users table keys by integer.
export const OPERATOR_USER_ID = process.env.OPERATOR_USER_ID ?? '2'
export const FOUNDER_USER_ID = process.env.FOUNDER_USER_ID ?? '1'

export const DAY = 86_400_000
export const HOUR = 3_600_000
export const MINUTE = 60_000

export const cover = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`

/** Demo accounts beyond the founder/operator pair. */
export const DEMO_USER_IDS = {
  /** 张一：BoomLand 组委会成员，也是 AI4BBS 的选手（报名 → 通过 → 已入群） */
  organizer: '101',
  /** 李二：曜石储能联系人 / 评委 */
  yaoshi: '102',
  /** 王知微：青禾物流联系人 / 核验员 */
  qinghe: '103',
  /** 评审甲、评审乙：持有积分分配的评委 */
  scorerA: '108',
  scorerB: '109',
  /** 核验甲、核验乙：赛季核验员 */
  verifierA: '110',
  verifierB: '111',
} as const

/** BoomLand demo organizer orgs (one 组委会 + one per 出题企业, 方便 demo 多组织)。 */
export const BOOMLAND_ORGS = [
  { key: 'committee', name: 'BoomLand 组委会' },
  { key: 'yaoshi', name: '曜石储能' },
  { key: 'qinghe', name: '青禾物流' },
] as const
export type BoomlandOrgKey = (typeof BOOMLAND_ORGS)[number]['key']

// The shared users table is owned by the external auth system; the dev seed
// only touches it so dev data can demonstrate the public founder profile and
// so demo participants/business contacts link to a real user identity. Best
// effort — the platform works without it (the profile simply isn't shown).
export async function upsertSharedUsers(
  profiles: Array<{ id: string; nickname: string; avatar?: string }>,
): Promise<{ seeded: number; skipped: number }> {
  const valid = profiles.filter((profile) => /^\d+$/.test(profile.id))
  for (const profile of valid) {
    const avatar = profile.avatar ?? cover(`user-${profile.id}`)
    await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname, avatar_url)
      VALUES (${profile.id}, ${profile.nickname}, ${avatar})
      ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_url = VALUES(avatar_url)`)
  }
  return { seeded: valid.length, skipped: profiles.length - valid.length }
}
