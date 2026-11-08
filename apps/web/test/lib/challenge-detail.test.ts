import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_RIGHTS_FIELDS,
  CHALLENGE_SCORING_DEFAULT_WEIGHTS,
  CHALLENGE_SCORING_DIMENSIONS,
  ChallengeScoringDimension,
  SEASON_RULE_DEFAULTS,
} from '@shenicest/shared'
import {
  DETAIL_EMPTY,
  RIGHTS_FOOTNOTE,
  SCORING_EXCLUDED_NOTE,
  SCORING_WEIGHT_NOTE,
  SELECTED_PROJECTS_NOTE,
  SEAT_LOCKED_NOTE,
  VERSION_FOOTNOTE,
  challengeCardRows,
  challengeProjectRows,
  challengeResourceRows,
  challengeRightsRows,
  challengeVersionRows,
  effectiveSingleWorkCap,
  fivePieceLabel,
  followErrorMessage,
  followLabel,
  formatMonthDay,
  normalizeChallengeDetail,
  scoringRuleRows,
  scoringWeightRows,
  seasonLabel,
  seatState,
  selectedProjectsLabel,
  singleWorkCapLabel,
  teamCapacityLabel,
  versionLabel,
} from '@/lib/challenge-detail'

// ---------------------------------------------------------------------------
// 测试夹具
// ---------------------------------------------------------------------------

function cardInput(overrides: Partial<Parameters<typeof challengeCardRows>[0]> = {}) {
  return {
    background: '储能柜装完没人运维',
    realProblem: '峰谷套利跑不起来',
    targetCustomer: '长三角制造业园区',
    scope: '1 个真实站点',
    outOfScope: '不做硬件改造',
    monthlyGoal: '一套充放电策略',
    suggestedSkills: ['储能', '数据分析'],
    teamCapacity: 6,
    selectedCount: 4,
    capacity: 6,
    ownerName: '李二',
    responseSla: '工作日 48 小时内',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 命题卡
// ---------------------------------------------------------------------------

describe('challengeCardRows', () => {
  it('keeps the contract order of the ten rows', () => {
    expect(challengeCardRows(cardInput()).map((row) => row.key)).toEqual([
      'background',
      'realProblem',
      'targetCustomer',
      'scope',
      'outOfScope',
      'monthlyGoal',
      'suggestedSkills',
      'teamCapacity',
      'ownerName',
      'responseSla',
    ])
  })

  it('uses the screenshot labels', () => {
    expect(challengeCardRows(cardInput()).map((row) => row.label)).toEqual([
      '背景',
      '真实问题',
      '目标客户 / 产业对象',
      '范围',
      '不做什么',
      '一个月最小成果',
      '建议技能',
      '团队容量',
      '负责人',
      '响应时限',
    ])
  })

  it('fills empty text, empty skills and whitespace with the placeholder', () => {
    const rows = challengeCardRows(
      cardInput({
        background: null,
        realProblem: '   ',
        targetCustomer: '',
        scope: null,
        outOfScope: null,
        monthlyGoal: null,
        suggestedSkills: [],
        ownerName: null,
        responseSla: null,
      }),
    )
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    for (const key of [
      'background',
      'realProblem',
      'targetCustomer',
      'scope',
      'outOfScope',
      'monthlyGoal',
      'suggestedSkills',
      'ownerName',
      'responseSla',
    ]) {
      expect(byKey[key]).toBe(DETAIL_EMPTY)
    }
  })

  it('joins the suggested skills and delegates the capacity row', () => {
    const rows = challengeCardRows(cardInput())
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    expect(byKey.suggestedSkills).toBe('储能、数据分析')
    expect(byKey.teamCapacity).toBe(teamCapacityLabel(6, 4, 6))
  })
})

describe('teamCapacityLabel', () => {
  it('renders both a configured team capacity and a configured cap', () => {
    expect(teamCapacityLabel(6, 4, 6)).toBe('最多 6 个项目（每个项目选一次占一个名额）· 已选 4 / 6')
  })

  it('renders 不限 for a null team capacity but keeps the selection cap', () => {
    expect(teamCapacityLabel(null, 2, 10)).toBe(
      '团队数量不限（每个项目选一次占一个名额）· 已选 2 / 10',
    )
  })

  it('renders 不限 on both sides when neither is configured', () => {
    expect(teamCapacityLabel(null, 0, null)).toBe(
      '团队数量不限（每个项目选一次占一个名额）· 已选 0 / 不限',
    )
  })
})

// ---------------------------------------------------------------------------
// 资源承诺
// ---------------------------------------------------------------------------

describe('challengeResourceRows', () => {
  const resources = [
    {
      id: 2,
      kind: 'database',
      title: '历史电表数据',
      quantity: '3 个站点',
      conditions: '需签 NDA',
      owner: '数据平台',
      status: 'provided',
      sortOrder: 1,
    },
    {
      id: 1,
      kind: 'funding',
      title: '验证奖金',
      quantity: null,
      conditions: null,
      owner: null,
      status: 'unfulfilled',
      sortOrder: 0,
    },
  ]

  it('sorts by sortOrder and translates kind / status', () => {
    const rows = challengeResourceRows(
      resources,
      (kind) => (kind === 'database' ? '数据库' : '资金'),
      (status) => (status === 'provided' ? '已提供' : '未兑现'),
    )
    expect(rows.map((row) => row.id)).toEqual([1, 2])
    expect(rows[1].kindLabel).toBe('数据库')
    expect(rows[1].statusLabel).toBe('已提供')
  })

  it('renders a dash for empty quantity / conditions / owner', () => {
    const rows = challengeResourceRows(resources, (kind) => kind, (status) => status)
    expect(rows[0].quantity).toBe('—')
    expect(rows[0].conditions).toBe('—')
    expect(rows[0].owner).toBe('—')
  })

  it('flags unfulfilled resources so the view can warn instead of promising', () => {
    const rows = challengeResourceRows(resources, (kind) => kind, (status) => status)
    expect(rows[0].isUnfulfilled).toBe(true)
    expect(rows[1].isUnfulfilled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 评分与奖励
// ---------------------------------------------------------------------------

describe('scoringWeightRows', () => {
  it('falls back to the shared default weights when nothing is configured', () => {
    const { rows, configured } = scoringWeightRows(null)
    expect(configured).toBe(false)
    expect(rows.map((row) => row.key)).toEqual([...CHALLENGE_SCORING_DIMENSIONS])
    expect(rows.map((row) => row.weight)).toEqual(
      CHALLENGE_SCORING_DIMENSIONS.map((key) => CHALLENGE_SCORING_DEFAULT_WEIGHTS[key]),
    )
    expect(rows.map((row) => row.percentLabel)).toEqual(['35%', '25%', '15%', '15%', '10%'])
  })

  it('treats an empty object as unconfigured', () => {
    expect(scoringWeightRows({}).configured).toBe(false)
  })

  it('uses the configured weights and labels them', () => {
    const { rows, configured } = scoringWeightRows({
      [ChallengeScoringDimension.CommercialResult]: 50,
      [ChallengeScoringDimension.DeliveryQuality]: 20,
      [ChallengeScoringDimension.OriginalMethod]: 10,
      [ChallengeScoringDimension.ActionEvidence]: 10,
      [ChallengeScoringDimension.ReuseValue]: 10,
    })
    expect(configured).toBe(true)
    expect(rows[0]).toMatchObject({ label: '真实商业结果', weight: 50, percentLabel: '50%' })
  })

  it('falls back per dimension when a key is missing', () => {
    const { rows } = scoringWeightRows({ [ChallengeScoringDimension.CommercialResult]: 100 })
    expect(rows[0].weight).toBe(100)
    expect(rows[1].weight).toBe(CHALLENGE_SCORING_DEFAULT_WEIGHTS.delivery_quality)
  })
})

describe('effectiveSingleWorkCap', () => {
  it('takes the smaller of the challenge cap and the season cap', () => {
    expect(effectiveSingleWorkCap(80, 100)).toBe(80)
    expect(effectiveSingleWorkCap(300, 100)).toBe(100)
    expect(effectiveSingleWorkCap(100, 100)).toBe(100)
  })

  it('uses whichever side is configured', () => {
    expect(effectiveSingleWorkCap(null, 100)).toBe(100)
    expect(effectiveSingleWorkCap(50, null)).toBe(50)
  })

  it('returns null when neither side is configured (or both are 0)', () => {
    expect(effectiveSingleWorkCap(null, null)).toBeNull()
    expect(effectiveSingleWorkCap(0, 0)).toBeNull()
    expect(effectiveSingleWorkCap(undefined, undefined)).toBeNull()
  })
})

describe('singleWorkCapLabel', () => {
  it('explains the smaller-value rule when the challenge sets its own cap', () => {
    expect(singleWorkCapLabel(80, 100)).toBe(
      '80 分（标注本命题的作品取赛季上限 100 与本命题上限 80 的较小值）',
    )
  })

  it('says the season cap applies when the challenge has no cap of its own', () => {
    expect(singleWorkCapLabel(null, 100)).toBe('100 分（取赛季上限，本命题未单独设限）')
  })

  it('says the season is scoreless when nothing is configured', () => {
    expect(singleWorkCapLabel(null, null)).toBe('本季不计分')
  })
})

describe('scoringRuleRows', () => {
  it('renders the six scoring rows in contract order', () => {
    const rows = scoringRuleRows({
      singleWorkCap: 80,
      season: { rules: SEASON_RULE_DEFAULTS, activeBudget: { version: 3 } },
    })
    expect(rows.map((row) => row.key)).toEqual([
      'singleWorkCap',
      'reviewThreshold',
      'quotaSource',
      'dailyQuota',
      'exchangeRatio',
      'budgetSource',
    ])
  })

  it('reports a scoreless season and a missing budget', () => {
    const rows = scoringRuleRows({
      singleWorkCap: null,
      season: {
        rules: { ...SEASON_RULE_DEFAULTS, reviewThreshold: 0, exchangeRatio: 0 },
        activeBudget: null,
      },
    })
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    expect(byKey.reviewThreshold).toBe('本季不设大额复核')
    expect(byKey.exchangeRatio).toBe('本季不计分')
    expect(byKey.budgetSource).toBe('尚未配置有效预算')
  })

  it('keeps the excluded items and weight notes as product copy', () => {
    expect(SCORING_EXCLUDED_NOTE).toContain('不计分')
    expect(SCORING_WEIGHT_NOTE).toContain('权重')
  })
})

// ---------------------------------------------------------------------------
// 公开与权益
// ---------------------------------------------------------------------------

describe('challengeRightsRows', () => {
  it('renders the seven rights fields in contract order', () => {
    expect(challengeRightsRows({}).map((row) => row.key)).toEqual([...CHALLENGE_RIGHTS_FIELDS])
    expect(challengeRightsRows({}).map((row) => row.label)).toEqual([
      '公开范围',
      '保密',
      '知识产权',
      '企业使用权',
      '采购或后续合作',
      '特殊条件',
      '独家或排他',
    ])
  })

  it('never merges the fields and placeholders the empty ones', () => {
    const rows = challengeRightsRows({ rightsIp: '归项目团队', rightsExclusivity: '  ' })
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    expect(byKey.rightsIp).toBe('归项目团队')
    expect(byKey.rightsExclusivity).toBe(DETAIL_EMPTY)
    expect(RIGHTS_FOOTNOTE).toContain('知识产权')
  })
})

// ---------------------------------------------------------------------------
// 侧栏
// ---------------------------------------------------------------------------

describe('challengeVersionRows', () => {
  const versions = [
    { id: 1, version: 1, note: '初版命题卡', changedBy: 'a', createdAt: '2026-10-05T06:30:45.000Z' },
    { id: 3, version: 3, note: '调整权重', changedBy: 'b', createdAt: '2026-10-26T06:30:45.000Z' },
    { id: 2, version: 2, note: '发布命题', changedBy: 'b', createdAt: '2026-10-20T06:30:45.000Z' },
  ]

  it('sorts by version descending', () => {
    expect(challengeVersionRows(versions).map((row) => row.versionLabel)).toEqual([
      'v3',
      'v2',
      'v1',
    ])
  })

  it('labels each row with a month/day date', () => {
    expect(challengeVersionRows(versions)[0]).toMatchObject({
      versionLabel: 'v3',
      dateLabel: '10月26日',
      note: '调整权重',
    })
  })

  it('returns an empty list for no versions', () => {
    expect(challengeVersionRows([])).toEqual([])
  })

  it('keeps the version footnote as product copy', () => {
    expect(VERSION_FOOTNOTE).toBe('影响评分、证据、权益和奖励的变更生成新版本，不覆盖旧版。')
  })
})

describe('formatMonthDay', () => {
  it('formats an ISO timestamp as 月日 in Asia/Shanghai', () => {
    expect(formatMonthDay('2026-10-26T06:30:45.000Z')).toBe('10月26日')
  })

  it('rolls over to the next Shanghai day for late-UTC timestamps', () => {
    // 2026-10-25T20:00Z 是北京时间 10-26 04:00。
    expect(formatMonthDay('2026-10-25T20:00:00.000Z')).toBe('10月26日')
  })

  it('renders 待定 for empty or unparsable values', () => {
    expect(formatMonthDay(null)).toBe('待定')
    expect(formatMonthDay(undefined)).toBe('待定')
    expect(formatMonthDay('')).toBe('待定')
    expect(formatMonthDay('not-a-date')).toBe('待定')
  })
})

describe('challengeProjectRows', () => {
  const projects = [
    {
      seasonProjectId: 1,
      projectId: 11,
      name: '储能运维助手',
      tagline: null,
      stage: 'grow',
      ownerName: '张三',
    },
    {
      seasonProjectId: 2,
      projectId: 12,
      name: '  ',
      tagline: '一句话',
      stage: 'fruit',
      ownerName: null,
    },
    {
      seasonProjectId: 3,
      projectId: 13,
      name: '园区账单拆解',
      tagline: null,
      stage: '',
      ownerName: null,
    },
  ]

  it('translates the stage enum into the screenshot labels', () => {
    expect(challengeProjectRows(projects).map((row) => row.stageLabel)).toEqual([
      '生长',
      '结果',
      '种子',
    ])
  })

  it('falls back to 未命名项目 for a blank name', () => {
    expect(challengeProjectRows(projects)[1].name).toBe('未命名项目')
  })

  it('keeps the ids so the view can key the list', () => {
    expect(challengeProjectRows(projects).map((row) => row.seasonProjectId)).toEqual([1, 2, 3])
  })
})

describe('selectedProjectsLabel', () => {
  it('renders selected / capacity', () => {
    expect(selectedProjectsLabel(4, 6)).toBe('4 / 6')
  })

  it('renders 不限 when capacity is null', () => {
    expect(selectedProjectsLabel(0, null)).toBe('0 / 不限')
  })

  it('keeps the note about no primary challenge', () => {
    expect(SELECTED_PROJECTS_NOTE).toContain('没有主命题和辅助命题之分')
  })
})

describe('seatState', () => {
  it('is locked with the 403 note for anonymous visitors', () => {
    expect(seatState({ isLoggedIn: false })).toEqual({
      locked: true,
      title: '入座',
      note: SEAT_LOCKED_NOTE,
    })
  })

  it('does not guess the review result for a signed-in visitor', () => {
    expect(seatState({ isLoggedIn: true })).toEqual({
      locked: true,
      title: '入座',
      note: SEAT_LOCKED_NOTE,
    })
  })
})

// ---------------------------------------------------------------------------
// 关注
// ---------------------------------------------------------------------------

describe('followLabel', () => {
  it('offers + 关注 when not followed', () => {
    expect(followLabel(false)).toEqual({ text: '+ 关注', aria: '关注该命题' })
  })

  it('offers 已关注 when followed', () => {
    expect(followLabel(true)).toEqual({ text: '已关注', aria: '取消关注该命题' })
  })
})

describe('followErrorMessage', () => {
  it('prefers the backend message', () => {
    expect(
      followErrorMessage({ status: 404, body: { error: { code: 'NOT_FOUND', message: '命题不存在' } } }),
    ).toBe('命题不存在')
  })

  it('falls back to a generic sentence when the message is missing', () => {
    expect(followErrorMessage(null)).toBe('关注失败，请稍后重试。')
    expect(followErrorMessage({ body: { error: { message: '  ' } } })).toBe(
      '关注失败，请稍后重试。',
    )
  })
})

// ---------------------------------------------------------------------------
// 页头文案
// ---------------------------------------------------------------------------

describe('header labels', () => {
  it('renders the version label', () => {
    expect(versionLabel(3)).toBe('v3')
  })

  it('renders the season code and name', () => {
    expect(seasonLabel({ code: '502', name: 'AI4BBS 产业商业赛季' })).toBe(
      '502 · AI4BBS 产业商业赛季',
    )
    expect(seasonLabel({ code: '502', name: '' })).toBe('502')
    expect(seasonLabel({ code: '', name: '' })).toBe('赛季待定')
  })

  it('does not repeat the code when the name already contains it', () => {
    expect(seasonLabel({ code: 'AI4BBS', name: 'AI4BBS 产业商业赛季' })).toBe(
      'AI4BBS 产业商业赛季',
    )
  })

  it('summarizes the five-piece completeness', () => {
    expect(fivePieceLabel({ fivePieceComplete: true })).toMatchObject({
      label: '五件套完整',
      tone: 'success',
    })
    expect(
      fivePieceLabel({ fivePieceComplete: false, missingFields: ['目标客户', '结果证据规则'] }),
    ).toMatchObject({ label: '五件套缺 2 项', tone: 'warning' })
    expect(fivePieceLabel({ fivePieceComplete: false, missingFields: [] })).toMatchObject({
      label: '五件套未齐',
      tone: 'warning',
    })
  })
})

// ---------------------------------------------------------------------------
// 响应归一化
// ---------------------------------------------------------------------------

describe('normalizeChallengeDetail', () => {
  it('survives an almost-empty response (backend fields not landed yet)', () => {
    const detail = normalizeChallengeDetail({ id: 96, seasonId: 1, title: '命题' })
    expect(detail.id).toBe(96)
    expect(detail.summary).toBeNull()
    expect(detail.suggestedSkills).toEqual([])
    expect(detail.versions).toEqual([])
    expect(detail.projects).toEqual([])
    expect(detail.followCount).toBe(0)
    expect(detail.followed).toBe(false)
    expect(detail.season.rules).toEqual(SEASON_RULE_DEFAULTS)
    expect(detail.season.activeBudget).toBeNull()
  })

  it('keeps the real values when the backend sends them', () => {
    const detail = normalizeChallengeDetail({
      id: 96,
      seasonId: 1,
      title: '工商业储能的第一张订单',
      summary: '谁会为储能柜付第一笔钱？',
      suggestedSkills: ['储能', 42, '数据分析'],
      scoringWeights: { commercial_result: 35 },
      followCount: 7,
      followed: true,
      versions: [{ id: 1, version: 3, note: '发布', changedBy: 'u1', createdAt: '2026-10-26T06:30:45.000Z' }],
      projects: [{ seasonProjectId: 1, projectId: 11, name: '储能运维助手', stage: 'grow' }],
      season: {
        id: 1,
        code: '502',
        name: 'AI4BBS 产业商业赛季',
        rules: { ...SEASON_RULE_DEFAULTS, singleWorkCap: 100 },
        activeBudget: { version: 2, totalAmount: 120000, reason: '追加' },
      },
    })
    expect(detail.summary).toBe('谁会为储能柜付第一笔钱？')
    expect(detail.suggestedSkills).toEqual(['储能', '数据分析'])
    expect(detail.scoringWeights).toEqual({ commercial_result: 35 })
    expect(detail.followCount).toBe(7)
    expect(detail.followed).toBe(true)
    expect(detail.selectedCount).toBe(1)
    expect(detail.versions).toHaveLength(1)
    expect(detail.projects[0].tagline).toBeNull()
    expect(detail.season.code).toBe('502')
    expect(detail.season.rules.singleWorkCap).toBe(100)
    expect(detail.season.activeBudget).toEqual({ version: 2, totalAmount: 120000, reason: '追加' })
  })

  it('drops junk entries instead of rendering undefined rows', () => {
    const detail = normalizeChallengeDetail({
      id: 1,
      resources: [null, { id: 2, kind: 'database', title: '数据' }],
      versions: ['nope'],
      projects: [{}, { seasonProjectId: 5, projectId: 6, name: '项目', stage: 'seed' }],
    })
    expect(detail.resources).toHaveLength(1)
    expect(detail.resources[0].quantity).toBeNull()
    expect(detail.versions).toEqual([])
    expect(detail.projects).toHaveLength(2)
  })
})
