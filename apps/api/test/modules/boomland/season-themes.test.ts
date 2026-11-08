import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { Role } from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  organizerOrgMembers,
  organizerOrgs,
  seasonAnnouncements,
  seasonOrganizers,
  seasonPointPools,
  seasonRuleCardItems,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

const OPERATOR = '970001'
const OUTSIDER = '970002'
const userIds = [OPERATOR, OUTSIDER]

function schedule() {
  const now = Date.now()
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString()
  return {
    applyOpen: iso(-24 * 60 * 60 * 1000),
    applyClose: iso(2 * 24 * 60 * 60 * 1000),
    startAt: iso(3 * 24 * 60 * 60 * 1000),
    teamDeadline: iso(10 * 24 * 60 * 60 * 1000),
    challengeFreezeAt: iso(9 * 24 * 60 * 60 * 1000),
    workDeadline: iso(20 * 24 * 60 * 60 * 1000),
    scoreDeadline: iso(30 * 24 * 60 * 60 * 1000),
    settleDate: iso(40 * 24 * 60 * 60 * 1000),
  }
}

const code = `TH${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

describe('BoomLand season themes', () => {
  const userIdentity = new UserIdentityService(db)
  let operatorToken: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number

  async function call(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    token = operatorToken,
  ) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body ? jsonHeaders(token) : authHeaders(token),
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  }

  async function publicThemes() {
    return app.handle(new Request(`http://localhost/seasons/${seasonId}/themes`))
  }

  async function themes(): Promise<string[]> {
    const res = await call('GET', `/seasons/${seasonId}/themes`)
    expect(res.status).toBe(200)
    return ((await res.json()) as { themes: string[] }).themes
  }

  async function rulesVersion(): Promise<number> {
    const rows = await db.select({ rulesVersion: seasons.rulesVersion })
      .from(seasons).where(eq(seasons.id, seasonId)).limit(1)
    return rows[0]!.rulesVersion
  }

  async function announcements(category: string) {
    return db.select().from(seasonAnnouncements).where(and(
      eq(seasonAnnouncements.seasonId, seasonId),
      eq(seasonAnnouncements.category, category),
    ))
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
    const orgRes = await call('POST', '/admin/organizer-orgs', { name: `主题主办方 ${code}` })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    const created = await call('POST', '/seasons', {
      code,
      name: `主题赛季 ${code}`,
      schedule: schedule(),
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
      themes: ['AI'],
    })
    expect(created.status).toBe(200)
    seasonId = ((await created.json()) as { id: number }).id
  })

  afterAll(async () => {
    if (seasonId) {
      await db.delete(auditLogs).where(eq(auditLogs.seasonId, seasonId))
      await db.delete(seasonAnnouncements).where(eq(seasonAnnouncements.seasonId, seasonId))
      await db.delete(seasonRuleCardItems).where(eq(seasonRuleCardItems.seasonId, seasonId))
      await db.delete(seasonPointPools).where(eq(seasonPointPools.seasonId, seasonId))
      await db.delete(seasonOrganizers).where(eq(seasonOrganizers.seasonId, seasonId))
      await db.delete(seasons).where(eq(seasons.id, seasonId))
    }
    if (orgId) {
      await db.delete(organizerOrgMembers).where(eq(organizerOrgMembers.orgId, orgId))
      await db.delete(organizerOrgs).where(eq(organizerOrgs.id, orgId))
    }
    await db.delete(userIdentities).where(inArray(userIdentities.userId, userIds))
    await db.execute(sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id IN (${sql.join(userIds.map((id) => sql`${Number(id)}`), sql`, `)})`)
  })

  it('hides themes of an unpublished season from the public endpoint', async () => {
    // 与 GET /seasons/:id 同口径：草稿赛季对外就是不存在
    const res = await publicThemes()
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('SEASON_NOT_FOUND')
  })

  it('normalizes themes on write: trims, drops empties, dedupes', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/themes`, {
      themes: ['  AI  ', 'AI', '', '   ', '效率工具'],
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { themes: string[] }).themes).toEqual(['AI', '效率工具'])
    expect(await themes()).toEqual(['AI', '效率工具'])
  })

  it('does not bump rulesVersion while the season is still a draft', async () => {
    // 草稿期的主题迭代没人看过，不占对外可见的版本号
    const before = await rulesVersion()
    const res = await call('PUT', `/seasons/${seasonId}/themes`, { themes: ['AI', '机器人'] })
    expect(res.status).toBe(200)
    expect(await rulesVersion()).toBe(before)
    expect(await announcements('rules')).toHaveLength(0)
  })

  it('rejects more than 20 themes', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/themes`, {
      themes: Array.from({ length: 21 }, (_, index) => `主题${index}`),
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a theme longer than 50 characters', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/themes`, { themes: ['主'.repeat(51)] })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects callers without season access on write', async () => {
    // 读是公开的（与 GET /seasons/:id 同口径），所以这里只验写权限；
    // 未公开赛季的读仍走 404，见上一条用例。
    const get = await call('GET', `/seasons/${seasonId}/themes`, undefined, outsiderToken)
    expect(get.status).toBe(404)

    const put = await call('PUT', `/seasons/${seasonId}/themes`, { themes: ['越权'] }, outsiderToken)
    expect(put.status).toBe(403)
    expect(((await put.json()) as { error: { code: string } }).error.code).toBe('NOT_SEASON_ORGANIZER')
    expect(await themes()).not.toContain('越权')
  })

  it('publishes themes once the season is approved', async () => {
    await db.update(seasons).set({
      status: 'upcoming',
      approvedAt: new Date(),
      approvedBy: OPERATOR,
    }).where(eq(seasons.id, seasonId))
    const res = await publicThemes()
    expect(res.status).toBe(200)
    expect(((await res.json()) as { themes: string[] }).themes).toEqual(['AI', '机器人'])
  })

  it('bumps rulesVersion and announces when an approved season changes themes', async () => {
    const before = await rulesVersion()
    const res = await call('PUT', `/seasons/${seasonId}/themes`, { themes: ['AI', '机器人', '出海'] })
    expect(res.status).toBe(200)
    expect(await rulesVersion()).toBe(before + 1)

    const rules = await announcements('rules')
    expect(rules).toHaveLength(1)
    expect(rules[0]!.title).toBe('赛季主题已更新')
    expect(rules[0]!.content).toContain('出海')
  })

  it('writes an audit entry for every themes update', async () => {
    const rows = await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.seasonId, seasonId),
        eq(auditLogs.action, 'season.themes_updated'),
      ))
      .orderBy(asc(auditLogs.id))
    expect(rows.length).toBeGreaterThanOrEqual(3)
    const latest = rows[rows.length - 1]!
    expect(latest.targetType).toBe('season')
    expect(latest.targetId).toBe(String(seasonId))
    expect(latest.actorUserId).toBe(OPERATOR)
    expect((latest.detail as { after: string[] }).after).toEqual(['AI', '机器人', '出海'])
  })

  it('locks themes once the season is cancelled', async () => {
    await db.update(seasons).set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(seasons.id, seasonId))
    const res = await call('PUT', `/seasons/${seasonId}/themes`, { themes: ['取消后'] })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('SEASON_INVALID_STATUS')
  })
})
