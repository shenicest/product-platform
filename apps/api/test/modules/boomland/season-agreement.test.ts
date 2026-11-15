import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, inArray, sql } from 'drizzle-orm'
import { Role } from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  organizerOrgMembers,
  organizerOrgs,
  seasonOrganizers,
  seasonPointPools,
  seasonRuleCardItems,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

/**
 * 赛季协议正文：
 *   · 创建时随 `POST /seasons` 一起录入；
 *   · 未发布（草稿 / 待批准）可通过 `PUT /seasons/:id/agreement` 修改；
 *   · 批准后锁定，公开详情按原样返回正文；
 *   · 不是本季主办方的账号不能写。
 */
const OPERATOR = '960001'
const ORGANIZER = '960002'
const OUTSIDER = '960003'
const userIds = [OPERATOR, ORGANIZER, OUTSIDER]
const code = `AG${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

describe('Season agreement content', () => {
  const userIdentity = new UserIdentityService(db)
  let operatorToken: string
  let organizerToken: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number

  async function call(
    method: string,
    path: string,
    token: string,
    body?: Record<string, unknown>,
  ) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body ? jsonHeaders(token) : authHeaders(token),
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
    organizerToken = await signToken({ user_id: ORGANIZER })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
  })

  afterAll(async () => {
    if (seasonId) {
      await db.delete(auditLogs).where(eq(auditLogs.seasonId, seasonId))
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
    await db.execute(
      sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id IN (${sql.join(userIds.map((id) => sql`${Number(id)}`), sql`, `)})`,
    )
  })

  it('creates an org and adds the organizer', async () => {
    const created = await call('POST', '/admin/organizer-orgs', operatorToken, {
      name: `协议测试主办方 ${code}`,
    })
    expect(created.status).toBe(200)
    orgId = (await created.json() as { id: number }).id
    const member = await call(
      'POST',
      `/admin/organizer-orgs/${orgId}/members`,
      operatorToken,
      { userId: ORGANIZER },
    )
    expect(member.status).toBe(200)
  })

  it('accepts agreement content when creating a season', async () => {
    const res = await call('POST', '/seasons', organizerToken, {
      code,
      name: `协议测试赛季 ${code}`,
      themes: ['储能'],
      organizerOrgIds: [orgId],
      agreementVersion: 'v1',
      agreementContent: '第一条 参赛资格\n\n第二条 作品要求',
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { id: number; agreementContent: string | null }
    seasonId = body.id
    expect(body.agreementContent).toBe('第一条 参赛资格\n\n第二条 作品要求')
  })

  it('lets the organizer replace the content while the season is a draft', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/agreement`, organizerToken, {
      agreementContent: '  第一条 参赛资格（已更新）\n\n第二条 作品要求  ',
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { agreementContent: string | null }
    expect(body.agreementContent).toBe('第一条 参赛资格（已更新）\n\n第二条 作品要求')
  })

  it('rejects writes from accounts outside the organizer org', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/agreement`, outsiderToken, {
      agreementContent: '越权修改',
    })
    expect(res.status).toBe(403)
  })

  it('still allows edits while awaiting approval, and clears blank content', async () => {
    await db
      .update(seasons)
      .set({ status: 'upcoming', submittedAt: new Date() })
      .where(eq(seasons.id, seasonId))

    // 未批准 = 未发布，仍然可以改。
    const pending = await call('PUT', `/seasons/${seasonId}/agreement`, organizerToken, {
      agreementContent: '待批准时补充的条款',
    })
    expect(pending.status).toBe(200)

    // 空串按「清空」处理，落库为 null。
    const cleared = await call('PUT', `/seasons/${seasonId}/agreement`, organizerToken, {
      agreementContent: '   ',
    })
    expect(cleared.status).toBe(200)
    expect((await cleared.json() as { agreementContent: string | null }).agreementContent).toBeNull()
  })

  it('publishes the content on the public detail after approval', async () => {
    const saved = await call('PUT', `/seasons/${seasonId}/agreement`, organizerToken, {
      agreementContent: '批准前的最终条款',
    })
    expect(saved.status).toBe(200)

    await db
      .update(seasons)
      .set({ approvedAt: new Date(), approvedBy: OPERATOR })
      .where(eq(seasons.id, seasonId))

    const publicRes = await app.handle(new Request(`http://localhost/seasons/${seasonId}`))
    expect(publicRes.status).toBe(200)
    const publicBody = await publicRes.json() as { agreementContent: string | null }
    expect(publicBody.agreementContent).toBe('批准前的最终条款')
  })

  it('locks the content once the season is published', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/agreement`, organizerToken, {
      agreementContent: '发布后的修改',
    })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('SEASON_INVALID_STATUS')
  })
})
