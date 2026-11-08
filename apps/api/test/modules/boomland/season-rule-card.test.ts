import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, inArray, sql } from 'drizzle-orm'
import {
  Role,
  SEASON_RULE_CARD_SCORELESS,
  SEASON_REQUIRED_RULE_CARD_KEYS,
} from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  organizerOrgMembers,
  organizerOrgs,
  seasonAnnouncements,
  seasonOrganizers,
  seasonRuleCardItems,
  seasonPointPools,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

const OPERATOR = '960001'
const userIds = [OPERATOR]

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

const code = `RC${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

type RuleCardItem = {
  key: string
  label: string
  value: string
  required: boolean
  visible: boolean
  sortOrder: number
}

describe('BoomLand rule card derived from season config', () => {
  const userIdentity = new UserIdentityService(db)
  let token: string
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

  async function ruleCard(): Promise<RuleCardItem[]> {
    const res = await call('GET', `/seasons/${seasonId}/manage`)
    expect(res.status).toBe(200)
    return ((await res.json()) as { ruleCard: RuleCardItem[] }).ruleCard
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    token = await signToken({ user_id: OPERATOR })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
    const orgRes = await call('POST', '/admin/organizer-orgs', { name: `规则卡主办方 ${code}` })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    const created = await call('POST', '/seasons', {
      code,
      name: `规则卡赛季 ${code}`,
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

  it('seeds exactly the eight required items from the season config', async () => {
    const items = await ruleCard()
    expect(items.map((item) => item.key)).toEqual([...SEASON_REQUIRED_RULE_CARD_KEYS])
    expect(items.every((item) => item.required && item.visible)).toBe(true)
    const singleCap = items.find((item) => item.key === 'single_work_cap')
    expect(singleCap?.value).toBe(SEASON_RULE_CARD_SCORELESS)
  })

  it('ignores client-supplied label/value/visible for required items but honours order', async () => {
    const items = await ruleCard()
    const reversed = [...items].reverse().map((item) => ({
      key: item.key,
      label: '客户端伪造的名称',
      value: '客户端伪造的内容',
      visible: false,
    }))
    const res = await call('PUT', `/seasons/${seasonId}/rule-card`, { items: reversed })
    expect(res.status).toBe(200)
    const written = ((await res.json()) as { items: RuleCardItem[] }).items

    // 顺序被采纳（倒序），但文案与 required/visible 仍是生成值
    expect(written.map((item) => item.key)).toEqual([...items].reverse().map((item) => item.key))
    for (const item of written) {
      expect(item.label).not.toBe('客户端伪造的名称')
      expect(item.value).not.toBe('客户端伪造的内容')
      expect(item.required).toBe(true)
      expect(item.visible).toBe(true)
    }
    expect(written.map((item) => item.sortOrder)).toEqual(written.map((_, index) => index))
  })

  it('rejects a payload that drops a required key', async () => {
    const items = await ruleCard()
    const missing = items.filter((item) => item.key !== 'max_core_members').map((item) => ({
      key: item.key,
      label: item.label,
      value: item.value,
    }))
    const res = await call('PUT', `/seasons/${seasonId}/rule-card`, { items: missing })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string; detail: { missing: string[] } } }
    expect(body.error.code).toBe('RULE_CARD_REQUIRED_ITEM')
    expect(body.error.detail.missing).toEqual(['max_core_members'])
  })

  it('keeps optional items as sent and drops legacy required keys', async () => {
    const items = await ruleCard()
    const payload = [
      ...items.map((item) => ({ key: item.key, label: item.label, value: item.value })),
      { key: 'work_deadline', label: '旧的作品截止', value: '旧值' },
      { key: 'custom_note', label: '自定义条目', value: '自定义内容', visible: true },
    ]
    const res = await call('PUT', `/seasons/${seasonId}/rule-card`, { items: payload })
    expect(res.status).toBe(200)
    const written = ((await res.json()) as { items: RuleCardItem[] }).items
    expect(written.some((item) => item.key === 'work_deadline')).toBe(false)
    const custom = written.find((item) => item.key === 'custom_note')
    expect(custom).toMatchObject({
      label: '自定义条目',
      value: '自定义内容',
      required: false,
      visible: true,
    })
  })

  it('rebuilds required values from the current rules on read', async () => {
    // 直接改库里的规则，再读规则卡：必要条目的文案应立刻跟着变
    await db.update(seasons).set({
      rules: {
        maxChallengesPerProject: 2,
        maxProjectsPerParticipant: 3,
        maxCoreMembers: 2,
        singleWorkCap: 88,
        exchangeRatio: 2,
        reviewThreshold: 66,
        dailyQuotaEnabled: false,
      },
    }).where(eq(seasons.id, seasonId))
    const items = await ruleCard()
    const byKey = new Map(items.map((item) => [item.key, item.value]))
    expect(byKey.get('max_project_challenges')).toContain('1—2')
    expect(byKey.get('max_projects_per_participant')).toContain('3 个项目')
    expect(byKey.get('max_core_members')).toContain('1—2 人')
    expect(byKey.get('single_work_cap')).toBe('单次评分最高 88 分')
    expect(byKey.get('exchange_ratio')).toBe('1 积分可兑换 2 元')
    expect(byKey.get('review_threshold')).toBe('单次评分超过 66 分需大额复核')
    expect(byKey.get('point_pool_and_awards')).toBe('积分池与奖励口径以赛季公告为准')
  })

  it('backfills a missing required row instead of hiding it', async () => {
    await db.delete(seasonRuleCardItems).where(
      eq(seasonRuleCardItems.seasonId, seasonId),
    )
    const items = await ruleCard()
    expect(items.map((item) => item.key)).toEqual([...SEASON_REQUIRED_RULE_CARD_KEYS])
    expect(items.every((item) => item.required)).toBe(true)
  })

  it('exempts budget / point_pool / scorers from readiness when scoreless', async () => {
    await db.update(seasons).set({
      rules: {
        maxChallengesPerProject: 3,
        maxProjectsPerParticipant: 1,
        maxCoreMembers: 3,
        singleWorkCap: null,
        exchangeRatio: null,
        reviewThreshold: null,
        dailyQuotaEnabled: false,
      },
    }).where(eq(seasons.id, seasonId))
    const res = await call('GET', `/seasons/${seasonId}/readiness`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      checks: Array<{ key: string; passed: boolean; detail?: string }>
    }
    for (const key of ['budget', 'point_pool', 'scorers']) {
      const check = body.checks.find((item) => item.key === key)!
      expect(check.passed).toBe(true)
      expect(check.detail).toContain(SEASON_RULE_CARD_SCORELESS)
      expect(check.detail).toContain('免除')
    }
  })

  it('enforces the three checks again once any scoring field is configured', async () => {
    await db.update(seasons).set({
      rules: {
        maxChallengesPerProject: 3,
        maxProjectsPerParticipant: 1,
        maxCoreMembers: 3,
        singleWorkCap: 100,
        exchangeRatio: null,
        reviewThreshold: null,
        dailyQuotaEnabled: false,
      },
    }).where(eq(seasons.id, seasonId))
    const res = await call('GET', `/seasons/${seasonId}/readiness`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      checks: Array<{ key: string; passed: boolean; detail?: string }>
    }
    for (const key of ['budget', 'point_pool', 'scorers']) {
      const check = body.checks.find((item) => item.key === key)!
      expect(check.passed).toBe(false)
      expect(check.detail ?? '').not.toContain('免除')
    }
  })

  it('accepts null for the scoring trio through PUT /rules', async () => {
    const res = await call('PUT', `/seasons/${seasonId}/rules`, {
      rules: {
        maxChallengesPerProject: 3,
        maxProjectsPerParticipant: 1,
        maxCoreMembers: 3,
        singleWorkCap: null,
        exchangeRatio: 0,
        reviewThreshold: null,
        dailyQuotaEnabled: false,
      },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      rules: { singleWorkCap: number | null; exchangeRatio: number | null }
    }
    expect(body.rules.singleWorkCap).toBeNull()
    expect(body.rules.exchangeRatio).toBe(0)
  })
})
