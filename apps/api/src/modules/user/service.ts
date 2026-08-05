import { sql } from 'drizzle-orm'
import type { Database } from '../../db'
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
}
