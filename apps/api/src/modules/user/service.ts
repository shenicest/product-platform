import { sql } from 'drizzle-orm'
import type { Database } from '../../db'
import { mockOverrideFor } from '../../mock'
import type { PublicProfile } from './model'

// The shared User table is owned by the external auth system and lives outside
// this service's own schema, so runtime code only ever reads it: never created,
// migrated, or written to. Exported so the dev seed and tests fixture the same
// table the service reads.
export const SHARED_USERS_TABLE = process.env.SHARED_USERS_TABLE ?? 'event_management.users'
if (!/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(SHARED_USERS_TABLE)) {
  throw new Error(`SHARED_USERS_TABLE must be formatted as database.table, got: ${SHARED_USERS_TABLE}`)
}

type SharedUserRow = { nickname: string | null; avatar_url: string | null }

export class UserProfileService {
  constructor(private db: Database) {}

  // Public founder profile for display on project pages. Returns null when the
  // user has no row in the shared table, or when the id cannot match one (the
  // shared table keys users by integer ids, while this platform carries user
  // ids as strings). Lookup failures against the external table degrade to
  // null so a profile problem can never take down the project detail page.
  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    // 本地 mock 用户：资料来自 fixtures.ts，不查外部表（见 mock/overrides.ts）。
    const mocked = mockOverrideFor(userId)
    if (mocked) return mocked.sharedProfile

    if (!/^\d+$/.test(userId)) return null
    try {
      // drizzle types execute() as ResultSetHeader; mysql2 actually resolves
      // to a [rows, fields] tuple at runtime.
      const [rows] = (await this.db.execute(
        sql`SELECT nickname, avatar_url FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id = ${userId} LIMIT 1`,
      )) as unknown as [SharedUserRow[]]
      const row = rows[0]
      if (!row) return null
      return { nickname: row.nickname ?? null, avatarUrl: row.avatar_url ?? null }
    } catch {
      return null
    }
  }

  // Whether a user exists in the shared external-auth table. Used before
  // granting season-scoped roles (organizer member, scorer, verifier) so a
  // typo cannot create a dangling grant. Degrades to false on lookup failure.
  async exists(userId: string): Promise<boolean> {
    // 有 mock 覆盖的用户一定“存在”，否则主办方加成员、评委分配这类写操作
    // 会在本地因为共享表里没有这行而直接 404。
    if (mockOverrideFor(userId)) return true

    if (!/^\d+$/.test(userId)) return false
    try {
      const [rows] = (await this.db.execute(
        sql`SELECT 1 AS present FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id = ${userId} LIMIT 1`,
      )) as unknown as [{ present: number }[]]
      return rows.length > 0
    } catch {
      return false
    }
  }

  // The platform-account email of a user (external auth system owns it).
  // Used as the notification recipient for connection outcomes. Degrades to
  // null exactly like getPublicProfile — a missing row or a flaky external
  // table must never break the surrounding transaction; callers treat null
  // as "no email addressable, skip the notification".
  async getEmail(userId: string): Promise<string | null> {
    // mock 用户的邮箱取自 fixtures.ts；`email: null` 的条目正好用来调
    // “收件人不可达，跳过通知”这条分支。
    const mocked = mockOverrideFor(userId)
    if (mocked) return mocked.email

    if (!/^\d+$/.test(userId)) return null
    try {
      const [rows] = (await this.db.execute(
        sql`SELECT email FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id = ${userId} LIMIT 1`,
      )) as unknown as [{ email: string | null }[]]
      return rows[0]?.email ?? null
    } catch {
      return null
    }
  }
}
