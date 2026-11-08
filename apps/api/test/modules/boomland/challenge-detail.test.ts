import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  CHALLENGE_CARD_LIMITS,
  CHALLENGE_SCORING_DIMENSIONS,
  CHALLENGE_SCORING_WEIGHT_TOTAL,
  ChallengeScoringDimension,
  ProjectStatus,
  Role,
  SeasonProjectStage,
  SeasonProjectStatus,
} from '@shenicest/shared'
import { app } from '../../../src/app'
import { db } from '../../../src/db'
import {
  auditLogs,
  challengeFollows,
  challengeResources,
  challengeVersions,
  challenges,
  organizerOrgMembers,
  organizerOrgs,
  projects,
  seasonAnnouncements,
  seasonOrganizers,
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

const OPERATOR = '975001'
const OUTSIDER = '975002'
const userIds = [OPERATOR, OUTSIDER]

const THEMES = ['新型储能基建', '全球 AI 基建']

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

const code = `CD${Date.now().toString(36)}`.slice(0, 32).toUpperCase()

type ChallengeDto = {
  id: number
  seasonId: number
  title: string
  selectedCount: number
  status: string
  version: number
  summary: string | null
  background: string | null
  industry: string | null
  scope: string | null
  outOfScope: string | null
  monthlyGoal: string | null
  suggestedSkills: string[]
  teamCapacity: number | null
  ownerName: string | null
  responseSla: string | null
  scoringWeights: Record<string, number> | null
  singleWorkCap: number | null
  rightsPublicScope: string | null
  rightsConfidentiality: string | null
  rightsIp: string | null
  rightsEnterpriseUsage: string | null
  rightsProcurement: string | null
  rightsSpecialTerms: string | null
  rightsExclusivity: string | null
  versions: Array<{ id: number; version: number; note: string; changedBy: string; createdAt: string }>
  projects: Array<{
    seasonProjectId: number
    projectId: number
    name: string
    tagline: string | null
    stage: string
    ownerName: string
  }>
  followCount?: number
  followed?: boolean
  season?: { id: number; code: string; name: string; rules: Record<string, unknown> }
}

type ErrorBody = { error: { code: string; message: string; field?: string } }

const FIVE_PIECE = {
  realProblem: '园区储能柜装完没人运维，峰谷套利策略也跑不起来。',
  targetCustomer: '长三角制造业园区与工商业业主。',
  minimumDeliverable: '一套跑在真实电表数据上的充放电策略 + 运维告警面板。',
  resourceCommitment: '3 个站点历史数据与 1 名电气工程师对接。',
  resultEvidenceRules: 'R3：连续运行 14 天并出具业主盖章的试用确认。',
}

const WEIGHTS = {
  [ChallengeScoringDimension.CommercialResult]: 35,
  [ChallengeScoringDimension.DeliveryQuality]: 25,
  [ChallengeScoringDimension.OriginalMethod]: 15,
  [ChallengeScoringDimension.ActionEvidence]: 15,
  [ChallengeScoringDimension.ReuseValue]: 10,
}

const DETAIL_FIELDS = {
  summary: '谁会为一台 100—200 kWh 的储能柜付第一笔钱？',
  background: '曜石储能今年装了 12 台柜子，缺的是第一笔付费订单。',
  industry: '园区里的中小制造企业、冷库、连锁商超',
  scope: '找到一个真实业主 → 算清账 → 拿到试用或采购承诺。',
  outOfScope: '不做电芯研发，不做电网侧大型储能项目',
  monthlyGoal: '一个月内交付 1 份测算报告 + 1 份业主签字的需求确认单。',
  suggestedSkills: ['销售', '能源测算', '产品'],
  teamCapacity: 6,
  ownerName: '王岚',
  responseSla: '工作日 48 小时内',
  scoringWeights: WEIGHTS,
  singleWorkCap: 300,
  rightsPublicScope: '命题卡内容对外公开，站点原始数据不公开。',
  rightsConfidentiality: '业主身份与合同条款属保密信息。',
  rightsIp: '策略代码归团队所有，出题方获非独占许可。',
  rightsEnterpriseUsage: '出题方可在自有站点内使用，不额外付费。',
  rightsProcurement: '验收通过后优先采购该团队的服务。',
  rightsSpecialTerms: '涉及业主数据须先签保密协议。',
  rightsExclusivity: '不设排他。',
}

describe('BoomLand challenge detail', () => {
  const userIdentity = new UserIdentityService(db)
  let token: string
  let outsiderToken: string
  let orgId: number
  let seasonId: number
  const projectIds: number[] = []

  async function call(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    actorToken?: string,
  ) {
    const useToken = actorToken ?? token
    return app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body ? jsonHeaders(useToken) : authHeaders(useToken),
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  }

  async function errorOf(res: Response): Promise<ErrorBody['error']> {
    return ((await res.json()) as ErrorBody).error
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    token = await signToken({ user_id: OPERATOR })
    outsiderToken = await signToken({ user_id: OUTSIDER })
    for (const userId of userIds) {
      await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${'用户' + userId})
        ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)`)
    }
    const orgRes = await call('POST', '/admin/organizer-orgs', { name: `命题详情主办方 ${code}` })
    expect(orgRes.status).toBe(200)
    orgId = ((await orgRes.json()) as { id: number }).id

    const created = await call('POST', '/seasons', {
      code,
      name: `命题详情赛季 ${code}`,
      themes: THEMES,
      schedule: schedule(),
      organizerOrgIds: [orgId],
      awardingEntity: 'Shenicest',
      rules: { singleWorkCap: null, exchangeRatio: null, reviewThreshold: null },
    })
    expect(created.status).toBe(200)
    seasonId = ((await created.json()) as { id: number }).id

    // 「选择本命题的项目」需要 projects 行；这里直接造 3 条，避免依赖 bun run seed。
    const inserted = await db.insert(projects).values([
      { userId: OPERATOR, status: ProjectStatus.Live, name: '冷库电费管家', tagline: '为中小冷库降低电费' },
      { userId: OUTSIDER, status: ProjectStatus.Live, name: '园区储能共享运维', tagline: '一个团队管十个站' },
      { userId: OPERATOR, status: ProjectStatus.Live, name: '峰谷套利策略库', tagline: '策略即服务' },
    ])
    const firstId = Number(inserted[0].insertId)
    projectIds.push(firstId, firstId + 1, firstId + 2)
  })

  afterAll(async () => {
    if (seasonId) {
      const ids = (
        await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.seasonId, seasonId))
      ).map((row) => row.id)
      if (ids.length > 0) {
        await db.delete(challengeResources).where(inArray(challengeResources.challengeId, ids))
        await db.delete(challengeVersions).where(inArray(challengeVersions.challengeId, ids))
        await db.delete(challengeFollows).where(inArray(challengeFollows.challengeId, ids))
      }
      await db.delete(seasonProjectMembers)
      await db.delete(seasonProjects).where(eq(seasonProjects.seasonId, seasonId))
      await db.delete(challenges).where(eq(challenges.seasonId, seasonId))
      await db.delete(auditLogs).where(eq(auditLogs.seasonId, seasonId))
      await db.delete(seasonAnnouncements).where(eq(seasonAnnouncements.seasonId, seasonId))
      await db.delete(seasonRuleCardItems).where(eq(seasonRuleCardItems.seasonId, seasonId))
      await db.delete(seasonPointPools).where(eq(seasonPointPools.seasonId, seasonId))
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

  it('round-trips every new challenge card field on create and PATCH', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '工商业储能的第一张订单',
      ...FIVE_PIECE,
      ...DETAIL_FIELDS,
      changeNote: '初版命题卡',
    })
    expect(created.status).toBe(200)
    const body = (await created.json()) as ChallengeDto
    expect(body.summary).toBe(DETAIL_FIELDS.summary)
    expect(body.industry).toBe(DETAIL_FIELDS.industry)
    expect(body.outOfScope).toBe(DETAIL_FIELDS.outOfScope)
    expect(body.suggestedSkills).toEqual(DETAIL_FIELDS.suggestedSkills)
    expect(body.teamCapacity).toBe(6)
    expect(body.ownerName).toBe('王岚')
    expect(body.responseSla).toBe('工作日 48 小时内')
    expect(body.scoringWeights).toEqual(WEIGHTS)
    expect(body.singleWorkCap).toBe(300)
    expect(body.rightsIp).toBe(DETAIL_FIELDS.rightsIp)
    expect(body.rightsExclusivity).toBe(DETAIL_FIELDS.rightsExclusivity)

    const patched = await call('PATCH', `/challenges/${body.id}`, {
      summary: '  改过的简介  ',
      teamCapacity: null,
      singleWorkCap: null,
      rightsProcurement: '',
    })
    expect(patched.status).toBe(200)
    const patchedBody = (await patched.json()) as ChallengeDto
    // 写入前 trim
    expect(patchedBody.summary).toBe('改过的简介')
    expect(patchedBody.teamCapacity).toBeNull()
    expect(patchedBody.singleWorkCap).toBeNull()
    // 空串落成 null
    expect(patchedBody.rightsProcurement).toBeNull()
  })

  it('rejects scoring weights whose keys or total are invalid, with field=scoringWeights', async () => {
    const wrongTotal = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '权重合计错误命题',
      scoringWeights: {
        [ChallengeScoringDimension.CommercialResult]: 35,
        [ChallengeScoringDimension.DeliveryQuality]: 25,
      },
    })
    expect(wrongTotal.status).toBe(400)
    const wrongTotalError = await errorOf(wrongTotal)
    expect(wrongTotalError.code).toBe('VALIDATION_ERROR')
    expect(wrongTotalError.field).toBe('scoringWeights')

    const unknownKey = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '未知维度命题',
      scoringWeights: { ...WEIGHTS, made_up_dimension: 10 },
    })
    expect(unknownKey.status).toBe(400)
    const unknownKeyError = await errorOf(unknownKey)
    expect(unknownKeyError.code).toBe('VALIDATION_ERROR')
    expect(unknownKeyError.field).toBe('scoringWeights')

    const outOfRange = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '权重越界命题',
      scoringWeights: {
        [ChallengeScoringDimension.CommercialResult]: 120,
        [ChallengeScoringDimension.DeliveryQuality]: -20,
      },
    })
    expect(outOfRange.status).toBe(400)
    expect((await errorOf(outOfRange)).field).toBe('scoringWeights')

    // 同一份校验在 PATCH 上也生效
    const created = await call('POST', `/seasons/${seasonId}/challenges`, { title: '待改权重命题' })
    const id = ((await created.json()) as ChallengeDto).id
    const patched = await call('PATCH', `/challenges/${id}`, {
      scoringWeights: { [ChallengeScoringDimension.CommercialResult]: 60 },
    })
    expect(patched.status).toBe(400)
    expect((await errorOf(patched)).field).toBe('scoringWeights')

    // 全 0 视为清空 → null，不报错
    const cleared = await call('PATCH', `/challenges/${id}`, {
      scoringWeights: Object.fromEntries(
        CHALLENGE_SCORING_DIMENSIONS.map((dimension) => [dimension, 0]),
      ),
    })
    expect(cleared.status).toBe(200)
    expect(((await cleared.json()) as ChallengeDto).scoringWeights).toBeNull()
  })

  it('validates teamCapacity, singleWorkCap and suggestedSkills', async () => {
    const badTeam = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '团队容量越界命题',
      teamCapacity: CHALLENGE_CARD_LIMITS.teamCapacity.max + 1,
    })
    expect(badTeam.status).toBe(400)
    expect((await errorOf(badTeam)).field).toBe('teamCapacity')

    const badCap = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '单次上限越界命题',
      singleWorkCap: CHALLENGE_CARD_LIMITS.singleWorkCap.max + 1,
    })
    expect(badCap.status).toBe(400)
    expect((await errorOf(badCap)).field).toBe('singleWorkCap')

    const tooManySkills = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '技能过多命题',
      suggestedSkills: Array.from(
        { length: CHALLENGE_CARD_LIMITS.suggestedSkills.max + 1 },
        (_, index) => `技能${index}`,
      ),
    })
    expect(tooManySkills.status).toBe(400)
    expect((await errorOf(tooManySkills)).field).toBe('suggestedSkills')

    const longSkill = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '技能过长命题',
      suggestedSkills: ['技'.repeat(CHALLENGE_CARD_LIMITS.suggestedSkills.itemMax + 1)],
    })
    expect(longSkill.status).toBe(400)
    expect((await errorOf(longSkill)).field).toBe('suggestedSkills')
  })

  it('writes a version record on create, publish and published update', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '版本记录命题',
      ...FIVE_PIECE,
      changeNote: '初版命题卡',
    })
    expect(created.status).toBe(200)
    const draft = (await created.json()) as ChallengeDto
    expect(draft.version).toBe(1)
    expect(draft.versions).toHaveLength(1)
    expect(draft.versions[0]!.version).toBe(1)
    expect(draft.versions[0]!.note).toBe('初版命题卡')
    expect(draft.versions[0]!.changedBy).toBe(OPERATOR)

    // 发布写一条**当前**版本，不升版本号
    const published = await call('POST', `/challenges/${draft.id}/publish`)
    expect(published.status).toBe(200)
    const publishedBody = (await published.json()) as ChallengeDto
    expect(publishedBody.version).toBe(1)
    expect(publishedBody.versions).toHaveLength(2)
    const publishNote = publishedBody.versions.find((entry) => entry.note === '发布命题')
    expect(publishNote).toBeDefined()
    expect(publishNote!.version).toBe(1)

    // 已发布命题内容变更 → version + 1 并写一条
    const updated = await call('PATCH', `/challenges/${draft.id}`, {
      summary: '发布后补充的简介',
      changeNote: '补充简介',
    })
    expect(updated.status).toBe(200)
    const updatedBody = (await updated.json()) as ChallengeDto
    expect(updatedBody.version).toBe(2)
    expect(updatedBody.versions).toHaveLength(3)
    expect(updatedBody.versions[0]!.version).toBe(2)
    expect(updatedBody.versions[0]!.note).toBe('补充简介')

    // 没填 changeNote 时按变更字段生成中文摘要
    const auto = await call('PATCH', `/challenges/${draft.id}`, { ownerName: '王岚' })
    expect(auto.status).toBe(200)
    const autoBody = (await auto.json()) as ChallengeDto
    expect(autoBody.version).toBe(3)
    expect(autoBody.versions[0]!.version).toBe(3)
    expect(autoBody.versions[0]!.note).toContain('负责人')

    // 草稿阶段的编辑不升版本、不写记录
    const draftCreated = await call('POST', `/seasons/${seasonId}/challenges`, { title: '草稿编辑命题' })
    const draftRow = (await draftCreated.json()) as ChallengeDto
    const draftPatched = await call('PATCH', `/challenges/${draftRow.id}`, { summary: '草稿改简介' })
    const draftPatchedBody = (await draftPatched.json()) as ChallengeDto
    expect(draftPatchedBody.version).toBe(1)
    expect(draftPatchedBody.versions).toHaveLength(1)
  })

  it('keeps follow idempotent and returns the real count', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '关注命题',
      ...FIVE_PIECE,
    })
    const id = ((await created.json()) as ChallengeDto).id
    expect((await call('POST', `/challenges/${id}/publish`)).status).toBe(200)

    const first = await call('POST', `/challenges/${id}/follow`)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ followed: true, followCount: 1 })

    // 幂等：重复关注不报错、不重复计数
    const second = await call('POST', `/challenges/${id}/follow`)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ followed: true, followCount: 1 })

    const detail = await call('GET', `/challenges/${id}`)
    const detailBody = (await detail.json()) as ChallengeDto
    expect(detailBody.followCount).toBe(1)
    expect(detailBody.followed).toBe(true)

    // 另一个人关注 → 计数 2
    const outsider = await call('POST', `/challenges/${id}/follow`, undefined, outsiderToken)
    expect(await outsider.json()).toEqual({ followed: true, followCount: 2 })

    const off = await call('DELETE', `/challenges/${id}/follow`)
    expect(off.status).toBe(200)
    expect(await off.json()).toEqual({ followed: false, followCount: 1 })

    // 幂等：重复取消关注不报错
    const offAgain = await call('DELETE', `/challenges/${id}/follow`)
    expect(await offAgain.json()).toEqual({ followed: false, followCount: 1 })

    const afterOff = (await (await call('GET', `/challenges/${id}`)).json()) as ChallengeDto
    expect(afterOff.followed).toBe(false)
    expect(afterOff.followCount).toBe(1)
  })

  it('returns only unarchived season projects that reference this challenge', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '项目归属命题',
      ...FIVE_PIECE,
    })
    const id = ((await created.json()) as ChallengeDto).id
    expect((await call('POST', `/challenges/${id}/publish`)).status).toBe(200)

    const other = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '另一个命题',
      ...FIVE_PIECE,
    })
    const otherId = ((await other.json()) as ChallengeDto).id
    expect((await call('POST', `/challenges/${otherId}/publish`)).status).toBe(200)

    await db.insert(seasonProjects).values([
      {
        seasonId,
        projectId: projectIds[0]!,
        ownerUserId: OPERATOR,
        themes: [THEMES[0]!],
        challengeIds: [id],
        status: SeasonProjectStatus.Published,
        stage: SeasonProjectStage.Sprout,
      },
      {
        seasonId,
        projectId: projectIds[1]!,
        ownerUserId: OUTSIDER,
        themes: [THEMES[0]!],
        challengeIds: [id, otherId],
        status: SeasonProjectStatus.Published,
        stage: SeasonProjectStage.Fruit,
      },
      {
        // 已归档 → 不出现
        seasonId,
        projectId: projectIds[2]!,
        ownerUserId: OPERATOR,
        themes: [THEMES[0]!],
        challengeIds: [id],
        status: SeasonProjectStatus.Archived,
        stage: SeasonProjectStage.Grow,
      },
    ])

    const detail = await call('GET', `/challenges/${id}`)
    expect(detail.status).toBe(200)
    const body = (await detail.json()) as ChallengeDto
    expect(body.projects.map((project) => project.projectId)).toEqual([projectIds[0]!, projectIds[1]!])
    expect(body.projects[0]!.name).toBe('冷库电费管家')
    expect(body.projects[0]!.stage).toBe(SeasonProjectStage.Sprout)
    expect(body.projects[0]!.ownerName).toBe(OPERATOR)
    expect(body.projects[1]!.stage).toBe(SeasonProjectStage.Fruit)
    // selectedCount 是真实值，与 projects 同一份计数
    expect(body.selectedCount).toBe(2)

    // 列表同样带 projects / versions（主办方后台不逐条发详情）
    const list = await call('GET', `/seasons/${seasonId}/challenges?includeDrafts=true`)
    expect(list.status).toBe(200)
    const items = ((await list.json()) as { items: ChallengeDto[] }).items
    const listed = items.find((item) => item.id === id)!
    expect(listed.projects).toHaveLength(2)
    expect(listed.selectedCount).toBe(2)
    expect(listed.versions.length).toBeGreaterThanOrEqual(2)
    // 赛季上下文只详情返回
    expect(listed.season).toBeUndefined()
    expect(body.season?.code).toBe(code)
  })

  it('hides a draft challenge from anyone but the season organizer', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, { title: '只有主办方看得见的草稿' })
    const id = ((await created.json()) as ChallengeDto).id

    const asOutsider = await call('GET', `/challenges/${id}`, undefined, outsiderToken)
    expect(asOutsider.status).toBe(403)
    expect((await errorOf(asOutsider)).code).toBe('NOT_SEASON_ORGANIZER')

    const asOrganizer = await call('GET', `/challenges/${id}`)
    expect(asOrganizer.status).toBe(200)
    expect(((await asOrganizer.json()) as ChallengeDto).status).toBe('draft')

    const missing = await call('GET', '/challenges/99999999')
    expect(missing.status).toBe(404)
    expect((await errorOf(missing)).code).toBe('CHALLENGE_NOT_FOUND')
  })

  it('accepts an optional changeNote on publish', async () => {
    const created = await call('POST', `/seasons/${seasonId}/challenges`, {
      title: '带说明发布命题',
      ...FIVE_PIECE,
    })
    const id = ((await created.json()) as ChallengeDto).id
    const published = await call('POST', `/challenges/${id}/publish`, { changeNote: '五件套补齐后发布' })
    expect(published.status).toBe(200)
    const body = (await published.json()) as ChallengeDto
    expect(body.versions.some((entry) => entry.note === '五件套补齐后发布')).toBe(true)
    // changeNote 不落 challenges 表
    const rows = await db
      .select({ summary: challenges.summary })
      .from(challenges)
      .where(and(eq(challenges.id, id), eq(challenges.seasonId, seasonId)))
    expect(rows[0]!.summary).toBeNull()
    // 权重合计常量与默认权重之和一致
    expect(Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0)).toBe(CHALLENGE_SCORING_WEIGHT_TOTAL)
  })
})
