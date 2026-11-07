import { and, eq } from 'drizzle-orm'
import { Role } from '@shenicest/shared'
import type { Database } from '../../db'
import { organizerOrgMembers, seasonOrganizers } from '../../db/schema'
import { UserIdentityService } from '../user-identity/service'
import { boomlandError } from './errors'

export class BoomlandAccessService {
  private userIdentity: UserIdentityService

  constructor(private db: Database) {
    this.userIdentity = new UserIdentityService(db)
  }

  async isOperator(userId: string): Promise<boolean> {
    return this.userIdentity.hasRole(userId, Role.Operator)
  }

  async assertOperator(userId: string): Promise<void> {
    if (!(await this.isOperator(userId))) {
      throw boomlandError('FORBIDDEN', '仅平台管理员可以执行此操作', 403)
    }
  }

  async getOrganizerOrgIds(userId: string): Promise<number[]> {
    const rows = await this.db
      .select({ orgId: organizerOrgMembers.orgId })
      .from(organizerOrgMembers)
      .where(eq(organizerOrgMembers.userId, userId))
    return rows.map((row) => row.orgId)
  }

  async isOrgMember(orgId: number, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: organizerOrgMembers.id })
      .from(organizerOrgMembers)
      .where(and(eq(organizerOrgMembers.orgId, orgId), eq(organizerOrgMembers.userId, userId)))
      .limit(1)
    return rows.length > 0
  }

  async assertOrgMemberOrOperator(orgId: number, userId: string): Promise<void> {
    if (await this.isOperator(userId)) return
    if (await this.isOrgMember(orgId, userId)) return
    throw boomlandError('FORBIDDEN', '你不是该主办方组织的成员', 403)
  }

  async isSeasonOrganizer(seasonId: number, userId: string): Promise<boolean> {
    if (await this.isOperator(userId)) return true
    const rows = await this.db
      .select({ id: seasonOrganizers.id })
      .from(seasonOrganizers)
      .innerJoin(organizerOrgMembers, eq(seasonOrganizers.orgId, organizerOrgMembers.orgId))
      .where(and(eq(seasonOrganizers.seasonId, seasonId), eq(organizerOrgMembers.userId, userId)))
      .limit(1)
    return rows.length > 0
  }

  async assertSeasonAccess(seasonId: number, userId: string): Promise<void> {
    if (await this.isSeasonOrganizer(seasonId, userId)) return
    throw boomlandError('NOT_SEASON_ORGANIZER', '你没有该赛季的管理权限', 403)
  }
}
