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

const OPERATOR = '980001'
const OUTSIDER = '980002'
const userIds = [OPERATOR, OUTSIDER]

const DAY = 24 * 60 * 60 * 1000

/**
 * MySQL `timestamp` 列只有秒精度，写入时会截掉毫秒。
 * 测试里的期望值统一按「现在 + 偏移，向下取整到秒」构造，才能和读回来的值逐字相等。
 */
function at(offsetMs: number): string {
  return new Date(Math.floor((Date.now() + offsetMs) / 1000) * 1000).toISOString()
}

/** 报名开放 / 报名截止已经过去，开赛之后仍在未来。 */
function schedule() {
  return {
    applyOpen: at(-3 * DAY),
    applyClose: at(-2 * DAY),
    startAt: at(2 * DAY),
    teamDeadline: at(10 * DAY),
    challengeFreezeAt: at(9 * DAY),
    workDeadline: at(20 * DAY),
    scoreDeadline: at(30 * DAY),
    settleDate: at(40 * DAY),
  }
}

const code = `SC${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

describe('BoomLand season schedule (incremental)', () => {
  const userIdentity = new UserIdentityService(db)
  let operatorToken: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number
  let created: ReturnType<typeof schedule>

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

  async function managedSchedule(): Promise<Record<string, string>> {
    const res = await call('GET', `/seasons/${seasonId}/manage`)
    expect(res.status).toBe(200)
    return ((await res.json()) as { schedule: Record<string, string> }).schedule
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
    )).orderBy(asc(seasonAnnouncements.id))
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
    const orgRes = await call('POST', '/admin/organizer-orgs', { name: `赛程主办方 ${code}` })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    created = schedule()
    const res = await call('POST', '/seasons', {
      code,
      name: `赛程赛季 ${code}`,
      schedule: created,
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
      themes: ['AI'],
    })
    expect(res.status).toBe(200)
    seasonId = ((await res.json()) as { id: number }).id
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

  it('merges a single changed milestone without touching the rest', async () => {
    const nextScoreDeadline = at(35 * DAY)
    const res = await call('PATCH', `/seasons/${seasonId}/schedule`, {
      schedule: { scoreDeadline: nextScoreDeadline },
    })
    expect(res.status).toBe(200)

    const stored = await managedSchedule()
    expect(stored.scoreDeadline).toBe(nextScoreDeadline)
    // 已过去的节点原样保留，未提交的节点也不变。
    expect(stored.applyOpen).toBe(created.applyOpen)
    expect(stored.applyClose).toBe(created.applyClose)
    expect(stored.settleDate).toBe(created.settleDate)
  })

  it('refuses to modify a milestone that already passed', async () => {
    const res = await call('PATCH', `/seasons/${seasonId}/schedule`, {
      schedule: { applyClose: at(-DAY) },
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string; field: string; message: string } }
    expect(body.error.code).toBe('SCHEDULE_MILESTONE_LOCKED')
    expect(body.error.field).toBe('schedule.applyClose')
    expect(body.error.message).toContain('报名截止已经过去')
  })

  it('accepts a full form submission that repeats the passed milestones', async () => {
    // 老客户端把八个节点整段提交：只改 settleDate，过去的节点原样重复，必须放行。
    const nextSettle = at(45 * DAY)
    const res = await call('PATCH', `/seasons/${seasonId}/schedule`, {
      schedule: { ...(await managedSchedule()), settleDate: nextSettle },
    })
    expect(res.status).toBe(200)
    expect((await managedSchedule()).settleDate).toBe(nextSettle)
  })

  it('does not bump rulesVersion or announce when nothing changed', async () => {
    const before = await rulesVersion()
    const beforeAnnouncements = (await announcements('schedule')).length
    const res = await call('PATCH', `/seasons/${seasonId}/schedule`, {
      schedule: await managedSchedule(),
    })
    expect(res.status).toBe(200)
    expect(await rulesVersion()).toBe(before)
    expect((await announcements('schedule')).length).toBe(beforeAnnouncements)
  })

  it('bumps rulesVersion and announces only the changed milestone once approved', async () => {
    await db.update(seasons).set({
      status: 'upcoming',
      approvedAt: new Date(),
      approvedBy: OPERATOR,
    }).where(eq(seasons.id, seasonId))

    const before = await rulesVersion()
    const nextTeamDeadline = at(12 * DAY)
    const res = await call('PATCH', `/seasons/${seasonId}/schedule`, {
      schedule: { teamDeadline: nextTeamDeadline },
    })
    expect(res.status).toBe(200)
    expect(await rulesVersion()).toBe(before + 1)

    const rows = await announcements('schedule')
    expect(rows.length).toBe(1)
    expect(rows[0]!.title).toBe('赛程已更新')
    expect(rows[0]!.content).toContain('组队截止')
    // 只提改动的节点：没动的节点不该出现在自动摘要里。
    expect(rows[0]!.content).not.toContain('报名开放')
  })

  it('accepts an announcement-only patch without touching the schedule', async () => {
    const before = await rulesVersion()
    const scheduleBefore = await managedSchedule()
    const res = await call('PATCH', `/seasons/${seasonId}/schedule`, {
      announcement: { title: '赛程说明', content: '本次不改时间，仅说明评分安排。' },
    })
    expect(res.status).toBe(200)
    expect(await rulesVersion()).toBe(before)
    expect(await managedSchedule()).toEqual(scheduleBefore)

    const rows = await announcements('schedule')
    expect(rows[rows.length - 1]!.title).toBe('赛程说明')
  })

  it('writes an audit entry that records the changed keys', async () => {
    const rows = await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.seasonId, seasonId),
        eq(auditLogs.action, 'season.schedule_updated'),
      ))
      .orderBy(asc(auditLogs.id))
    expect(rows.length).toBeGreaterThanOrEqual(3)
    const latest = rows[rows.length - 1]!
    expect((latest.detail as { changed: string[] }).changed).toEqual(['teamDeadline'])
  })

  it('rejects callers without season access', async () => {
    const res = await call('PATCH', `/seasons/${seasonId}/schedule`, {
      schedule: { settleDate: at(50 * DAY) },
    }, outsiderToken)
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_SEASON_ORGANIZER')
  })
})
