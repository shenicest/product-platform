import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {eq, inArray, sql } from 'drizzle-orm'
import { Role } from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  challenges,
  organizerOrgMembers,
  organizerOrgs,
  pointAllocations,
  seasonAnnouncements,
  seasonApplications,
  seasonBudgets,
  seasonOrganizers,
  seasonParticipants,
  seasonPointPools,
  seasonRuleCardItems,
  seasonVerifierGrants,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

const OPERATOR = '950001'
const ORGANIZER = '950002'
const APPLICANT = '950003'
const APPLICANT_2 = '950004'
const SCORER = '950005'
const VERIFIER = '950006'
const APPLICANT_3 = '950007'
const userIds = [OPERATOR, ORGANIZER, APPLICANT, APPLICANT_2, SCORER, VERIFIER, APPLICANT_3]

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

const code = `BL${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

describe('BoomLand pre-start season flow', () => {
  const userIdentity = new UserIdentityService(db)
  let operatorToken: string
  let organizerToken: string
  let applicantToken: string
  let applicant2Token: string
  let applicant3Token: string
  let orgId: number
  let seasonId: number
  let applicationId: number
  let application2Id: number
  let application3Id: number

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
    applicantToken = await signToken({ user_id: APPLICANT })
    applicant2Token = await signToken({ user_id: APPLICANT_2 })
    applicant3Token = await signToken({ user_id: APPLICANT_3 })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
  })

  afterAll(async () => {
    if (seasonId) {
      await db.delete(auditLogs).where(eq(auditLogs.seasonId, seasonId))
      await db.delete(seasonAnnouncements).where(eq(seasonAnnouncements.seasonId, seasonId))
      await db.delete(seasonRuleCardItems).where(eq(seasonRuleCardItems.seasonId, seasonId))
      await db.delete(pointAllocations).where(eq(pointAllocations.seasonId, seasonId))
      await db.delete(seasonVerifierGrants).where(eq(seasonVerifierGrants.seasonId, seasonId))
      await db.delete(seasonBudgets).where(eq(seasonBudgets.seasonId, seasonId))
      await db.delete(seasonPointPools).where(eq(seasonPointPools.seasonId, seasonId))
      await db.delete(seasonParticipants).where(eq(seasonParticipants.seasonId, seasonId))
      await db.delete(seasonApplications).where(eq(seasonApplications.seasonId, seasonId))
      await db.delete(challenges).where(eq(challenges.seasonId, seasonId))
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

  it('creates an organizer org', async () => {
    const res = await call('POST', '/admin/organizer-orgs', operatorToken, { name: `测试主办方 ${code}` })
    expect(res.status).toBe(200)
    const body = await res.json() as { id: number }
    orgId = body.id
    const member = await call('POST', `/admin/organizer-orgs/${orgId}/members`, operatorToken, { userId: ORGANIZER })
    expect(member.status).toBe(200)
  })

  it('creates a season with schedule, org, and awarding entity', async () => {
    const res = await call('POST', '/seasons', operatorToken, {
      code,
      name: `公开赛季 ${code}`,
      type: 'season',
      themes: ['AI', '效率工具'],
      schedule: schedule(),
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
      participantCapacity: 1,
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { id: number }
    seasonId = body.id
  })

  it('blocks submission until readiness is satisfied', async () => {
    const res = await call('POST', `/seasons/${seasonId}/submit`, operatorToken)
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string; detail: { checks: Array<{ key: string; passed: boolean }> } } }
    expect(body.error.code).toBe('SEASON_NOT_READY')
    expect(body.error.detail.checks.find((check) => check.key === 'challenges')?.passed).toBe(false)
  })

  it('publishes a challenge only when all five fields are present', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, operatorToken, {
      title: '真实问题命题',
    })
    expect(created.status).toBe(200)
    const challenge = await created.json() as { id: number }
    const incomplete = await call('POST', `/challenges/${challenge.id}/publish`, operatorToken)
    expect(incomplete.status).toBe(409)
    expect((await incomplete.json() as { error: { code: string } }).error.code).toBe('CHALLENGE_INCOMPLETE')
    const updated = await call('PATCH', `/challenges/${challenge.id}`, operatorToken, {
      realProblem: '企业知识检索效率低',
      targetCustomer: '中小企业',
      minimumDeliverable: '可运行的知识库问答原型',
      resourceCommitment: '2 名工程师 4 周',
      resultEvidenceRules: '演示视频与用户访谈记录',
    })
    expect(updated.status).toBe(200)
    const published = await call('POST', `/challenges/${challenge.id}/publish`, operatorToken)
    expect(published.status).toBe(200)
  })

  it('configures budget, points, scorer allocation, and verifier', async () => {
    const budget = await call('POST', `/seasons/${seasonId}/budgets`, operatorToken, {
      totalAmount: 100000,
      reason: '初始赛季预算配置',
    })
    expect(budget.status).toBe(200)
    const lowerBudget = await call('POST', `/seasons/${seasonId}/budgets`, operatorToken, {
      totalAmount: 90000,
      reason: '尝试降低总预算',
    })
    expect(lowerBudget.status).toBe(409)

    expect((await call('POST', `/seasons/${seasonId}/point-pool`, operatorToken, { addPoints: 1000 })).status).toBe(200)
    expect((await call('POST', `/seasons/${seasonId}/allocations`, operatorToken, {
      scorerUserId: SCORER,
      amount: 400,
    })).status).toBe(200)
    expect((await call('POST', `/seasons/${seasonId}/allocations`, operatorToken, {
      scorerUserId: SCORER,
      amount: 100,
    })).status).toBe(409)
    expect((await call('POST', `/seasons/${seasonId}/verifiers`, operatorToken, { userId: VERIFIER })).status).toBe(200)
  })

  it('submits and auto-approves the season for an operator', async () => {
    const res = await call('POST', `/seasons/${seasonId}/submit`, operatorToken)
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string; approvedAt: string | null }
    expect(body.status).toBe('upcoming')
    expect(body.approvedAt).not.toBeNull()
    const publicDetail = await app.handle(new Request(`http://localhost/seasons/${seasonId}`))
    expect(publicDetail.status).toBe(200)
  })

  it('refuses to start before startAt', async () => {
    const res = await call('POST', `/seasons/${seasonId}/start`, operatorToken)
    expect(res.status).toBe(409)
    expect((await res.json() as { error: { code: string } }).error.code).toBe('SEASON_NOT_STARTED')
  })

  it('accepts applications only within the themes and agreement version', async () => {
    const invalidTheme = await call('POST', `/seasons/${seasonId}/applications`, applicantToken, {
      skills: '产品设计',
      experience: '三年 B 端产品经验',
      themes: ['不存在的方向'],
      teamIntent: '希望找到工程搭档',
      acceptsSolo: true,
      availability: '周末',
      cityMode: '上海',
      contact: { wechat: 'wx-invalid' },
      agreementVersion: 'v1',
    })
    expect(invalidTheme.status).toBe(400)
    expect((await invalidTheme.json() as { error: { code: string } }).error.code).toBe('APPLICATION_THEME_INVALID')

    const wrongAgreement = await call('POST', `/seasons/${seasonId}/applications`, applicantToken, {
      skills: '产品设计',
      experience: '三年 B 端产品经验',
      themes: ['AI'],
      teamIntent: '希望找到工程搭档',
      acceptsSolo: true,
      availability: '周末',
      cityMode: '上海',
      contact: { wechat: 'wx-invalid' },
      agreementVersion: 'v0',
    })
    expect(wrongAgreement.status).toBe(409)
    expect((await wrongAgreement.json() as { error: { code: string } }).error.code).toBe('AGREEMENT_VERSION_MISMATCH')

    const missingContact = await call('POST', `/seasons/${seasonId}/applications`, applicantToken, {
      skills: '产品设计',
      experience: '三年 B 端产品经验',
      themes: ['AI'],
      teamIntent: '希望找到工程搭档',
      acceptsSolo: true,
      availability: '周末',
      cityMode: '上海',
      contact: {},
      agreementVersion: 'v1',
    })
    expect(missingContact.status).toBe(400)
    expect((await missingContact.json() as { error: { code: string } }).error.code).toBe('CONTACT_REQUIRED')

    const created = await call('POST', `/seasons/${seasonId}/applications`, applicantToken, {
      skills: '产品设计',
      experience: '三年 B 端产品经验',
      themes: ['AI'],
      teamIntent: '希望找到工程搭档',
      acceptsSolo: true,
      availability: '周末',
      cityMode: '上海',
      contact: { wechat: 'wx-applicant', phone: '13800000000' },
      agreementVersion: 'v1',
    })
    expect(created.status).toBe(200)
    const body = await created.json() as { id: number; contact: { wechat: string } }
    applicationId = body.id
    expect(body.contact.wechat).toBe('wx-applicant')

    const duplicate = await call('POST', `/seasons/${seasonId}/applications`, applicantToken, {
      skills: '产品设计',
      experience: '三年 B 端产品经验',
      themes: ['AI'],
      teamIntent: '希望找到工程搭档',
      acceptsSolo: true,
      availability: '周末',
      cityMode: '上海',
      contact: { wechat: 'wx-applicant' },
      agreementVersion: 'v1',
    })
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json() as { error: { code: string } }).error.code).toBe('APPLICATION_DUPLICATED')

    const second = await call('POST', `/seasons/${seasonId}/applications`, applicant2Token, {
      skills: '前端开发',
      experience: '五年 React 经验',
      themes: ['效率工具'],
      teamIntent: '寻找产品合伙人',
      acceptsSolo: false,
      availability: '全职',
      cityMode: '远程',
      contact: { phone: '13900000000' },
      agreementVersion: 'v1',
    })
    expect(second.status).toBe(200)
    application2Id = (await second.json() as { id: number }).id

    const third = await call('POST', `/seasons/${seasonId}/applications`, applicant3Token, {
      skills: '视觉设计',
      experience: '四年品牌与界面设计经验',
      themes: ['AI'],
      teamIntent: '希望加入产品团队',
      acceptsSolo: true,
      availability: '每周 20 小时',
      cityMode: '杭州',
      contact: { wechat: 'wx-third' },
      agreementVersion: 'v1',
    })
    expect(third.status).toBe(200)
    application3Id = (await third.json() as { id: number }).id
  })

  it('shows masked contacts in lists and full contacts in detail', async () => {
    const mine = await call('GET', '/me/applications', applicantToken)
    expect(mine.status).toBe(200)
    const mineBody = await mine.json() as { items: Array<{ application: { id: number; contact: unknown }; wechatStatus: string | null }> }
    expect(mineBody.items.some((item) => item.application.id === applicationId)).toBe(true)

    const list = await call('GET', `/seasons/${seasonId}/applications`, operatorToken)
    expect(list.status).toBe(200)
    const listBody = await list.json() as { items: Array<{ id: number; contact?: unknown; contactMasked: string | null }> }
    const listed = listBody.items.find((item) => item.id === applicationId)!
    expect(listed.contact).toBeUndefined()
    expect(listed.contactMasked).toContain('wx')
    expect(listed.contactMasked).not.toContain('wx-applicant')

    const detail = await call('GET', `/applications/${applicationId}`, operatorToken)
    expect(detail.status).toBe(200)
    const detailBody = await detail.json() as { contact: { wechat: string }; applicant: { userId: string } }
    expect(detailBody.contact.wechat).toBe('wx-applicant')
    expect(detailBody.applicant.userId).toBe(APPLICANT)

    const forbidden = await call('GET', `/applications/${applicationId}`, applicant2Token)
    expect(forbidden.status).toBe(403)
  })

  it('accepts an application, creates a participant, and locks the status', async () => {
    const res = await call('PATCH', `/applications/${applicationId}/status`, operatorToken, {
      status: 'accepted',
    })
    expect(res.status).toBe(200)
    const locked = await call('PATCH', `/applications/${applicationId}/status`, operatorToken, {
      status: 'rejected',
      reason: '不符合要求',
    })
    expect(locked.status).toBe(409)
    expect((await locked.json() as { error: { code: string } }).error.code).toBe('APPLICATION_STATUS_LOCKED')

    const participants = await call('GET', `/seasons/${seasonId}/participants`, operatorToken)
    expect(participants.status).toBe(200)
    const participantsBody = await participants.json() as { items: Array<{ userId: string; wechatStatus: string }> }
    expect(participantsBody.items.find((item) => item.userId === APPLICANT)?.wechatStatus).toBe('not_invited')
  })

  it('allows withdrawing an application before review and reapplying within the window', async () => {
    const withdrawn = await call('POST', `/applications/${application2Id}/withdraw`, applicant2Token)
    expect(withdrawn.status).toBe(200)
    expect((await withdrawn.json() as { status: string }).status).toBe('withdrawn')

    const locked = await call('PATCH', `/applications/${application2Id}/status`, operatorToken, {
      status: 'accepted',
    })
    expect(locked.status).toBe(409)
    expect((await locked.json() as { error: { code: string } }).error.code).toBe('APPLICATION_WITHDRAW_LOCKED')

    const reapply = await call('POST', `/seasons/${seasonId}/applications`, applicant2Token, {
      skills: '前端开发',
      experience: '五年 React 经验，补充了团队协作经历',
      themes: ['效率工具'],
      teamIntent: '寻找产品合伙人',
      acceptsSolo: false,
      availability: '全职',
      cityMode: '远程',
      contact: { phone: '13900000000' },
      agreementVersion: 'v1',
    })
    expect(reapply.status).toBe(200)
    const reapplied = await reapply.json() as { id: number; status: string }
    expect(reapplied.id).toBe(application2Id)
    expect(reapplied.status).toBe('submitted')

    const ownerWithdraw = await call('POST', `/applications/${application2Id}/withdraw`, applicantToken)
    expect(ownerWithdraw.status).toBe(403)
  })

  it('requires a reason when rejecting an application', async () => {
    const noReason = await call('PATCH', `/applications/${application2Id}/status`, operatorToken, {
      status: 'rejected',
    })
    expect(noReason.status).toBe(400)
    const rejected = await call('PATCH', `/applications/${application2Id}/status`, operatorToken, {
      status: 'rejected',
      reason: '本批次方向不匹配',
    })
    expect(rejected.status).toBe(200)
    expect((await rejected.json() as { status: string }).status).toBe('rejected')
  })

  it('waitlists applications beyond capacity and promotes the next one after withdrawal', async () => {
    const waitlisted = await call('PATCH', `/applications/${application3Id}/status`, operatorToken, {
      status: 'accepted',
    })
    expect(waitlisted.status).toBe(200)
    expect((await waitlisted.json() as { status: string }).status).toBe('waitlisted')

    const noConfirm = await call('POST', `/seasons/${seasonId}/participants/${APPLICANT}/withdraw`, applicantToken, {})
    expect(noConfirm.status).toBe(400)

    const withdrawn = await call('POST', `/seasons/${seasonId}/participants/${APPLICANT}/withdraw`, applicantToken, {
      confirm: true,
      reason: '个人时间冲突',
    })
    expect(withdrawn.status).toBe(200)
    expect((await withdrawn.json() as { status: string }).status).toBe('withdrawn')

    const promoted = await call('GET', `/applications/${application3Id}`, operatorToken)
    expect(promoted.status).toBe(200)
    expect((await promoted.json() as { status: string }).status).toBe('accepted')

    const participants = await call('GET', `/seasons/${seasonId}/participants`, operatorToken)
    expect(participants.status).toBe(200)
    const items = (await participants.json() as { items: Array<{ userId: string; status: string }> }).items
    expect(items.find((item) => item.userId === APPLICANT)?.status).toBe('withdrawn')
    expect(items.find((item) => item.userId === APPLICANT_3)?.status).toBe('active')
  })

  it('advances the WeChat state machine for active participants only', async () => {
    const invited = await call('PATCH', `/seasons/${seasonId}/participants/${APPLICANT_3}/wechat`, operatorToken, {
      status: 'invited',
    })
    expect(invited.status).toBe(200)
    const invalidJump = await call('PATCH', `/seasons/${seasonId}/participants/${APPLICANT_3}/wechat`, operatorToken, {
      status: 'not_invited',
    })
    expect(invalidJump.status).toBe(409)
    const joined = await call('PATCH', `/seasons/${seasonId}/participants/${APPLICANT_3}/wechat`, operatorToken, {
      status: 'joined',
    })
    expect(joined.status).toBe(200)
    expect((await joined.json() as { wechatStatus: string }).wechatStatus).toBe('joined')

    const withdrawnBlocked = await call('PATCH', `/seasons/${seasonId}/participants/${APPLICANT}/wechat`, operatorToken, {
      status: 'invited',
    })
    expect(withdrawnBlocked.status).toBe(409)
  })

  it('exposes the contact, review time, and recorder the manual group invite page needs', async () => {
    // 拉群页要拿着微信去加人，所以列表里必须给**未掩码**的联系方式 ——
    // 与 `listSeasonApplications` 的 `contactMasked` 不同，这一份只给
    // 已过 `assertSeasonAccess` 的赛季主办方 / 平台管理员看。
    const list = await call('GET', `/seasons/${seasonId}/participants`, operatorToken)
    expect(list.status).toBe(200)
    const items = (await list.json() as {
      items: Array<{
        userId: string
        contact: { wechat?: string; phone?: string } | null
        reviewedAt: string | null
        wechatInvitedByUser: { userId: string; name: string | null } | null
        wechatInvitedAt: string | null
        wechatStatus: string
      }>
    }).items

    // APPLICANT_3 上面刚被推到 joined：联系方式来自它的报名，审核时间非空，
    // 记录人是点「邀请」的那位操作员。
    const invited = items.find((item) => item.userId === APPLICANT_3)
    expect(invited).toBeDefined()
    expect(invited!.wechatStatus).toBe('joined')
    expect(invited!.contact).toEqual({ wechat: 'wx-third' })
    expect(invited!.reviewedAt).not.toBeNull()
    expect(invited!.wechatInvitedByUser).toMatchObject({ userId: OPERATOR })
    expect(invited!.wechatInvitedAt).not.toBeNull()

    // 从未被邀请过的选手：记录人两个字段都是 null，页面据此显示「—」。
    const neverInvited = items.find((item) => item.userId === APPLICANT)
    expect(neverInvited).toBeDefined()
    expect(neverInvited!.wechatInvitedByUser).toBeNull()
    expect(neverInvited!.wechatInvitedAt).toBeNull()

    // 非主办方读不到这份名单（含联系方式），必须 403。
    const forbidden = await call('GET', `/seasons/${seasonId}/participants`, applicant2Token)
    expect(forbidden.status).toBe(403)
  })

  it('rejects modifying a season after it is cancelled', async () => {
    const cancelled = await call('POST', `/seasons/${seasonId}/cancel`, operatorToken, { reason: '测试取消' })
    expect(cancelled.status).toBe(200)
    const reopen = await call('POST', `/seasons/${seasonId}/start`, operatorToken)
    expect(reopen.status).toBe(409)
  })
})
