import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { ChallengeStatus, ChallengeType, ProjectStatus, Role } from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  challenges,
  organizerOrgMembers,
  organizerOrgs,
  projects,
  recruitmentApplications,
  recruitmentCards,
  seasonApplications,
  seasonAnnouncements,
  seasonOrganizers,
  seasonParticipants,
  seasonPointPools,
  seasonProjectMembers,
  seasonProjects,
  seasonRuleCardItems,
  seasons,
  userIdentities,
} from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

const OPERATOR = '980001'
const OWNER = '980002'
const RIVAL = '980003'
const SPARE = '980004'
const OUTSIDER = '980005'
const userIds = [OPERATOR, OWNER, RIVAL, SPARE, OUTSIDER]

const PARTICIPANTS = [OWNER, RIVAL, SPARE]

function schedule() {
  const now = Date.now()
  const at = (offsetMs: number) => new Date(now + offsetMs).toISOString()
  return {
    applyOpen: at(-24 * 60 * 60 * 1000),
    applyClose: at(2 * 24 * 60 * 60 * 1000),
    startAt: at(3 * 24 * 60 * 60 * 1000),
    teamDeadline: at(10 * 24 * 60 * 60 * 1000),
    challengeFreezeAt: at(9 * 24 * 60 * 60 * 1000),
    workDeadline: at(20 * 24 * 60 * 60 * 1000),
    scoreDeadline: at(30 * 24 * 60 * 60 * 1000),
    settleDate: at(40 * 24 * 60 * 60 * 1000),
  }
}

const code = `TM${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

describe('BoomLand season team and recruitment', () => {
  const userIdentity = new UserIdentityService(db)
  let operatorToken: string
  let ownerToken: string
  let rivalToken: string
  let spareToken: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number
  let challengeIds: number[] = []
  let draftChallengeId: number
  let createdProjectId: number
  let broughtProjectId: number
  let seasonProjectId: number
  let broughtSeasonProjectId: number
  let cardId: number
  let rivalApplicationId: number
  const projectIds: number[] = []

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

  async function errorCode(res: Response): Promise<string> {
    return ((await res.json()) as { error: { code: string } }).error.code
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
    ownerToken = await signToken({ user_id: OWNER })
    rivalToken = await signToken({ user_id: RIVAL })
    spareToken = await signToken({ user_id: SPARE })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }

    const orgRes = await call('POST', '/admin/organizer-orgs', operatorToken, {
      name: `组队主办方 ${code}`,
    })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    const created = await call('POST', '/seasons', operatorToken, {
      code,
      name: `组队赛季 ${code}`,
      type: 'season',
      themes: ['AI', '效率工具'],
      schedule: schedule(),
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
    })
    expect(created.status).toBe(200)
    seasonId = ((await created.json()) as { id: number }).id

    // 命题不属于本批被测范围，直接落库比走「五件套 + 发布」更直接。
    await db.insert(challenges).values([
      ...Array.from({ length: 4 }, (_, index) => ({
        seasonId,
        title: `已发布命题 ${index + 1}`,
        type: ChallengeType.CommercialValidation,
        capacity: 3,
        status: ChallengeStatus.Published,
        createdBy: OPERATOR,
      })),
      {
        seasonId,
        title: '未发布命题',
        type: ChallengeType.CommercialValidation,
        capacity: 3,
        status: ChallengeStatus.Draft,
        createdBy: OPERATOR,
      },
    ])
    const challengeRows = await db
      .select({ id: challenges.id, status: challenges.status })
      .from(challenges)
      .where(eq(challenges.seasonId, seasonId))
    challengeIds = challengeRows
      .filter((row) => row.status === ChallengeStatus.Published)
      .map((row) => row.id)
      .sort((a, b) => a - b)
    draftChallengeId = challengeRows.find((row) => row.status === ChallengeStatus.Draft)!.id
    expect(challengeIds).toHaveLength(4)

    // 报名窗口要求赛季已批准；这里直接置为 upcoming + approvedAt（同 season-themes 测试）。
    await db.update(seasons).set({
      status: 'upcoming',
      approvedAt: new Date(),
      approvedBy: OPERATOR,
    }).where(eq(seasons.id, seasonId))

    for (const userId of PARTICIPANTS) {
      const token = userId === OWNER ? ownerToken : userId === RIVAL ? rivalToken : spareToken
      const application = await call('POST', `/seasons/${seasonId}/applications`, token, {
        skills: '产品设计',
        experience: '三年 B 端产品经验',
        themes: ['AI'],
        teamIntent: '希望找到工程搭档',
        acceptsSolo: true,
        availability: '周末',
        cityMode: '上海',
        contact: { wechat: `wx-${userId}` },
        agreementVersion: 'v1',
      })
      expect(application.status).toBe(200)
      const applicationId = ((await application.json()) as { id: number }).id
      const accepted = await call(
        'PATCH',
        `/applications/${applicationId}/status`,
        operatorToken,
        { status: 'accepted' },
      )
      expect(accepted.status).toBe(200)
    }

    // 带入模式要有一个本人已有的长期项目（产品共生 projects 行）。
    const [brought] = await db.insert(projects).values({
      userId: RIVAL,
      status: ProjectStatus.Live,
      name: '带入的长期项目',
      tagline: '已在产品共生里上线的项目',
    })
    broughtProjectId = brought.insertId
    projectIds.push(broughtProjectId)
  })

  afterAll(async () => {
    if (seasonId) {
      await db.delete(recruitmentApplications)
      await db.delete(recruitmentCards).where(eq(recruitmentCards.seasonId, seasonId))
      await db.delete(seasonProjectMembers)
      await db.delete(seasonProjects).where(eq(seasonProjects.seasonId, seasonId))
      await db.delete(auditLogs).where(eq(auditLogs.seasonId, seasonId))
      await db.delete(seasonAnnouncements).where(eq(seasonAnnouncements.seasonId, seasonId))
      await db.delete(seasonRuleCardItems).where(eq(seasonRuleCardItems.seasonId, seasonId))
      await db.delete(seasonPointPools).where(eq(seasonPointPools.seasonId, seasonId))
      await db.delete(seasonParticipants).where(eq(seasonParticipants.seasonId, seasonId))
      await db.delete(seasonApplications).where(eq(seasonApplications.seasonId, seasonId))
      await db.delete(challenges).where(eq(challenges.seasonId, seasonId))
      await db.delete(seasonOrganizers).where(eq(seasonOrganizers.seasonId, seasonId))
      await db.delete(seasons).where(eq(seasons.id, seasonId))
    }
    if (projectIds.length > 0) {
      await db.delete(projects).where(inArray(projects.id, projectIds))
    }
    if (orgId) {
      await db.delete(organizerOrgMembers).where(eq(organizerOrgMembers.orgId, orgId))
      await db.delete(organizerOrgs).where(eq(organizerOrgs.id, orgId))
    }
    await db.delete(userIdentities).where(inArray(userIdentities.userId, userIds))
    await db.execute(sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id IN (${sql.join(userIds.map((id) => sql`${Number(id)}`), sql`, `)})`)
  })

  it('creates a project inside the season and blocks a second one for the same participant', async () => {
    const res = await call('POST', `/seasons/${seasonId}/projects`, ownerToken, {
      mode: 'create',
      name: '冷库电费管家',
      tagline: '为中小冷库降低电费',
      themes: ['AI'],
      challengeIds: [challengeIds[0]!, challengeIds[1]!],
    })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      id: number
      projectId: number
      source: string
      name: string
      tagline: string | null
      status: string
      challenges: Array<{ id: number; title: string; selectedCount: number }>
      members: Array<{ userId: string; role: string; status: string; name: string | null }>
    }
    seasonProjectId = body.id
    createdProjectId = body.projectId
    projectIds.push(createdProjectId)
    expect(body.source).toBe('created')
    expect(body.name).toBe('冷库电费管家')
    expect(body.tagline).toBe('为中小冷库降低电费')
    expect(body.status).toBe('published')
    expect(body.challenges.map((challenge) => challenge.id)).toEqual([challengeIds[0]!, challengeIds[1]!])
    expect(body.challenges[0]!.selectedCount).toBe(1)
    expect(body.members).toHaveLength(1)
    expect(body.members[0]).toMatchObject({ userId: OWNER, role: 'owner', status: 'accepted' })

    // 重复发起同一个项目：create 每次都新建 projects 行，所以项目身份只能按
    // 「本人 + 同赛季 + 同名」判定，契约要求的错误码是 SEASON_PROJECT_DUPLICATED。
    const duplicate = await call('POST', `/seasons/${seasonId}/projects`, ownerToken, {
      mode: 'create',
      name: '冷库电费管家',
      challengeIds: [challengeIds[0]!],
    })
    expect(duplicate.status).toBe(409)
    expect(await errorCode(duplicate)).toBe('SEASON_PROJECT_DUPLICATED')

    // 换一个名字就是另一个项目，但每人参与项目数上限（默认 1）仍然拦得住。
    const limit = await call('POST', `/seasons/${seasonId}/projects`, ownerToken, {
      mode: 'create',
      name: '第二个项目',
      challengeIds: [challengeIds[0]!],
    })
    expect(limit.status).toBe(409)
    expect(await errorCode(limit)).toBe('PROJECT_LIMIT_REACHED')
  })

  it('brings an existing project into the season, rejecting others and duplicates', async () => {
    const forbidden = await call('POST', `/seasons/${seasonId}/projects`, ownerToken, {
      mode: 'bring',
      projectId: broughtProjectId,
      themes: [],
      challengeIds: [challengeIds[0]!],
    })
    expect(forbidden.status).toBe(403)
    expect(await errorCode(forbidden)).toBe('FORBIDDEN')

    const brought = await call('POST', `/seasons/${seasonId}/projects`, rivalToken, {
      mode: 'bring',
      projectId: broughtProjectId,
      themes: ['效率工具'],
      challengeIds: [challengeIds[1]!],
    })
    expect(brought.status).toBe(200)
    const body = await brought.json() as {
      id: number
      projectId: number
      source: string
      name: string
    }
    broughtSeasonProjectId = body.id
    expect(body.source).toBe('brought_in')
    expect(body.projectId).toBe(broughtProjectId)
    expect(body.name).toBe('带入的长期项目')

    // 同一项目在同一赛季只有一条关联行：RIVAL 的参与项目数上限也是 1，
    // 但重复登记要在上限之前被识别出来，错误码才能指向真正的问题。
    const duplicate = await call('POST', `/seasons/${seasonId}/projects`, rivalToken, {
      mode: 'bring',
      projectId: broughtProjectId,
      challengeIds: [challengeIds[0]!],
    })
    expect(duplicate.status).toBe(409)
    expect(await errorCode(duplicate)).toBe('SEASON_PROJECT_DUPLICATED')
  })

  it('rejects callers who are not active participants', async () => {
    const res = await call('POST', `/seasons/${seasonId}/projects`, outsiderToken, {
      mode: 'create',
      name: '非选手的项目',
      challengeIds: [challengeIds[0]!],
    })
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('NOT_SEASON_PARTICIPANT')
  })

  it('validates challenge ids against the season rules and publish state', async () => {
    const tooMany = await call('POST', `/seasons/${seasonId}/projects`, spareToken, {
      mode: 'create',
      name: '命题超限的项目',
      challengeIds: challengeIds.slice(0, 4),
    })
    expect(tooMany.status).toBe(400)
    expect(await errorCode(tooMany)).toBe('CHALLENGE_LIMIT_EXCEEDED')

    const unpublished = await call('POST', `/seasons/${seasonId}/projects`, spareToken, {
      mode: 'create',
      name: '未发布命题的项目',
      challengeIds: [draftChallengeId],
    })
    expect(unpublished.status).toBe(400)
    expect(await errorCode(unpublished)).toBe('CHALLENGE_NOT_PUBLISHED')

    const unknownTheme = await call('POST', `/seasons/${seasonId}/projects`, spareToken, {
      mode: 'create',
      name: '越界方向的项目',
      themes: ['不存在的方向'],
      challengeIds: [challengeIds[0]!],
    })
    expect(unknownTheme.status).toBe(400)
    expect(await errorCode(unknownTheme)).toBe('SEASON_THEME_INVALID')
  })

  it('publishes a recruitment card for the project owner only', async () => {
    const forbidden = await call('POST', `/seasons/${seasonId}/recruitment-cards`, rivalToken, {
      seasonProjectId,
      roles: ['前端'],
      description: '需要一名前端，每周 10 小时',
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(forbidden.status).toBe(403)
    expect(await errorCode(forbidden)).toBe('FORBIDDEN')

    const published = await call('POST', `/seasons/${seasonId}/recruitment-cards`, ownerToken, {
      seasonProjectId,
      roles: ['前端', '数据分析'],
      skills: ['小程序', 'Python'],
      description: '要做什么、每周需要投入多少',
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(published.status).toBe(200)
    const body = await published.json() as {
      id: number
      projectName: string
      status: string
      roles: string[]
      applicationCount: number
      creator: { userId: string; name: string | null }
    }
    cardId = body.id
    expect(body.status).toBe('open')
    expect(body.projectName).toBe('冷库电费管家')
    expect(body.roles).toEqual(['前端', '数据分析'])
    expect(body.applicationCount).toBe(0)
    expect(body.creator.userId).toBe(OWNER)

    const second = await call('POST', `/seasons/${seasonId}/recruitment-cards`, ownerToken, {
      seasonProjectId,
      roles: ['设计'],
      description: '再开一张卡',
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    expect(second.status).toBe(409)
    expect(await errorCode(second)).toBe('RECRUITMENT_CARD_EXISTS')
  })

  it('accepts applications once per applicant and refuses them on a closed card', async () => {
    const self = await call('POST', `/recruitment-cards/${cardId}/apply`, ownerToken, {
      message: '我自己加入',
    })
    expect(self.status).toBe(409)
    expect(await errorCode(self)).toBe('SELF_APPLICATION')

    const applied = await call('POST', `/recruitment-cards/${cardId}/apply`, rivalToken, {
      message: '我是谁、能做什么',
    })
    expect(applied.status).toBe(200)
    const body = await applied.json() as {
      id: number
      status: string
      card: { id: number; projectName: string; status: string }
    }
    rivalApplicationId = body.id
    expect(body.status).toBe('pending')
    expect(body.card.projectName).toBe('冷库电费管家')
    expect(body.card.status).toBe('open')

    const duplicate = await call('POST', `/recruitment-cards/${cardId}/apply`, rivalToken, {
      message: '再投一次',
    })
    expect(duplicate.status).toBe(409)
    expect(await errorCode(duplicate)).toBe('RECRUITMENT_APPLICATION_DUPLICATED')

    const mine = await call('GET', `/me/recruitment-applications?seasonId=${seasonId}`, rivalToken)
    expect(mine.status).toBe(200)
    const mineBody = await mine.json() as {
      items: Array<{ id: number; card: { projectName: string } }>
      total: number
    }
    expect(mineBody.total).toBe(1)
    expect(mineBody.items[0]!.card.projectName).toBe('冷库电费管家')

    const closed = await call('PATCH', `/recruitment-cards/${cardId}`, ownerToken, {
      status: 'closed',
    })
    expect(closed.status).toBe(200)
    expect(((await closed.json()) as { status: string }).status).toBe('closed')

    const afterClose = await call('POST', `/recruitment-cards/${cardId}/apply`, spareToken, {
      message: '卡已关闭还想投',
    })
    expect(afterClose.status).toBe(409)
    expect(await errorCode(afterClose)).toBe('RECRUITMENT_CARD_CLOSED')
  })

  it('lets only the card creator decide an application', async () => {
    const forbidden = await call(
      'PATCH',
      `/recruitment-applications/${rivalApplicationId}`,
      rivalToken,
      { status: 'accepted' },
    )
    expect(forbidden.status).toBe(403)
    expect(await errorCode(forbidden)).toBe('FORBIDDEN')

    const accepted = await call(
      'PATCH',
      `/recruitment-applications/${rivalApplicationId}`,
      ownerToken,
      { status: 'accepted' },
    )
    expect(accepted.status).toBe(200)
    const body = await accepted.json() as {
      status: string
      decidedAt: string | null
      applicant: { userId: string }
    }
    expect(body.status).toBe('accepted')
    expect(body.decidedAt).not.toBeNull()
    expect(body.applicant.userId).toBe(RIVAL)

    const received = await call('GET', `/recruitment-cards/${cardId}/applications`, ownerToken)
    expect(received.status).toBe(200)
    const receivedBody = await received.json() as { items: Array<{ id: number; status: string }> }
    expect(receivedBody.items.find((item) => item.id === rivalApplicationId)?.status).toBe('accepted')
  })

  it('aggregates the team workbench for outsiders and participants without a project', async () => {
    const outsider = await call('GET', `/seasons/${seasonId}/team/me`, outsiderToken)
    expect(outsider.status).toBe(200)
    const outsiderBody = await outsider.json() as {
      participant: unknown
      project: unknown
      application: unknown
      stats: { unassignedParticipantCount: number; openRecruitmentCardCount: number }
      rules: { maxCoreMembers: number; maxProjectsPerParticipant: number; teamDeadline: string | null; deadlinePassed: boolean }
    }
    expect(outsiderBody.participant).toBeNull()
    expect(outsiderBody.project).toBeNull()
    expect(outsiderBody.application).toBeNull()

    const spare = await call('GET', `/seasons/${seasonId}/team/me`, spareToken)
    expect(spare.status).toBe(200)
    const spareBody = await spare.json() as {
      participant: { userId: string; status: string; canWithdraw: boolean } | null
      project: unknown
      application: { status: string } | null
      stats: { unassignedParticipantCount: number; openRecruitmentCardCount: number }
      rules: { maxCoreMembers: number; maxProjectsPerParticipant: number; teamDeadline: string | null; deadlinePassed: boolean }
    }
    expect(spareBody.participant).toMatchObject({ userId: SPARE, status: 'active', canWithdraw: true })
    expect(spareBody.project).toBeNull()
    expect(spareBody.application?.status).toBe('accepted')
    // 三名 active 选手，其中 OWNER 与 RIVAL 已有赛季项目 → 只剩 SPARE 未组队。
    expect(spareBody.stats.unassignedParticipantCount).toBe(1)
    // 招募卡已在上一条用例关闭，所以 open 计数为 0。
    expect(spareBody.stats.openRecruitmentCardCount).toBe(0)
    expect(spareBody.rules).toMatchObject({
      maxCoreMembers: 3,
      maxProjectsPerParticipant: 1,
      deadlinePassed: false,
    })
    expect(spareBody.rules.teamDeadline).not.toBeNull()

    // 有项目的选手看到自己的 SeasonProject DTO。
    const owner = await call('GET', `/seasons/${seasonId}/team/me`, ownerToken)
    expect(owner.status).toBe(200)
    const ownerBody = await owner.json() as {
      project: { id: number; name: string; members: Array<{ userId: string }> } | null
      recruitmentCard: { id: number; status: string } | null
      myApplications: unknown[]
    }
    expect(ownerBody.project?.id).toBe(seasonProjectId)
    expect(ownerBody.project?.name).toBe('冷库电费管家')
    expect(ownerBody.project?.members.map((member) => member.userId)).toEqual([OWNER])
    expect(ownerBody.recruitmentCard?.id).toBe(cardId)
    expect(ownerBody.myApplications).toHaveLength(0)
  })

  it('blocks new projects once the team deadline has passed', async () => {
    await db.update(seasons).set({ teamDeadline: new Date(Date.now() - 60_000) })
      .where(eq(seasons.id, seasonId))

    const res = await call('POST', `/seasons/${seasonId}/projects`, spareToken, {
      mode: 'create',
      name: '截止后的项目',
      challengeIds: [challengeIds[0]!],
    })
    expect(res.status).toBe(409)
    expect(await errorCode(res)).toBe('TEAM_DEADLINE_PASSED')

    const workbench = await call('GET', `/seasons/${seasonId}/team/me`, spareToken)
    const body = await workbench.json() as {
      participant: { canWithdraw: boolean }
      rules: { deadlinePassed: boolean }
    }
    expect(body.rules.deadlinePassed).toBe(true)
    expect(body.participant.canWithdraw).toBe(false)
  })
})
