import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, inArray, sql } from 'drizzle-orm'
import { Role } from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  organizerOrgMembers,
  organizerOrgs,
  seasonOrganizers,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

const OPERATOR = '960001'
const OUTSIDER = '960002'
const userIds = [OPERATOR, OUTSIDER]

const code = `AD${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

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

describe('GET /admin/seasons/all', () => {
  const userIdentity = new UserIdentityService(db)
  let operatorToken: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number

  async function call(method: string, path: string, token?: string, body?: Record<string, unknown>) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body ? jsonHeaders(token!) : token ? authHeaders(token) : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
    const org = await call('POST', '/admin/organizer-orgs', operatorToken, { name: `审核列表主办方 ${code}` })
    orgId = ((await org.json()) as { id: number }).id
    const season = await call('POST', '/seasons', operatorToken, {
      code,
      name: `审核视图赛季 ${code}`,
      type: 'season',
      themes: ['AI'],
      organizerOrgIds: [orgId],
    })
    seasonId = ((await season.json()) as { id: number }).id
  })

  afterAll(async () => {
    if (seasonId) {
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

  it('requires authentication', async () => {
    const res = await call('GET', '/admin/seasons/all')
    expect(res.status).toBe(401)
  })

  it('lists every season for a moderator picker, not just the caller’s orgs', async () => {
    // OUTSIDER 不属于任何主办方组织，这是选择器和 /organizer/seasons 的关键差别。
    const res = await call('GET', '/admin/seasons/all?pageSize=100', outsiderToken)
    expect(res.status).toBe(200)
    const body = await res.json() as {
      items: Array<{ id: number; code: string; name: string; status: string; pendingApproval: boolean }>
      total: number
    }
    const created = body.items.find((item) => item.id === seasonId)
    expect(created).toMatchObject({ code, status: 'draft', pendingApproval: false })
  })

  it('keeps drafts visible to moderators while excluding them from the public list', async () => {
    const moderation = await call('GET', '/admin/seasons/all?pageSize=100', operatorToken)
    const moderationBody = await moderation.json() as { items: Array<{ id: number }> }
    expect(moderationBody.items.some((item) => item.id === seasonId)).toBe(true)

    const publicList = await call('GET', `/seasons?q=${code}`)
    const publicBody = await publicList.json() as { items: Array<{ id: number }> }
    expect(publicBody.items.some((item) => item.id === seasonId)).toBe(false)
  })

  it('filters by status', async () => {
    const drafts = await call('GET', '/admin/seasons/all?status=draft&pageSize=100', operatorToken)
    const draftsBody = await drafts.json() as { items: Array<{ id: number; status: string }> }
    expect(draftsBody.items.every((item) => item.status === 'draft')).toBe(true)
    expect(draftsBody.items.some((item) => item.id === seasonId)).toBe(true)

    const active = await call('GET', '/admin/seasons/all?status=active&pageSize=100', operatorToken)
    const activeBody = await active.json() as { items: Array<{ id: number }> }
    expect(activeBody.items.some((item) => item.id === seasonId)).toBe(false)
  })

  it('surfaces the agreement version on the manage detail', async () => {
    const res = await call('GET', `/seasons/${seasonId}/manage`, operatorToken)
    expect(res.status).toBe(200)
    const body = await res.json() as { agreementVersion: string; rules: Record<string, unknown> }
    expect(body.agreementVersion).toBe('v1')
    expect(body.rules).toHaveProperty('maxChallengesPerProject')
  })
})
