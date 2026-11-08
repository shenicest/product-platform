import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, inArray, sql } from 'drizzle-orm'
import {
  CHALLENGE_CAPACITY_LIMITS,
  CHALLENGE_TYPE_LABELS,
  ChallengeType,
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

const OPERATOR = '971001'
const OUTSIDER = '971002'
const userIds = [OPERATOR, OUTSIDER]

const THEMES = ['新型储能基建', '全球 AI 基建']

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

const code = `CF${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

type ChallengeDto = {
  id: number
  seasonId: number
  title: string
  type: string | null
  theme: string | null
  enterpriseName: string | null
  capacity: number | null
  selectedCount: number
  fivePieceComplete: boolean
  missingFields: string[]
  resources: unknown[]
  status: string
  version: number
}

const FIVE_PIECE = {
  realProblem: '园区储能柜装完没人运维，峰谷套利策略也跑不起来。',
  targetCustomer: '长三角制造业园区与工商业业主。',
  minimumDeliverable: '一套跑在真实电表数据上的充放电策略 + 运维告警面板。',
  resourceCommitment: '3 个站点历史数据与 1 名电气工程师对接。',
  resultEvidenceRules: 'R3：连续运行 14 天并出具业主盖章的试用确认。',
}

describe('BoomLand challenge classification fields', () => {
  const userIdentity = new UserIdentityService(db)
  let token: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number

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
    const orgRes = await call('POST', '/admin/organizer-orgs', { name: `命题字段主办方 ${code}` })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    const created = await call('POST', '/seasons', {
      code,
      name: `命题字段赛季 ${code}`,
      themes: THEMES,
      schedule: schedule(),
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
      rules: { singleWorkCap: null, exchangeRatio: null, reviewThreshold: null },
    })
    expect(created.status).toBe(200)
    seasonId = ((await created.json()) as { id: number }).id
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

  it('round-trips type / theme / enterpriseName / capacity on create', async () => {
    const res = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '工商业储能的第一张订单',
      type: ChallengeType.CommercialValidation,
      theme: THEMES[0],
      enterpriseName: '  曜石储能  ',
      capacity: 6,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ChallengeDto
    expect(body.type).toBe(ChallengeType.CommercialValidation)
    expect(body.theme).toBe(THEMES[0])
    // 企业名写入前 trim
    expect(body.enterpriseName).toBe('曜石储能')
    expect(body.capacity).toBe(6)
    // 项目选择命题未实现，已选恒为 0
    expect(body.selectedCount).toBe(0)
    expect(body.resources).toEqual([])
  })

  it('defaults every classification field to null when omitted', async () => {
    const res = await call('POST', `/seasons/${seasonId}/challenges`, { title: '未分类命题' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ChallengeDto
    expect(body.type).toBeNull()
    expect(body.theme).toBeNull()
    expect(body.enterpriseName).toBeNull()
    expect(body.capacity).toBeNull()
  })

  it('rejects an unknown challenge type', async () => {
    const res = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '非法类型命题',
      type: 'not_a_type',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; field?: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.field).toBe('type')
  })

  it('rejects a theme that is not in the season themes', async () => {
    const res = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '主题越界命题',
      theme: '不存在的主题',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; field?: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.field).toBe('theme')

    // 同一份校验在 PATCH 上也生效
    const created = await call('POST', `/seasons/${seasonId}/challenges`, { title: '待改主题命题' })
    const id = ((await created.json()) as ChallengeDto).id
    const patched = await call('PATCH', `/challenges/${id}`, { theme: '不存在的主题' })
    expect(patched.status).toBe(400)
    expect(((await patched.json()) as { error: { field?: string } }).error.field).toBe('theme')
  })

  it('rejects a capacity outside CHALLENGE_CAPACITY_LIMITS or non-integer', async () => {
    const tooSmall = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '容量过小命题',
      capacity: CHALLENGE_CAPACITY_LIMITS.min - 1,
    })
    expect(tooSmall.status).toBe(400)
    expect(((await tooSmall.json()) as { error: { field?: string } }).error.field).toBe('capacity')

    const tooBig = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '容量过大命题',
      capacity: CHALLENGE_CAPACITY_LIMITS.max + 1,
    })
    expect(tooBig.status).toBe(400)
    expect(((await tooBig.json()) as { error: { field?: string } }).error.field).toBe('capacity')

    const fractional = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '容量非整数命题',
      capacity: 3.5,
    })
    expect(fractional.status).toBe(400)
    expect(((await fractional.json()) as { error: { field?: string } }).error.field).toBe('capacity')
  })

  it('clears classification fields with explicit null', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '待清空命题',
      type: ChallengeType.SolutionPoc,
      theme: THEMES[1],
      enterpriseName: '云杉算力',
      capacity: 4,
    })
    const id = ((await created.json()) as ChallengeDto).id
    const cleared = await call('PATCH', `/challenges/${id}`, {
      type: null,
      theme: null,
      enterpriseName: '',
      capacity: null,
    })
    expect(cleared.status).toBe(200)
    const body = (await cleared.json()) as ChallengeDto
    expect(body.type).toBeNull()
    expect(body.theme).toBeNull()
    expect(body.enterpriseName).toBeNull()
    expect(body.capacity).toBeNull()
  })

  it('reports fivePieceComplete and the Chinese labels of missing fields', async () => {
    const draft = await call('POST', `/seasons/${seasonId}/challenges`, { title: '五件套缺失命题' })
    const draftBody = (await draft.json()) as ChallengeDto
    expect(draftBody.fivePieceComplete).toBe(false)
    expect(draftBody.missingFields).toEqual([
      '真实问题',
      '目标客户',
      '最小交付物',
      '资源投入',
      '结果证据规则',
    ])

    const partial = await call('PATCH', `/challenges/${draftBody.id}`, {
      realProblem: FIVE_PIECE.realProblem,
      targetCustomer: FIVE_PIECE.targetCustomer,
    })
    const partialBody = (await partial.json()) as ChallengeDto
    expect(partialBody.fivePieceComplete).toBe(false)
    expect(partialBody.missingFields).toEqual(['最小交付物', '资源投入', '结果证据规则'])

    const complete = await call('PATCH', `/challenges/${draftBody.id}`, FIVE_PIECE)
    const completeBody = (await complete.json()) as ChallengeDto
    expect(completeBody.fivePieceComplete).toBe(true)
    expect(completeBody.missingFields).toEqual([])

    // 列表里同样带这两个派生字段，表格的「五件套」列直接用
    const list = await call('GET', `/seasons/${seasonId}/challenges?includeDrafts=true`)
    const items = ((await list.json()) as { items: ChallengeDto[] }).items
    const listed = items.find((item) => item.id === draftBody.id)!
    expect(listed.fivePieceComplete).toBe(true)
    expect(listed.missingFields).toEqual([])
  })

  it('does not treat classification fields as publish blockers', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '只填五件套的命题',
      ...FIVE_PIECE,
    })
    const id = ((await created.json()) as ChallengeDto).id
    // type / theme / enterpriseName / capacity 全为空，但五件套齐全 → 可以发布
    const published = await call('POST', `/challenges/${id}/publish`)
    expect(published.status).toBe(200)
    const body = (await published.json()) as ChallengeDto
    expect(body.status).toBe('published')
    expect(body.fivePieceComplete).toBe(true)
  })

  it('keeps every challenge type label resolvable from shared', async () => {
    // 前端下拉与后端枚举共用同一份标签，这里确认没有漏项
    for (const type of Object.values(ChallengeType)) {
      expect(typeof CHALLENGE_TYPE_LABELS[type]).toBe('string')
      expect(CHALLENGE_TYPE_LABELS[type].length).toBeGreaterThan(0)
    }
  })

  it('refuses creating a challenge for a season the user does not manage', async () => {
    const res = await callAs(outsiderToken, 'POST', `/seasons/${seasonId}/challenges`, {
      title: '越权命题',
    })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_SEASON_ORGANIZER')
  })
})
