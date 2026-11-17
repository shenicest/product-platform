import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { SEASON_RULE_DEFAULTS, SeasonApplicationStatus, SeasonStatus } from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  seasonApplications,
  seasonParticipants,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

/**
 * 报名接口的服务端准入。
 *
 * 报名能不能提交**只**由服务端判定：赛季已批准、状态为 upcoming/active、
 * 当前时间在报名窗口内、本人没报过、且还不是本赛季选手。前端隐藏按钮只是
 * 体验，不是门槛 —— 这里全部绕过前端直接打接口。
 *
 * 另一条规则同表：微信号与手机号至少填一项，两项都空（含整个 contact 缺席）
 * 一律 400 CONTACT_REQUIRED —— 联系方式是主办方拉群的唯一依据。
 */

const ORGANIZER = '960001'
const APPLICANT = '960002'
const PARTICIPANT = '960003'
const WITHDRAWN = '960004'
const userIds = [ORGANIZER, APPLICANT, PARTICIPANT, WITHDRAWN]

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const runTag = Date.now().toString(36).toUpperCase()

function minutes(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs)
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    skills: '储能 BMS 固件',
    experience: '三年 B 端产品经验',
    themes: ['AI'],
    teamIntent: '希望找到工程搭档',
    acceptsSolo: true,
    availability: '每周 15 小时',
    cityMode: '上海',
    contact: { wechat: 'wx_gate' },
    agreementVersion: 'v1',
    ...overrides,
  }
}

describe('BoomLand application gate · server-side admission', () => {
  const seasonIds: number[] = []
  let applicantToken: string
  let participantToken: string
  let withdrawnToken: string
  let activeSeasonId: number
  let pendingSeasonId: number
  let suspendedSeasonId: number

  async function call(
    method: string,
    path: string,
    token: string,
    payload?: Record<string, unknown>,
  ) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: payload ? jsonHeaders(token) : authHeaders(token),
        body: payload ? JSON.stringify(payload) : undefined,
      }),
    )
  }

  async function errorCode(res: Response): Promise<string> {
    const payload = (await res.json()) as { error: { code: string } }
    return payload.error.code
  }

  /** 直接落一张赛季行：准入门槛只看这几列，不必走 readiness 那一整套。 */
  async function insertSeason(
    overrides: Partial<typeof seasons.$inferInsert> & { code: string },
  ): Promise<number> {
    const [result] = await db.insert(seasons).values({
      name: `报名门槛 ${overrides.code}`,
      type: 'season',
      themes: ['AI'],
      applyOpen: minutes(-HOUR),
      applyClose: minutes(DAY),
      rules: SEASON_RULE_DEFAULTS,
      createdBy: ORGANIZER,
      ...overrides,
    })
    seasonIds.push(result.insertId)
    return result.insertId
  }

  beforeAll(async () => {
    applicantToken = await signToken({ user_id: APPLICANT })
    participantToken = await signToken({ user_id: PARTICIPANT })
    withdrawnToken = await signToken({ user_id: WITHDRAWN })

    // 已批准 + active + 窗口内：唯一能真正提交的一组。
    activeSeasonId = await insertSeason({
      code: `GATE-OPEN-${runTag}`,
      status: SeasonStatus.Active,
      approvedAt: minutes(-2 * DAY),
      approvedBy: ORGANIZER,
      startedAt: minutes(-DAY),
      awardingEntity: '测试授奖主体',
    })

    // 同一时刻但未批准：不是「即将开始（已批准）」。
    pendingSeasonId = await insertSeason({
      code: `GATE-PENDING-${runTag}`,
      status: SeasonStatus.Upcoming,
    })
  })

  afterAll(async () => {
    if (seasonIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.seasonId, seasonIds))
      await db.delete(seasonParticipants).where(inArray(seasonParticipants.seasonId, seasonIds))
      await db.delete(seasonApplications).where(inArray(seasonApplications.seasonId, seasonIds))
      await db.delete(seasons).where(inArray(seasons.id, seasonIds))
    }
    await db.delete(userIdentities).where(inArray(userIdentities.userId, userIds))
  })

  it('rejects a season that is not approved yet', async () => {
    const res = await call('POST', `/seasons/${pendingSeasonId}/applications`, applicantToken, body())
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('APPLICATION_WINDOW_CLOSED')
  })

  it('rejects a draft season even when its times look open', async () => {
    const draftId = await insertSeason({ code: `GATE-DRAFT-${runTag}`, status: SeasonStatus.Draft })
    const res = await call('POST', `/seasons/${draftId}/applications`, applicantToken, body())
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('APPLICATION_WINDOW_CLOSED')
  })

  it('rejects before the window opens and after it closes', async () => {
    const notOpenId = await insertSeason({
      code: `GATE-NOTOPEN-${runTag}`,
      status: SeasonStatus.Upcoming,
      approvedAt: minutes(-DAY),
      applyOpen: minutes(DAY),
      applyClose: minutes(2 * DAY),
    })
    const early = await call('POST', `/seasons/${notOpenId}/applications`, applicantToken, body())
    expect(early.status).toBe(409)
    expect(await errorCode(early)).toBe('APPLICATION_WINDOW_CLOSED')

    const closedId = await insertSeason({
      code: `GATE-CLOSED-${runTag}`,
      status: SeasonStatus.Upcoming,
      approvedAt: minutes(-DAY),
      applyOpen: minutes(-2 * DAY),
      applyClose: minutes(-DAY),
    })
    const late = await call('POST', `/seasons/${closedId}/applications`, applicantToken, body())
    expect(late.status).toBe(409)
    expect(await errorCode(late)).toBe('APPLICATION_WINDOW_CLOSED')
  })

  it('rejects a suspended season even while the window is open', async () => {
    suspendedSeasonId = await insertSeason({
      code: `GATE-SUSPENDED-${runTag}`,
      status: SeasonStatus.Suspended,
      statusBeforeSuspend: SeasonStatus.Upcoming,
      approvedAt: minutes(-DAY),
      suspendedAt: minutes(-HOUR),
    })
    const res = await call('POST', `/seasons/${suspendedSeasonId}/applications`, applicantToken, body())
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('SEASON_SUSPENDED')
  })

  it('rejects a cancelled season', async () => {
    const cancelledId = await insertSeason({
      code: `GATE-CANCELLED-${runTag}`,
      status: SeasonStatus.Cancelled,
      approvedAt: minutes(-DAY),
      cancelledAt: minutes(-HOUR),
      cancelReason: '测试取消',
    })
    const res = await call('POST', `/seasons/${cancelledId}/applications`, applicantToken, body())
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('SEASON_CANCELLED')
  })

  it('rejects an application when both contact fields are empty', async () => {
    const missing = await call(
      'POST',
      `/seasons/${activeSeasonId}/applications`,
      applicantToken,
      body({ contact: undefined }),
    )
    expect(missing.status).toBe(400)
    const missingPayload = (await missing.json()) as {
      error: { code: string; message: string; field?: string }
    }
    expect(missingPayload.error.code).toBe('CONTACT_REQUIRED')
    expect(missingPayload.error.field).toBe('contact')
    expect(missingPayload.error.message).toContain('微信')

    const blank = await call(
      'POST',
      `/seasons/${activeSeasonId}/applications`,
      applicantToken,
      body({ contact: { wechat: '   ', phone: '  ' } }),
    )
    expect(blank.status).toBe(400)
    expect(await errorCode(blank)).toBe('CONTACT_REQUIRED')

    const emptyObject = await call(
      'POST',
      `/seasons/${activeSeasonId}/applications`,
      applicantToken,
      body({ contact: {} }),
    )
    expect(emptyObject.status).toBe(400)
    expect(await errorCode(emptyObject)).toBe('CONTACT_REQUIRED')
  })

  it('accepts a first application from an approved season inside the window', async () => {
    const res = await call('POST', `/seasons/${activeSeasonId}/applications`, applicantToken, body())
    expect(res.status).toBe(200)
    const created = (await res.json()) as {
      id: number
      status: string
      contact: { wechat?: string; phone?: string }
    }
    expect(created.status).toBe(SeasonApplicationStatus.Submitted)
    expect(created.contact.wechat).toBe('wx_gate')

    // 联系方式不进审计详情 —— 审计是主办方/管理员都能读的面板，不是加密字段。
    const audits = await db
      .select({ detail: auditLogs.detail })
      .from(auditLogs)
      .where(eq(auditLogs.seasonId, activeSeasonId))
    expect(audits.length).toBeGreaterThan(0)
    expect(JSON.stringify(audits)).not.toContain('wx_gate')
  })

  it('rejects a second application from the same user', async () => {
    const res = await call('POST', `/seasons/${activeSeasonId}/applications`, applicantToken, body())
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('APPLICATION_DUPLICATED')
  })

  it('rejects a user who is already a participant of the season', async () => {
    const accepted = await call('POST', `/seasons/${activeSeasonId}/applications`, participantToken, body())
    expect(accepted.status).toBe(200)
    const application = (await accepted.json()) as { id: number }

    await db.insert(seasonParticipants).values({
      seasonId: activeSeasonId,
      userId: PARTICIPANT,
      applicationId: application.id,
      status: 'active',
    })
    // 选手身份在报名之外还有一行记录 —— 就算报名行不在了，也不能再报一次。
    await db.delete(seasonApplications).where(eq(seasonApplications.id, application.id))

    const res = await call('POST', `/seasons/${activeSeasonId}/applications`, participantToken, body())
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('ALREADY_PARTICIPANT')
  })

  it('lets a withdrawn applicant reapply in the window without creating a second row', async () => {
    const first = await call('POST', `/seasons/${activeSeasonId}/applications`, withdrawnToken, body())
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as { id: number }

    const withdrawn = await call('POST', `/applications/${firstBody.id}/withdraw`, withdrawnToken)
    expect(withdrawn.status).toBe(200)

    const again = await call('POST', `/seasons/${activeSeasonId}/applications`, withdrawnToken, body())
    expect(again.status).toBe(200)
    const againBody = (await again.json()) as { id: number; status: string }
    expect(againBody.id).toBe(firstBody.id)
    expect(againBody.status).toBe(SeasonApplicationStatus.Submitted)

    const rows = await db
      .select({ id: seasonApplications.id })
      .from(seasonApplications)
      .where(eq(seasonApplications.seasonId, activeSeasonId))
    expect(rows.filter((row) => row.id === firstBody.id)).toHaveLength(1)
  })

  it('keeps the public application window in sync with what the endpoint accepts', async () => {
    const open = await app.handle(new Request(`http://localhost/seasons/${activeSeasonId}`))
    expect(open.status).toBe(200)
    const openBody = (await open.json()) as { applicationWindow: { isOpen: boolean } }
    expect(openBody.applicationWindow.isOpen).toBe(true)

    // 已批准但暂停：详情可见，窗口必须显示为关闭，与提交被拒一致。
    const suspended = await app.handle(new Request(`http://localhost/seasons/${suspendedSeasonId}`))
    expect(suspended.status).toBe(200)
    const suspendedBody = (await suspended.json()) as { applicationWindow: { isOpen: boolean } }
    expect(suspendedBody.applicationWindow.isOpen).toBe(false)

    // 未批准不公开，公开端统一 404。
    const pending = await app.handle(new Request(`http://localhost/seasons/${pendingSeasonId}`))
    expect(pending.status).toBe(404)
  })
})
