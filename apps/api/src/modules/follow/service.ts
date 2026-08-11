import { and, count, eq, sql } from 'drizzle-orm'
import { follows, userIdentities } from '../../db/schema'
import type { Database } from '../../db'
import { Role } from '../user-identity/model'
import { CannotFollowSelfError, NotAFounderError } from './model'

export class FollowService {
  constructor(private db: Database) {}

  async follow(followerUserId: string, followeeUserId: string): Promise<{ followed: true; followerCount: number } | CannotFollowSelfError | NotAFounderError> {
    if (followerUserId === followeeUserId) return new CannotFollowSelfError()
    const [founder] = await this.db.select({ userId: userIdentities.userId }).from(userIdentities)
      .where(and(eq(userIdentities.userId, followeeUserId), eq(userIdentities.role, Role.Founder))).limit(1)
    if (!founder) return new NotAFounderError()

    await this.db.execute(sql`INSERT IGNORE INTO ${follows} (follower_user_id, followee_user_id) VALUES (${followerUserId}, ${followeeUserId})`)
    return { followed: true, followerCount: await this.getFollowerCount(followeeUserId) }
  }

  async unfollow(followerUserId: string, followeeUserId: string): Promise<{ followed: false; followerCount: number }> {
    await this.db.delete(follows).where(and(eq(follows.followerUserId, followerUserId), eq(follows.followeeUserId, followeeUserId)))
    return { followed: false, followerCount: await this.getFollowerCount(followeeUserId) }
  }

  async getMyFollows(followerUserId: string): Promise<string[]> {
    const rows = await this.db.select({ followeeUserId: follows.followeeUserId }).from(follows).where(eq(follows.followerUserId, followerUserId))
    return rows.map(({ followeeUserId }) => followeeUserId)
  }

  async getFollowerCount(followeeUserId: string): Promise<number> {
    const [result] = await this.db.select({ value: count() }).from(follows).where(eq(follows.followeeUserId, followeeUserId))
    return result?.value ?? 0
  }
}
