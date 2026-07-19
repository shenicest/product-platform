import { and, eq } from 'drizzle-orm'
import { userIdentities } from '../../db/schema'
import type { Database } from '../../db'
import type { Role } from './model'

export class UserIdentityService {
  constructor(private db: Database) {}

  async grantRole(userId: string, role: Role): Promise<void> {
    await this.db
      .insert(userIdentities)
      .values({ userId, role })
      .onDuplicateKeyUpdate({ set: { role } })
  }

  async hasRole(userId: string, role: Role): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.userId, userId),
          eq(userIdentities.role, role),
        ),
      )
      .limit(1)
    return rows.length > 0
  }

  async getRoles(userId: string): Promise<Role[]> {
    const rows = await this.db
      .select({ role: userIdentities.role })
      .from(userIdentities)
      .where(eq(userIdentities.userId, userId))
    return rows.map((r) => r.role as Role)
  }
}
