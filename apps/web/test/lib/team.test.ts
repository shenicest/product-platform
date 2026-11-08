import { describe, expect, it } from 'vitest'
import {
  ChallengeStatus,
  RecruitmentApplicationStatus,
  SeasonProjectSource,
  SeasonStatus,
} from '@shenicest/shared'
import {
  APPLICATION_MESSAGE_MAX,
  challengeMetaLabel,
  challengeSelectable,
  dateInputToIso,
  emptyProjectDraft,
  emptyRecruitmentDraft,
  formatDeadlineLabel,
  parseCommaList,
  projectOptionLabel,
  projectThemeOptions,
  recruitmentApplicationMeta,
  recruitmentCardStatusMeta,
  relativeTime,
  resolveMaxChallenges,
  resolveTeamSeasonId,
  seasonProjectSourceMeta,
  seasonProjectStatusMeta,
  teamRuleBullets,
  toRecruitmentCardPayload,
  toSeasonProjectPayload,
  unselectableChallengeHint,
  validateApplicationMessage,
  validateProjectDraft,
  validateRecruitmentDraft,
  type TeamChallengeDto,
  type TeamRulesDto,
} from '@/lib/team'

function rules(overrides: Partial<TeamRulesDto> = {}): TeamRulesDto {
  return {
    maxCoreMembers: 3,
    maxProjectsPerParticipant: 1,
    maxChallengesPerProject: 2,
    teamDeadline: '2026-11-12T15:59:00.000Z',
    deadlinePassed: false,
    ...overrides,
  }
}

function challenge(overrides: Partial<TeamChallengeDto> = {}): TeamChallengeDto {
  return {
    id: 3,
    seasonId: 7,
    title: 'AI 基建用电地图',
    realProblem: null,
    targetCustomer: null,
    minimumDeliverable: null,
    resourceCommitment: null,
    resultEvidenceRules: null,
    status: ChallengeStatus.Published,
    version: 2,
    createdBy: '1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    type: '企业命题',
    capacity: 5,
    selectedCount: 2,
    ...overrides,
  }
}

describe('teamRuleBullets', () => {
  it('generates the six bullets with season rules filled in', () => {
    expect(teamRuleBullets({ rules: rules() })).toEqual([
      '核心团队 1—3 人，允许单人项目',
      '核心成员必须是本赛季已通过报名的选手',
      '外部共建者可以留痕，不计入核心人数',
      '本赛季每人原则上 1 个项目；组队与命题变更截止 11月12日 23:59',
      '每个项目可选 1—2 个平行命题，截止后改命题需主办方审批',
      '成员退出不删除作品、积分与 Track Record',
    ])
  })

  it('follows the season config instead of hardcoding numbers', () => {
    const bullets = teamRuleBullets({
      rules: rules({ maxCoreMembers: 1, maxProjectsPerParticipant: 2, maxChallengesPerProject: 3 }),
    })
    expect(bullets[0]).toBe('核心团队 1—1 人，允许单人项目')
    expect(bullets[3]).toContain('每人原则上 2 个项目')
    expect(bullets[4]).toContain('1—3 个平行命题')
  })

  it('falls back to the season rule default when maxChallengesPerProject is missing', () => {
    const bullets = teamRuleBullets({ rules: rules({ maxChallengesPerProject: null }) })
    expect(bullets[4]).toContain('1—3 个平行命题')
  })

  it('degrades the deadline sentence when teamDeadline is missing', () => {
    const bullets = teamRuleBullets({ rules: rules({ teamDeadline: null }) })
    expect(bullets[3]).toContain('截止时间待定')
    expect(bullets[3]).not.toContain('待定月')
  })

  it('resolveMaxChallenges ignores non-positive values', () => {
    expect(resolveMaxChallenges(rules({ maxChallengesPerProject: 0 }))).toBe(3)
    expect(resolveMaxChallenges(rules({ maxChallengesPerProject: 2 }))).toBe(2)
  })
})

describe('formatDeadlineLabel', () => {
  it('formats in Beijing time as 月日 时:分', () => {
    expect(formatDeadlineLabel('2026-11-12T15:59:00.000Z')).toBe('11月12日 23:59')
  })

  it('pads single-digit hours', () => {
    expect(formatDeadlineLabel('2026-11-12T01:05:00.000Z')).toBe('11月12日 09:05')
  })

  it('returns 待定 for missing / invalid input', () => {
    expect(formatDeadlineLabel(null)).toBe('待定')
    expect(formatDeadlineLabel('not-a-date')).toBe('待定')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-11-08T12:00:00.000Z')

  it('covers just-now / minutes / hours / days / months', () => {
    expect(relativeTime('2026-11-08T11:59:40.000Z', now)).toBe('刚刚')
    expect(relativeTime('2026-11-08T11:46:00.000Z', now)).toBe('14 分钟前')
    expect(relativeTime('2026-11-07T22:00:00.000Z', now)).toBe('14 小时前')
    expect(relativeTime('2026-11-05T12:00:00.000Z', now)).toBe('3 天前')
    expect(relativeTime('2026-09-01T12:00:00.000Z', now)).toBe('2 个月前')
  })

  it('treats a future timestamp as 刚刚 instead of a negative duration', () => {
    expect(relativeTime('2026-11-08T12:05:00.000Z', now)).toBe('刚刚')
  })

  it('returns a dash for missing / invalid input', () => {
    expect(relativeTime(null, now)).toBe('—')
    expect(relativeTime('nope', now)).toBe('—')
  })
})

describe('parseCommaList', () => {
  it('splits on both ASCII and Chinese commas, trims, and de-duplicates', () => {
    expect(parseCommaList('前端, 数据分析，前端 ,, ')).toEqual(['前端', '数据分析'])
  })

  it('returns an empty array for blank input', () => {
    expect(parseCommaList('')).toEqual([])
    expect(parseCommaList(' ， , ')).toEqual([])
  })
})

describe('projectThemeOptions', () => {
  it('prefers the season themes', () => {
    expect(projectThemeOptions(['新能源与储能'])).toEqual(['新能源与储能'])
  })

  it('falls back to CATEGORIES when the season has no themes', () => {
    const options = projectThemeOptions([])
    expect(options.length).toBeGreaterThan(0)
    expect(options).toContain('效率工具')
  })
})

describe('challenge selectability', () => {
  it('only published challenges are selectable', () => {
    expect(challengeSelectable(challenge())).toBe(true)
    expect(challengeSelectable(challenge({ status: ChallengeStatus.Reference }))).toBe(false)
    expect(challengeSelectable(challenge({ status: ChallengeStatus.Draft }))).toBe(false)
  })

  it('names the blocked challenges in the hint', () => {
    const hint = unselectableChallengeHint([
      challenge(),
      challenge({ id: 9, title: '冷库电耗预测', status: ChallengeStatus.Reference }),
    ])
    expect(hint).toBe('「冷库电耗预测」是参考资料，不能正式选择。')
  })

  it('returns null when everything is selectable', () => {
    expect(unselectableChallengeHint([challenge()])).toBeNull()
  })

  it('renders the meta line as 类型 · 版本 · 已选 N / 容量', () => {
    expect(challengeMetaLabel(challenge())).toBe('企业命题 · v2 · 已选 2 / 5')
    expect(
      challengeMetaLabel(challenge({ type: null, capacity: null, selectedCount: null })),
    ).toBe('未分类 · v2 · 已选 0 / 不限')
  })
})

describe('validateProjectDraft', () => {
  const options = { maxChallengesPerProject: 2, selectableChallengeIds: [3, 5] }

  it('accepts a filled create draft', () => {
    const values = { ...emptyProjectDraft('create'), name: '冷库电费管家', challengeIds: [3] }
    expect(validateProjectDraft(values, options)).toEqual({})
  })

  it('requires a name and at least one challenge', () => {
    const errors = validateProjectDraft(emptyProjectDraft('create'), options)
    expect(errors.name).toBe('请填写项目名称')
    expect(errors.challengeIds).toBe('请至少选择 1 个命题')
  })

  it('rejects more challenges than the season allows', () => {
    const errors = validateProjectDraft(
      { ...emptyProjectDraft('create'), name: 'A', challengeIds: [3, 5, 7] },
      options,
    )
    expect(errors.challengeIds).toBe('每个项目最多选择 2 个命题')
  })

  it('rejects challenges that are not published', () => {
    const errors = validateProjectDraft(
      { ...emptyProjectDraft('create'), name: 'A', challengeIds: [99] },
      options,
    )
    expect(errors.challengeIds).toBe('只能选择已发布的命题')
  })

  it('requires a project in bring mode and skips the name checks', () => {
    const errors = validateProjectDraft(
      { ...emptyProjectDraft('bring'), challengeIds: [3] },
      options,
    )
    expect(errors.projectId).toBe('请选择要带入的项目')
    expect(errors.name).toBeUndefined()
  })

  it('caps the number of themes', () => {
    const errors = validateProjectDraft(
      {
        ...emptyProjectDraft('create'),
        name: 'A',
        challengeIds: [3],
        themes: ['1', '2', '3', '4', '5', '6'],
      },
      options,
    )
    expect(errors.themes).toBe('方向最多 5 个')
  })

  it('toSeasonProjectPayload trims and turns an empty tagline into null', () => {
    expect(
      toSeasonProjectPayload({
        mode: 'create',
        name: ' 冷库电费管家 ',
        tagline: '   ',
        themes: ['新能源与储能'],
        challengeIds: [3],
        projectId: null,
      }),
    ).toEqual({
      mode: 'create',
      name: '冷库电费管家',
      tagline: null,
      themes: ['新能源与储能'],
      challengeIds: [3],
    })
  })
})

describe('validateRecruitmentDraft', () => {
  const now = new Date('2026-11-08T12:00:00.000Z')

  function values(overrides: Partial<ReturnType<typeof emptyRecruitmentDraft>> = {}) {
    return {
      ...emptyRecruitmentDraft(7),
      roles: '前端，数据分析',
      description: '做一个冷库电费看板，每周投入 6 小时',
      deadline: '2026-11-19',
      ...overrides,
    }
  }

  it('accepts a filled draft', () => {
    expect(validateRecruitmentDraft(values(), { now })).toEqual({})
  })

  it('requires roles, description and a future deadline', () => {
    const errors = validateRecruitmentDraft(
      emptyRecruitmentDraft(null),
      { now },
    )
    expect(errors.seasonProjectId).toBe('请选择要招募的项目')
    expect(errors.roles).toBe('请至少填写 1 个需要的角色')
    expect(errors.description).toBe('请填写说明：要做什么、每周需要投入多少')
    expect(errors.deadline).toBe('请选择截止日期')
  })

  it('rejects a deadline in the past', () => {
    const errors = validateRecruitmentDraft(values({ deadline: '2026-11-01' }), { now })
    expect(errors.deadline).toBe('截止日期必须晚于今天')
  })

  it('counts roles after splitting, not the raw string length', () => {
    const roles = Array.from({ length: 11 }, (_, index) => `角色${index}`).join('，')
    expect(validateRecruitmentDraft(values({ roles }), { now }).roles).toBe('角色最多 10 个')
  })

  it('rejects a single role longer than 50 characters', () => {
    const errors = validateRecruitmentDraft(values({ roles: '前'.repeat(51) }), { now })
    expect(errors.roles).toBe('每个角色最多 50 个字符')
  })

  it('toRecruitmentCardPayload splits lists and pins the deadline to 23:59 Beijing', () => {
    const payload = toRecruitmentCardPayload(values({ skills: '小程序, Python' }))
    expect(payload.roles).toEqual(['前端', '数据分析'])
    expect(payload.skills).toEqual(['小程序', 'Python'])
    expect(payload.seasonProjectId).toBe(7)
    expect(payload.deadline).toBe('2026-11-19T15:59:59.000Z')
  })
})

describe('dateInputToIso', () => {
  it('treats the picked date as the end of that Beijing day', () => {
    expect(dateInputToIso('2026-11-19')).toBe('2026-11-19T15:59:59.000Z')
  })

  it('returns null for malformed input', () => {
    expect(dateInputToIso('')).toBeNull()
    expect(dateInputToIso('2026/11/19')).toBeNull()
  })
})

describe('validateApplicationMessage', () => {
  it('requires a non-empty message', () => {
    expect(validateApplicationMessage('   ')).toBe('请填写申请说明：你是谁、能做什么')
  })

  it('caps the message length', () => {
    expect(validateApplicationMessage('x'.repeat(APPLICATION_MESSAGE_MAX + 1))).toBe(
      `申请说明最多 ${APPLICATION_MESSAGE_MAX} 个字符`,
    )
  })

  it('accepts a normal message', () => {
    expect(validateApplicationMessage('我是前端，做过两个小程序')).toBeNull()
  })
})

describe('resolveTeamSeasonId', () => {
  const seasons = [
    { id: 4, status: SeasonStatus.Upcoming },
    { id: 7, status: SeasonStatus.Active },
    { id: 9, status: SeasonStatus.Active },
  ]

  it('uses the URL season when it belongs to me', () => {
    expect(resolveTeamSeasonId('9', seasons)).toBe(9)
  })

  it('falls back to the first active season when the param is missing or foreign', () => {
    expect(resolveTeamSeasonId(undefined, seasons)).toBe(7)
    expect(resolveTeamSeasonId('999', seasons)).toBe(7)
    expect(resolveTeamSeasonId('abc', seasons)).toBe(7)
  })

  it('prefers an upcoming season when nothing is active', () => {
    expect(resolveTeamSeasonId(null, [{ id: 4, status: SeasonStatus.Upcoming }])).toBe(4)
  })

  it('returns null when there is no season at all', () => {
    expect(resolveTeamSeasonId('7', [])).toBeNull()
  })
})

describe('labels', () => {
  it('maps project status / source and card status', () => {
    expect(seasonProjectStatusMeta('published').label).toBe('已发布')
    expect(seasonProjectSourceMeta(SeasonProjectSource.BroughtIn).label).toBe('带入已有项目')
    expect(recruitmentCardStatusMeta('open').label).toBe('招募中')
    expect(recruitmentApplicationMeta(RecruitmentApplicationStatus.Pending).label).toBe('待处理')
    expect(recruitmentApplicationMeta(RecruitmentApplicationStatus.Declined).tone).toBe('neutral')
  })

  it('projectOptionLabel zero-pads the code', () => {
    expect(projectOptionLabel({ id: 11, name: '峰谷电价计算器' })).toBe('P-011 峰谷电价计算器')
    expect(projectOptionLabel({ id: 7, name: 'X', code: 11 })).toBe('P-011 X')
  })
})
