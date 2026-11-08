import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, inArray, sql } from 'drizzle-orm'
import {
  CHALLENGE_RESOURCE_KINDS,
  ChallengeResourceStatus,
  MAX_CHALLENGE_RESOURCES,
  Role,
} from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  challengeResources,
  challenges,
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

const code = `CR${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

type ResourceDto = {
  id: number
  challengeId: number
  kind: string
  title: string
  quantity: string | null
  conditions: string | null
  owner: string | null
  status: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

describe('BoomLand challenge resources', () => {
  const userIdentity = new UserIdentityService(db)
  let token: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number
  let challengeId: number
  let closedChallengeId: number

  async function call(method: string, path: string, body?: Record<string, unknown>) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body ? jsonHeaders(token) : authHeaders(token),
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  }

  async function callAs(actorToken: string, method: string, path: string, body?: Record<string, unknown>) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body ? jsonHeaders(actorToken) : authHeaders(actorToken),
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    token = await signToken({ user_id: OPERATOR })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
    const orgRes = await call('POST', '/admin/organizer-orgs', { name: `资源清单主办方 ${code}` })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    const created = await call('POST', '/seasons', {
      code,
      name: `资源清单赛季 ${code}`,
      themes: ['新型储能基建', '全球 AI 基建'],
      schedule: schedule(),
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
      rules: { singleWorkCap: null, exchangeRatio: null, reviewThreshold: null },
    })
    expect(created.status).toBe(200)
    seasonId = ((await created.json()) as { id: number }).id

    const draft = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '资源清单测试命题',
      theme: '新型储能基建',
    })
    expect(draft.status).toBe(200)
    challengeId = ((await draft.json()) as { id: number }).id

    // 已关闭的命题：先补齐五件套再发布、关闭，用来验证状态锁
    const closed = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '已关闭命题',
      realProblem: '真实问题',
      targetCustomer: '目标客户',
      minimumDeliverable: '最小交付物',
      resourceCommitment: '资源投入',
      resultEvidenceRules: '结果证据规则',
    })
    closedChallengeId = ((await closed.json()) as { id: number }).id
    expect((await call('POST', `/challenges/${closedChallengeId}/publish`)).status).toBe(200)
    expect((await call('POST', `/challenges/${closedChallengeId}/close`)).status).toBe(200)
  })

  afterAll(async () => {
    if (seasonId) {
      const ids = (
        await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.seasonId, seasonId))
      ).map((row) => row.id)
      if (ids.length > 0) {
        await db.delete(challengeResources).where(inArray(challengeResources.challengeId, ids))
      }
      await db.delete(challenges).where(eq(challenges.seasonId, seasonId))
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

  it('replaces the whole resource list and keeps the submitted order', async () => {
    const res = await call('PUT', `/challenges/${challengeId}/resources`, {
      items: [
        {
          kind: 'database',
          title: '3 个站点历史数据',
          quantity: '3 个站点 / 12 个月',
          conditions: '脱敏使用',
          owner: '李二',
        },
        { kind: 'expert_channel', title: '电气工程师对接', status: 'applicable' },
        { kind: 'funding', title: '试点采购预算', quantity: '¥15,000' },
      ],
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: ResourceDto[] }
    expect(body.items.map((item) => item.title)).toEqual([
      '3 个站点历史数据',
      '电气工程师对接',
      '试点采购预算',
    ])
    expect(body.items.map((item) => item.sortOrder)).toEqual([0, 1, 2])
    expect(body.items[0]).toMatchObject({
      challengeId,
      kind: 'database',
      quantity: '3 个站点 / 12 个月',
      conditions: '脱敏使用',
      owner: '李二',
      // 未传 status 时默认「已承诺」
      status: ChallengeResourceStatus.Committed,
    })
    expect(body.items[1].status).toBe(ChallengeResourceStatus.Applicable)
  })

  it('reorders on a second replace instead of appending', async () => {
    const res = await call('PUT', `/challenges/${challengeId}/resources`, {
      items: [
        { kind: 'funding', title: '试点采购预算' },
        { kind: 'database', title: '3 个站点历史数据' },
      ],
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: ResourceDto[] }
    expect(body.items.map((item) => item.title)).toEqual(['试点采购预算', '3 个站点历史数据'])
    expect(body.items.map((item) => item.sortOrder)).toEqual([0, 1])

    // 整表替换语义：旧的第 3 条被删掉，不是追加
    const rows = await db
      .select()
      .from(challengeResources)
      .where(eq(challengeResources.challengeId, challengeId))
    expect(rows).toHaveLength(2)
  })

  it('returns resources on challenge list and detail in one payload', async () => {
    const list = await call('GET', `/seasons/${seasonId}/challenges?includeDrafts=true`)
    expect(list.status).toBe(200)
    const items = ((await list.json()) as {
      items: Array<{ id: number; resources: ResourceDto[] }>
    }).items
    const target = items.find((item) => item.id === challengeId)!
    expect(target.resources.map((resource) => resource.title)).toEqual([
      '试点采购预算',
      '3 个站点历史数据',
    ])

    const detail = await call('GET', `/challenges/${challengeId}`)
    expect(detail.status).toBe(200)
    const detailBody = (await detail.json()) as { resources: ResourceDto[] }
    expect(detailBody.resources).toHaveLength(2)
  })

  it('patches one resource status and writes an audit entry', async () => {
    const list = await call('GET', `/challenges/${challengeId}`)
    const items = ((await list.json()) as { resources: ResourceDto[] }).resources
    const target = items[0]

    const res = await call('PATCH', `/challenges/resources/${target.id}`, {
      status: ChallengeResourceStatus.Provided,
      owner: '王知微',
    })
    expect(res.status).toBe(200)
    const updated = (await res.json()) as ResourceDto
    expect(updated.id).toBe(target.id)
    expect(updated.status).toBe(ChallengeResourceStatus.Provided)
    expect(updated.owner).toBe('王知微')
    // 未提交的字段保持原值
    expect(updated.title).toBe(target.title)

    const audits = await db
      .select({ action: auditLogs.action, detail: auditLogs.detail })
      .from(auditLogs)
      .where(eq(auditLogs.seasonId, seasonId))
    expect(audits.some((row) => row.action === 'challenge.resource_updated')).toBe(true)
    expect(audits.some((row) => row.action === 'challenge.resources_updated')).toBe(true)
  })

  it('rejects an unknown resource kind or status', async () => {
    const badKind = await call('PUT', `/challenges/${challengeId}/resources`, {
      items: [{ kind: 'not_a_kind', title: '资源' }],
    })
    expect(badKind.status).toBe(400)
    const badKindBody = (await badKind.json()) as { error: { code: string; field?: string } }
    expect(badKindBody.error.code).toBe('VALIDATION_ERROR')
    expect(badKindBody.error.field).toBe('kind')

    const badStatus = await call('PUT', `/challenges/${challengeId}/resources`, {
      items: [{ kind: 'funding', title: '资源', status: 'not_a_status' }],
    })
    expect(badStatus.status).toBe(400)
    const badStatusBody = (await badStatus.json()) as { error: { code: string; field?: string } }
    expect(badStatusBody.error.code).toBe('VALIDATION_ERROR')
    expect(badStatusBody.error.field).toBe('status')
  })

  it('caps the resource list at MAX_CHALLENGE_RESOURCES', async () => {
    const tooMany = Array.from({ length: MAX_CHALLENGE_RESOURCES + 1 }, (_, index) => ({
      kind: CHALLENGE_RESOURCE_KINDS[index % CHALLENGE_RESOURCE_KINDS.length],
      title: `资源 ${index + 1}`,
    }))
    const res = await call('PUT', `/challenges/${challengeId}/resources`, { items: tooMany })
    expect(res.status).toBe(400)
    const body = (await res.json()) as {
      error: { code: string; field?: string; detail?: { max: number } }
    }
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.field).toBe('items')
    expect(body.error.detail?.max).toBe(MAX_CHALLENGE_RESOURCES)

    // 恰好等于上限要放行
    const exact = await call('PUT', `/challenges/${challengeId}/resources`, {
      items: tooMany.slice(0, MAX_CHALLENGE_RESOURCES),
    })
    expect(exact.status).toBe(200)
    expect(((await exact.json()) as { items: ResourceDto[] }).items).toHaveLength(MAX_CHALLENGE_RESOURCES)
  })

  it('locks the resource list of a closed challenge', async () => {
    const replace = await call('PUT', `/challenges/${closedChallengeId}/resources`, {
      items: [{ kind: 'funding', title: '关闭后追加的资源' }],
    })
    expect(replace.status).toBe(409)
    expect(((await replace.json()) as { error: { code: string } }).error.code).toBe('CHALLENGE_STATUS_LOCKED')

    // 先给一个开放命题写入资源，再验证关闭后的单条更新同样被拒
    const seeded = await call('PUT', `/challenges/${challengeId}/resources`, {
      items: [{ kind: 'database', title: '待锁定资源' }],
    })
    const resourceId = ((await seeded.json()) as { items: ResourceDto[] }).items[0].id
    const patched = await call('PATCH', `/challenges/resources/${resourceId}`, {
      status: ChallengeResourceStatus.Used,
    })
    expect(patched.status).toBe(200)
  })

  it('returns 404 for an unknown resource id', async () => {
    const res = await call('PATCH', '/challenges/resources/999999', {
      status: ChallengeResourceStatus.Provided,
    })
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'CHALLENGE_RESOURCE_NOT_FOUND',
    )
  })

  it('refuses resource writes from a user who is not a season organizer', async () => {
    const replace = await callAs(outsiderToken, 'PUT', `/challenges/${challengeId}/resources`, {
      items: [{ kind: 'funding', title: '越权资源' }],
    })
    expect(replace.status).toBe(403)
    expect(((await replace.json()) as { error: { code: string } }).error.code).toBe('NOT_SEASON_ORGANIZER')

    const list = await call('GET', `/challenges/${challengeId}`)
    const resourceId = ((await list.json()) as { resources: ResourceDto[] }).resources[0].id
    const patch = await callAs(outsiderToken, 'PATCH', `/challenges/resources/${resourceId}`, {
      status: ChallengeResourceStatus.Unfulfilled,
    })
    expect(patch.status).toBe(403)
  })
})
