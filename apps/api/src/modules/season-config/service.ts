import { and, desc, eq } from 'drizzle-orm'
import { BudgetStatus, PointAllocationStatus, PointPoolStatus, VerifierGrantStatus } from '@shenicest/shared'
import type { Database } from '../../db'
import {
  pointAllocations,
  seasonBudgets,
  seasonPointPools,
  seasonVerifierGrants,
  seasons,
} from '../../db/schema'
import { UserProfileService } from '../user/service'
import {
  BoomlandAccessService,
  boomlandError,
  iso,
  writeAudit,
} from '../boomland-shared'
import type { AddBudgetBody, CreateAllocationBody } from './model'

type BudgetRow = typeof seasonBudgets.$inferSelect
type PoolRow = typeof seasonPointPools.$inferSelect
type AllocationRow = typeof pointAllocations.$inferSelect
type VerifierRow = typeof seasonVerifierGrants.$inferSelect
type SeasonRow = typeof seasons.$inferSelect

function budgetDto(row: BudgetRow) {
  return {
    id: row.id,
    seasonId: row.seasonId,
    version: row.version,
    totalAmount: row.totalAmount,
    status: row.status,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt)!,
  }
}

function poolDto(row: PoolRow) {
  return {
    seasonId: row.seasonId,
    totalPoints: row.totalPoints,
    allocatedPoints: row.allocatedPoints,
    usedPoints: row.usedPoints,
    unallocatedPoints: row.totalPoints - row.allocatedPoints,
    version: row.version,
    status: row.status,
    updatedAt: iso(row.updatedAt)!,
  }
}

function allocationDto(row: AllocationRow) {
  return {
    id: row.id,
    seasonId: row.seasonId,
    scorerUserId: row.scorerUserId,
    amount: row.amount,
    usedAmount: row.usedAmount,
    remaining: row.amount - row.usedAmount,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  }
}

function verifierDto(row: VerifierRow) {
  return {
    id: row.id,
    seasonId: row.seasonId,
    userId: row.userId,
    status: row.status,
    grantedBy: row.grantedBy,
    grantedAt: iso(row.grantedAt)!,
    revokedBy: row.revokedBy,
    revokedAt: iso(row.revokedAt),
    revokeReason: row.revokeReason,
  }
}

export class SeasonConfigService {
  private access: BoomlandAccessService
  private users: UserProfileService

  constructor(private db: Database) {
    this.access = new BoomlandAccessService(db)
    this.users = new UserProfileService(db)
  }

  private async getSeason(seasonId: number): Promise<SeasonRow> {
    const rows = await this.db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1)
    if (!rows[0]) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在', 404)
    return rows[0]
  }

  private async getPool(seasonId: number): Promise<PoolRow> {
    const rows = await this.db
      .select()
      .from(seasonPointPools)
      .where(eq(seasonPointPools.seasonId, seasonId))
      .limit(1)
    if (!rows[0]) throw boomlandError('SEASON_NOT_FOUND', '赛季积分池不存在', 404)
    return rows[0]
  }

  async listBudgets(seasonId: number, userId: string) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const rows = await this.db
      .select()
      .from(seasonBudgets)
      .where(eq(seasonBudgets.seasonId, seasonId))
      .orderBy(desc(seasonBudgets.version))
    return { items: rows.map(budgetDto) }
  }

  async addBudget(seasonId: number, userId: string, body: AddBudgetBody) {
    const season = await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (season.status === 'cancelled') {
      throw boomlandError('SEASON_CANCELLED', '已取消的赛季不能修改预算', 409)
    }
    const rows = await this.db
      .select()
      .from(seasonBudgets)
      .where(eq(seasonBudgets.seasonId, seasonId))
      .orderBy(desc(seasonBudgets.version))
      .limit(1)
    const latest = rows[0]
    const active = latest?.status === BudgetStatus.Active ? latest : null
    if (active && body.totalAmount <= active.totalAmount) {
      throw boomlandError('BUDGET_NOT_INCREASING', '新预算必须高于当前生效预算', 409, {
        detail: { current: active.totalAmount, next: body.totalAmount },
      })
    }
    const nextVersion = (latest?.version ?? 0) + 1
    const id = await this.db.transaction(async (tx) => {
      await tx
        .update(seasonBudgets)
        .set({ status: BudgetStatus.Superseded })
        .where(and(eq(seasonBudgets.seasonId, seasonId), eq(seasonBudgets.status, BudgetStatus.Active)))
      const [result] = await tx.insert(seasonBudgets).values({
        seasonId,
        version: nextVersion,
        totalAmount: body.totalAmount,
        status: BudgetStatus.Active,
        reason: body.reason.trim(),
        createdBy: userId,
      })
      await writeAudit(tx, {
        seasonId,
        actorUserId: userId,
        action: 'budget.added',
        targetType: 'season_budget',
        targetId: String(result.insertId),
        detail: { old: active?.totalAmount ?? null, next: body.totalAmount, version: nextVersion },
      })
      return result.insertId
    })
    const created = await this.db.select().from(seasonBudgets).where(eq(seasonBudgets.id, id)).limit(1)
    return budgetDto(created[0]!)
  }

  async getPointPool(seasonId: number, userId: string) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    return poolDto(await this.getPool(seasonId))
  }

  async addPoints(seasonId: number, userId: string, addPoints: number) {
    const season = await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (season.status === 'cancelled') {
      throw boomlandError('SEASON_CANCELLED', '已取消的赛季不能修改积分池', 409)
    }
    const pool = await this.getPool(seasonId)
    if (pool.status !== PointPoolStatus.Active) {
      throw boomlandError('POOL_CLOSED', '积分池已关闭', 409)
    }
    await this.db
      .update(seasonPointPools)
      .set({
        totalPoints: pool.totalPoints + addPoints,
        version: pool.version + 1,
      })
      .where(eq(seasonPointPools.id, pool.id))
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'point_pool.added',
      targetType: 'season_point_pool',
      targetId: String(pool.id),
      detail: { old: pool.totalPoints, next: pool.totalPoints + addPoints, addPoints },
    })
    return poolDto(await this.getPool(seasonId))
  }

  async listAllocations(seasonId: number, userId: string) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const rows = await this.db
      .select()
      .from(pointAllocations)
      .where(eq(pointAllocations.seasonId, seasonId))
      .orderBy(desc(pointAllocations.createdAt))
    return { items: rows.map(allocationDto) }
  }

  async createAllocation(seasonId: number, userId: string, body: CreateAllocationBody) {
    const season = await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (season.status === 'cancelled') {
      throw boomlandError('SEASON_CANCELLED', '已取消的赛季不能分配积分', 409)
    }
    if (!(await this.users.exists(body.scorerUserId))) {
      throw boomlandError('USER_NOT_FOUND', '评委用户不存在', 404, { field: 'scorerUserId' })
    }
    const pool = await this.getPool(seasonId)
    if (pool.status !== PointPoolStatus.Active) {
      throw boomlandError('POOL_CLOSED', '积分池已关闭', 409)
    }
    const existingRows = await this.db
      .select()
      .from(pointAllocations)
      .where(
        and(
          eq(pointAllocations.seasonId, seasonId),
          eq(pointAllocations.scorerUserId, body.scorerUserId),
        ),
      )
      .limit(1)
    const existing = existingRows[0] ?? null
    if (existing?.status === PointAllocationStatus.Active) {
      throw boomlandError('ALLOCATION_EXISTS', '该评委已有生效中的积分分配', 409)
    }
    if (pool.allocatedPoints + body.amount > pool.totalPoints) {
      throw boomlandError('POOL_EXCEEDED', '分配额度超过积分池总量', 409, {
        detail: {
          totalPoints: pool.totalPoints,
          allocatedPoints: pool.allocatedPoints,
          requested: body.amount,
        },
      })
    }
    const id = await this.db.transaction(async (tx) => {
      let allocationId: number
      if (existing) {
        await tx
          .update(pointAllocations)
          .set({
            amount: body.amount,
            usedAmount: 0,
            status: PointAllocationStatus.Active,
            createdBy: userId,
          })
          .where(eq(pointAllocations.id, existing.id))
        allocationId = existing.id
      } else {
        const [result] = await tx.insert(pointAllocations).values({
          seasonId,
          poolId: pool.id,
          scorerUserId: body.scorerUserId,
          amount: body.amount,
          usedAmount: 0,
          status: PointAllocationStatus.Active,
          createdBy: userId,
        })
        allocationId = result.insertId
      }
      await tx
        .update(seasonPointPools)
        .set({ allocatedPoints: pool.allocatedPoints + body.amount })
        .where(eq(seasonPointPools.id, pool.id))
      await writeAudit(tx, {
        seasonId,
        actorUserId: userId,
        action: 'allocation.assigned',
        targetType: 'point_allocation',
        targetId: String(allocationId),
        detail: { scorerUserId: body.scorerUserId, amount: body.amount, reused: Boolean(existing) },
      })
      return allocationId
    })
    const created = await this.db
      .select()
      .from(pointAllocations)
      .where(eq(pointAllocations.id, id))
      .limit(1)
    return allocationDto(created[0]!)
  }

  async reclaimAllocation(seasonId: number, allocationId: number, userId: string, reason: string) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const rows = await this.db
      .select()
      .from(pointAllocations)
      .where(and(eq(pointAllocations.id, allocationId), eq(pointAllocations.seasonId, seasonId)))
      .limit(1)
    const row = rows[0]
    if (!row) throw boomlandError('ALLOCATION_NOT_FOUND', '积分分配不存在', 404)
    if (row.status !== PointAllocationStatus.Active) {
      throw boomlandError('ALLOCATION_ALREADY_RECLAIMED', '该分配已回收', 409)
    }
    const pool = await this.getPool(seasonId)
    const release = row.amount - row.usedAmount
    await this.db.transaction(async (tx) => {
      await tx
        .update(pointAllocations)
        .set({ status: PointAllocationStatus.Reclaimed })
        .where(eq(pointAllocations.id, allocationId))
      await tx
        .update(seasonPointPools)
        .set({ allocatedPoints: Math.max(0, pool.allocatedPoints - release) })
        .where(eq(seasonPointPools.id, pool.id))
      await writeAudit(tx, {
        seasonId,
        actorUserId: userId,
        action: 'allocation.reclaimed',
        targetType: 'point_allocation',
        targetId: String(allocationId),
        detail: { reason, released: release },
      })
    })
    const updated = await this.db
      .select()
      .from(pointAllocations)
      .where(eq(pointAllocations.id, allocationId))
      .limit(1)
    return allocationDto(updated[0]!)
  }

  async listVerifiers(seasonId: number, userId: string) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const rows = await this.db
      .select()
      .from(seasonVerifierGrants)
      .where(eq(seasonVerifierGrants.seasonId, seasonId))
      .orderBy(desc(seasonVerifierGrants.createdAt))
    return { items: rows.map(verifierDto) }
  }

  async grantVerifier(seasonId: number, userId: string, targetUserId: string) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (!(await this.users.exists(targetUserId))) {
      throw boomlandError('USER_NOT_FOUND', '核验员用户不存在', 404, { field: 'userId' })
    }
    const rows = await this.db
      .select()
      .from(seasonVerifierGrants)
      .where(
        and(
          eq(seasonVerifierGrants.seasonId, seasonId),
          eq(seasonVerifierGrants.userId, targetUserId),
        ),
      )
      .limit(1)
    const existing = rows[0]
    if (existing?.status === VerifierGrantStatus.Active) {
      throw boomlandError('VERIFIER_ALREADY_ACTIVE', '该用户已是生效中的核验员', 409)
    }
    let grantId: number
    if (existing) {
      await this.db
        .update(seasonVerifierGrants)
        .set({
          status: VerifierGrantStatus.Active,
          grantedBy: userId,
          grantedAt: new Date(),
          revokedBy: null,
          revokedAt: null,
          revokeReason: null,
        })
        .where(eq(seasonVerifierGrants.id, existing.id))
      grantId = existing.id
    } else {
      const [result] = await this.db.insert(seasonVerifierGrants).values({
        seasonId,
        userId: targetUserId,
        status: VerifierGrantStatus.Active,
        grantedBy: userId,
      })
      grantId = result.insertId
    }
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'verifier.granted',
      targetType: 'season_verifier_grant',
      targetId: String(grantId),
      detail: { userId: targetUserId, reused: Boolean(existing) },
    })
    const created = await this.db
      .select()
      .from(seasonVerifierGrants)
      .where(eq(seasonVerifierGrants.id, grantId))
      .limit(1)
    return verifierDto(created[0]!)
  }

  async revokeVerifier(seasonId: number, userId: string, targetUserId: string, reason: string) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const rows = await this.db
      .select()
      .from(seasonVerifierGrants)
      .where(
        and(
          eq(seasonVerifierGrants.seasonId, seasonId),
          eq(seasonVerifierGrants.userId, targetUserId),
        ),
      )
      .limit(1)
    const existing = rows[0]
    if (!existing || existing.status !== VerifierGrantStatus.Active) {
      throw boomlandError('VERIFIER_ALREADY_REVOKED', '该用户不是生效中的核验员', 409)
    }
    await this.db
      .update(seasonVerifierGrants)
      .set({
        status: VerifierGrantStatus.Revoked,
        revokedBy: userId,
        revokedAt: new Date(),
        revokeReason: reason.trim(),
      })
      .where(eq(seasonVerifierGrants.id, existing.id))
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'verifier.revoked',
      targetType: 'season_verifier_grant',
      targetId: String(existing.id),
      detail: { userId: targetUserId, reason },
    })
    const updated = await this.db
      .select()
      .from(seasonVerifierGrants)
      .where(eq(seasonVerifierGrants.id, existing.id))
      .limit(1)
    return verifierDto(updated[0]!)
  }
}
