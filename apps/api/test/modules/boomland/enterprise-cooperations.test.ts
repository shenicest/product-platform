import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Role } from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  organizerOrgMembers,
  organizerOrgs,
  seasonEnterpriseCooperations,
  seasonOrganizers,
  seasonPointPools,
  seasonRuleCardItems,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

const OPERATOR = '980001'
const OUTSIDER = '980002'
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

const code = `CP${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

type CooperationDto = {
  id: number
  seasonId: number
  enterpriseName: string
  tier: string
  grade: string | null
  totalAmount: number
  managementFee: number
  prizePoolAmount: number
  dataGrant: string | null
  publicScope: string
  status: string
  sortOrder: number
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    enterpriseName: '示例企业',
    tier: 'cooperation',
    grade: null,
    totalAmount: 100000,
    managementFee: 10000,
    prizePoolAmount: 50000,
    dataGrant: null,
    publicScope: 'anonymous',
    status: 'intent',
    ...overrides,
  }
}

describe('BoomLand season enterprise cooperations', () => {
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

  async function list(): Promise<CooperationDto[]> {
    const res = await call('GET', `/seasons/${seasonId}/cooperations`)
    expect(res.status).toBe(200)
    return ((await res.json()) as { items: CooperationDto[] }).items
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
    const orgRes = await call('POST', '/admin/organizer-orgs', { name: `合作主办方 ${code}` })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    const created = await call('POST', '/seasons', {
      code,
      name: `合作赛季 ${code}`,
      schedule: schedule(),
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
    })
    expect(created.status).toBe(200)
    seasonId = ((await created.json()) as { id: number }).id
  })

  afterAll(async () => {
    if (seasonId) {
      await db.delete(auditLogs).where(eq(auditLogs.seasonId, seasonId))
      await db.delete(seasonEnterpriseCooperations)
        .where(eq(seasonEnterpriseCooperations.seasonId, seasonId))
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

  it('starts with an empty list', async () => {
    expect(await list()).toEqual([])
  })

  it('replaces the whole list and assigns sortOrder from the array index', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [
        item({ enterpriseName: '甲企业', tier: 'co_creation', grade: '金标', status: 'signed', publicScope: 'public' }),
        item({ enterpriseName: '乙企业', tier: 'resource_partner', totalAmount: 0 }),
      ],
    })
    expect(res.status).toBe(200)
    const items = ((await res.json()) as { items: CooperationDto[] }).items
    expect(items.map((row) => row.enterpriseName)).toEqual(['甲企业', '乙企业'])
    expect(items.map((row) => row.sortOrder)).toEqual([0, 1])
    expect(items[0]).toMatchObject({
      seasonId,
      tier: 'co_creation',
      grade: '金标',
      totalAmount: 100000,
      managementFee: 10000,
      prizePoolAmount: 50000,
      publicScope: 'public',
      status: 'signed',
    })
    // 三项金额各自落库，不做派生：管理费不进奖金池
    expect(items[0]!.managementFee).toBe(10000)
    expect(items[0]!.prizePoolAmount).toBe(50000)
  })

  it('replaces rather than appends on a second PUT', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ enterpriseName: '丙企业', tier: 'intent' })],
    })
    expect(res.status).toBe(200)
    const items = await list()
    expect(items).toHaveLength(1)
    expect(items[0]!.enterpriseName).toBe('丙企业')
    expect(items[0]!.sortOrder).toBe(0)
  })

  it('trims the enterprise name and normalizes empty optional fields to null', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ enterpriseName: '  丁企业  ', grade: '  ', dataGrant: '  ' })],
    })
    expect(res.status).toBe(200)
    const items = await list()
    expect(items[0]!.enterpriseName).toBe('丁企业')
    expect(items[0]!.grade).toBeNull()
    expect(items[0]!.dataGrant).toBeNull()
  })

  it('accepts an empty list and clears everything', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, { items: [] })
    expect(res.status).toBe(200)
    expect(await list()).toEqual([])
  })

  it('rejects an unknown tier with the offending field', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ tier: '不存在的档位' })],
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; field: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.field).toBe('items[0].tier')
  })

  it('rejects an unknown status and public scope', async () => {
    const badStatus = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ status: 'archived' })],
    })
    expect(badStatus.status).toBe(400)
    expect(((await badStatus.json()) as { error: { field: string } }).error.field).toBe('items[0].status')

    const badScope = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ publicScope: 'private' })],
    })
    expect(badScope.status).toBe(400)
    expect(((await badScope.json()) as { error: { field: string } }).error.field).toBe('items[0].publicScope')
  })

  it('rejects a blank enterprise name', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ enterpriseName: '   ' })],
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { field: string } }).error.field).toBe('items[0].enterpriseName')
  })

  it('rejects non-integer and out-of-range amounts', async () => {
    for (const field of ['totalAmount', 'managementFee', 'prizePoolAmount'] as const) {
      const decimal = await call('PUT', `/seasons/${seasonId}/cooperations`, {
        items: [item({ [field]: 1.5 })],
      })
      expect(decimal.status).toBe(400)
      expect(((await decimal.json()) as { error: { field: string } }).error.field).toBe(`items[0].${field}`)

      const negative = await call('PUT', `/seasons/${seasonId}/cooperations`, {
        items: [item({ [field]: -1 })],
      })
      expect(negative.status).toBe(400)

      const tooLarge = await call('PUT', `/seasons/${seasonId}/cooperations`, {
        items: [item({ [field]: 100_000_001 })],
      })
      expect(tooLarge.status).toBe(400)
    }
  })

  it('rejects a grade longer than 16 characters', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ grade: '标'.repeat(17) })],
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { field: string } }).error.field).toBe('items[0].grade')
  })

  it('leaves the previous list intact when a later item fails validation', async () => {
    // 整表替换是事务：任何一条不合法都不能让「先删后插」半途落地
    const seed = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ enterpriseName: '保留企业' })],
    })
    expect(seed.status).toBe(200)

    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ enterpriseName: '新企业' }), item({ tier: 'bad' })],
    })
    expect(res.status).toBe(400)
    const items = await list()
    expect(items).toHaveLength(1)
    expect(items[0]!.enterpriseName).toBe('保留企业')
  })

  it('rejects callers without season access', async () => {
    const get = await call('GET', `/seasons/${seasonId}/cooperations`, undefined, outsiderToken)
    expect(get.status).toBe(403)
    expect(((await get.json()) as { error: { code: string } }).error.code).toBe('NOT_SEASON_ORGANIZER')

    const put = await call('PUT', `/seasons/${seasonId}/cooperations`, { items: [] }, outsiderToken)
    expect(put.status).toBe(403)
  })

  it('writes an audit entry for the replacement', async () => {
    const rows = await db.select().from(auditLogs).where(and(
      eq(auditLogs.seasonId, seasonId),
      eq(auditLogs.action, 'season.cooperations_updated'),
    ))
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const latest = rows[rows.length - 1]!
    expect(latest.targetType).toBe('season')
    expect(latest.targetId).toBe(String(seasonId))
    expect(latest.actorUserId).toBe(OPERATOR)
  })

  it('refuses writes once the season is cancelled', async () => {
    await db.update(seasons).set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(seasons.id, seasonId))
    const res = await call('PUT', `/seasons/${seasonId}/cooperations`, {
      items: [item({ enterpriseName: '取消后企业' })],
    })
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('SEASON_INVALID_STATUS')
    // 读仍然可用：台账冻结不等于读不到
    expect((await list()).map((row) => row.enterpriseName)).toEqual(['保留企业'])
  })
})
