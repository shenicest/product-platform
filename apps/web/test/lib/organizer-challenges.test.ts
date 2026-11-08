import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_CAPACITY_LIMITS,
  CHALLENGE_CARD_LIMITS,
  CHALLENGE_RESOURCE_KINDS,
  CHALLENGE_RESOURCE_STATUSES,
  CHALLENGE_RIGHTS_FIELDS,
  CHALLENGE_SCORING_DEFAULT_WEIGHTS,
  CHALLENGE_SCORING_DIMENSIONS,
  CHALLENGE_SCORING_WEIGHT_TOTAL,
  CHALLENGE_TYPES,
  ChallengeResourceKind,
  ChallengeResourceStatus,
  ChallengeScoringDimension,
  ChallengeStatus,
  ENTERPRISE_COOPERATION_TIERS,
  EnterpriseCooperationStatus,
  EnterprisePublicScope,
  MAX_CHALLENGE_RESOURCES,
  enterpriseCooperationTierLabel,
  seasonProjectStageLabel,
} from '@shenicest/shared'
import {
  CHALLENGE_RIGHTS_FORM_FIELDS,
  FIVE_PIECE_FIELDS,
  SCORING_WEIGHT_OPTIONS,
  canEditChallenge,
  capacityLabel,
  challengeDetailDraftFromRow,
  challengeDraftFromRow,
  challengeProjectRows,
  challengeRowActions,
  challengeThemeLabel,
  challengeTitleLabel,
  challengeTypeHint,
  challengeTypeOptions,
  challengeVersionRows,
  cooperationDisplayRows,
  cooperationDraftsFrom,
  cooperationStatusOptions,
  cooperationTierOptions,
  emptyChallengeDetailDraft,
  emptyChallengeDraft,
  emptyResourceDraft,
  emptyScoringWeights,
  fivePieceSummary,
  formatAmount,
  formatDetailTimestamp,
  formatSuggestedSkills,
  isChallengeLocked,
  missingFivePieceFields,
  parseSuggestedSkills,
  publicScopeOptions,
  publishBlockedReason,
  resourceDraftsFrom,
  resourceKindOptions,
  resourceQuantityLabel,
  resourceStatusOptions,
  scoringWeightFormValues,
  scoringWeightsAreEmpty,
  scoringWeightsTotal,
  scoringWeightsTotalHint,
  toChallengeDetailPayload,
  toChallengePayload,
  toCooperationPayload,
  toResourcePayload,
  validateChallengeDetailDraft,
  validateChallengeDraft,
  validateCooperationDrafts,
  validateResourceDrafts,
  validateScoringWeights,
  type ChallengeDetailValues,
  type ChallengeDraftValues,
  type ChallengeResourceDto,
  type CooperationDraft,
  type EnterpriseCooperationDto,
} from '@/lib/organizer-challenges'

// ---------------------------------------------------------------------------
// 测试夹具
// ---------------------------------------------------------------------------

const THEMES = ['新型储能基建', '全球 AI 基建']

function draft(overrides: Partial<ChallengeDraftValues> = {}): ChallengeDraftValues {
  return { ...emptyChallengeDraft(), title: '储能站点数据预测', ...overrides }
}

function resource(overrides: Partial<ChallengeResourceDto> = {}): ChallengeResourceDto {
  return {
    id: 1,
    challengeId: 10,
    kind: ChallengeResourceKind.Database,
    title: '3 个站点历史数据',
    quantity: '3 个站点',
    conditions: '需签保密协议',
    owner: '数据平台',
    status: ChallengeResourceStatus.Committed,
    sortOrder: 0,
    ...overrides,
  }
}

function cooperation(overrides: Partial<EnterpriseCooperationDto> = {}): EnterpriseCooperationDto {
  return {
    id: 1,
    seasonId: 7,
    enterpriseName: '储能联盟',
    tier: 'co_creation',
    grade: '金标',
    totalAmount: 120_000,
    managementFee: 20_000,
    prizePoolAmount: 80_000,
    dataGrant: '可提供脱敏数据',
    publicScope: EnterprisePublicScope.Public,
    status: EnterpriseCooperationStatus.Signed,
    sortOrder: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 五件套
// ---------------------------------------------------------------------------

describe('missingFivePieceFields', () => {
  it('covers the five shared field names in contract order', () => {
    expect(FIVE_PIECE_FIELDS.map((field) => field.label)).toEqual([
      '真实问题',
      '目标客户',
      '最小交付物',
      '资源投入',
      '结果证据规则',
    ])
  })

  it('lists every field when nothing is filled', () => {
    expect(missingFivePieceFields({})).toEqual([
      '真实问题',
      '目标客户',
      '最小交付物',
      '资源投入',
      '结果证据规则',
    ])
  })

  it('treats whitespace-only text as missing', () => {
    expect(
      missingFivePieceFields({
        realProblem: '真实问题',
        targetCustomer: '   ',
        minimumDeliverable: '最小交付物',
        resourceCommitment: '资源投入',
        resultEvidenceRules: '结果证据规则',
      }),
    ).toEqual(['目标客户'])
  })

  it('returns an empty list when all five are filled', () => {
    expect(
      missingFivePieceFields({
        realProblem: '真实问题',
        targetCustomer: '目标客户',
        minimumDeliverable: '最小交付物',
        resourceCommitment: '资源投入',
        resultEvidenceRules: '结果证据规则',
      }),
    ).toEqual([])
  })
})

describe('fivePieceSummary', () => {
  it('renders 完整 with a success tone when the backend says complete', () => {
    expect(fivePieceSummary({ fivePieceComplete: true })).toEqual({
      complete: true,
      label: '完整',
      tone: 'success',
      title: '五件套齐全，可以发布',
    })
  })

  it('counts the missing fields and lists them in the title', () => {
    const summary = fivePieceSummary({
      fivePieceComplete: false,
      missingFields: ['目标客户', '结果证据规则'],
    })
    expect(summary.label).toBe('缺失 2 项')
    expect(summary.tone).toBe('warning')
    expect(summary.title).toBe('还缺：目标客户、结果证据规则')
  })

  it('does not invent field names when the backend sends no list', () => {
    const summary = fivePieceSummary({ fivePieceComplete: false })
    expect(summary.label).toBe('缺失')
    expect(summary.title).toBe('五件套未齐全，暂不能发布')
  })
})

describe('publishBlockedReason', () => {
  it('has no hint when the challenge is complete', () => {
    expect(publishBlockedReason({ fivePieceComplete: true })).toBeUndefined()
  })

  it('explains what to fill in when it is not', () => {
    expect(
      publishBlockedReason({ fivePieceComplete: false, missingFields: ['真实问题'] }),
    ).toBe('还缺：真实问题。补齐后才能发布。')
  })
})

// ---------------------------------------------------------------------------
// 容量 / 金额 / 文本
// ---------------------------------------------------------------------------

describe('capacityLabel', () => {
  it('renders selected / capacity', () => {
    expect(capacityLabel(3, 10)).toBe('3 / 10')
    expect(capacityLabel(0, 10)).toBe('0 / 10')
  })

  it('renders 不限 when capacity is null', () => {
    expect(capacityLabel(0, null)).toBe('0 / 不限')
    expect(capacityLabel(2, null)).toBe('2 / 不限')
  })

  it('falls back to 0 for a missing selected count', () => {
    expect(capacityLabel(null, 10)).toBe('0 / 10')
    expect(capacityLabel(undefined, null)).toBe('0 / 不限')
  })
})

describe('formatAmount', () => {
  it('adds thousands separators', () => {
    expect(formatAmount(120_000)).toBe('120,000')
    expect(formatAmount(1_234_567)).toBe('1,234,567')
    expect(formatAmount(999)).toBe('999')
  })

  it('renders 0 and null as a dash', () => {
    expect(formatAmount(0)).toBe('—')
    expect(formatAmount(null)).toBe('—')
    expect(formatAmount(undefined)).toBe('—')
    expect(formatAmount(Number.NaN)).toBe('—')
  })
})

describe('text fallbacks', () => {
  it('falls back to a placeholder title', () => {
    expect(challengeTitleLabel('  储能命题  ')).toBe('储能命题')
    expect(challengeTitleLabel('')).toBe('未命名命题')
    expect(challengeTitleLabel(null)).toBe('未命名命题')
  })

  it('falls back to 未设置主题', () => {
    expect(challengeThemeLabel('新型储能基建')).toBe('新型储能基建')
    expect(challengeThemeLabel(null)).toBe('未设置主题')
    expect(challengeThemeLabel('  ')).toBe('未设置主题')
  })
})

// ---------------------------------------------------------------------------
// 状态谓词
// ---------------------------------------------------------------------------

describe('canEditChallenge', () => {
  it('locks closed and archived challenges only', () => {
    expect(canEditChallenge(ChallengeStatus.Draft)).toBe(true)
    expect(canEditChallenge(ChallengeStatus.Reference)).toBe(true)
    expect(canEditChallenge(ChallengeStatus.Published)).toBe(true)
    expect(canEditChallenge(ChallengeStatus.Closed)).toBe(false)
    expect(canEditChallenge(ChallengeStatus.Archived)).toBe(false)
  })

  it('exposes the inverse for the resource editor', () => {
    expect(isChallengeLocked(ChallengeStatus.Closed)).toBe(true)
    expect(isChallengeLocked(ChallengeStatus.Published)).toBe(false)
  })
})

describe('challengeRowActions', () => {
  it('offers publish / reference / edit on a draft', () => {
    expect(challengeRowActions(ChallengeStatus.Draft)).toEqual(['publish', 'reference', 'edit'])
  })

  it('offers publish / edit on a reference challenge', () => {
    expect(challengeRowActions(ChallengeStatus.Reference)).toEqual(['publish', 'edit'])
  })

  it('offers edit / close / archive on a published challenge', () => {
    expect(challengeRowActions(ChallengeStatus.Published)).toEqual(['edit', 'close', 'archive'])
  })

  it('offers only archive on a closed challenge', () => {
    expect(challengeRowActions(ChallengeStatus.Closed)).toEqual(['archive'])
  })

  it('offers nothing on an archived challenge', () => {
    expect(challengeRowActions(ChallengeStatus.Archived)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 命题草稿校验 / 请求体
// ---------------------------------------------------------------------------

describe('validateChallengeDraft', () => {
  it('accepts a draft with only a title', () => {
    expect(validateChallengeDraft(draft(), { themes: THEMES })).toEqual({})
  })

  it('requires a title of 2–255 characters', () => {
    expect(validateChallengeDraft(draft({ title: '  ' }), { themes: THEMES }).title).toBe(
      '请填写命题标题',
    )
    expect(validateChallengeDraft(draft({ title: '储' }), { themes: THEMES }).title).toBe(
      '命题标题至少 2 个字符',
    )
    expect(
      validateChallengeDraft(draft({ title: '储'.repeat(256) }), { themes: THEMES }).title,
    ).toBe('命题标题最多 255 个字符')
  })

  it('does not require the other four five-piece fields (they only gate publishing)', () => {
    const errors = validateChallengeDraft(draft(), { themes: THEMES })
    expect(errors).not.toHaveProperty('realProblem')
    expect(errors).not.toHaveProperty('resourceCommitment')
  })

  it('rejects a type outside CHALLENGE_TYPES', () => {
    expect(validateChallengeDraft(draft({ type: 'not_a_type' }), { themes: THEMES }).type).toBe(
      '请选择有效的命题类型',
    )
    for (const type of CHALLENGE_TYPES) {
      expect(validateChallengeDraft(draft({ type }), { themes: THEMES }).type).toBeUndefined()
    }
  })

  it('accepts an empty theme but rejects one the season does not have', () => {
    expect(validateChallengeDraft(draft({ theme: '' }), { themes: THEMES }).theme).toBeUndefined()
    expect(
      validateChallengeDraft(draft({ theme: THEMES[0] }), { themes: THEMES }).theme,
    ).toBeUndefined()
    expect(validateChallengeDraft(draft({ theme: '不存在' }), { themes: THEMES }).theme).toBe(
      '赛季主题必须取自本赛季已配置的主题',
    )
  })

  it('explains that themes must be configured first when the season has none', () => {
    expect(validateChallengeDraft(draft({ theme: '任意' }), { themes: [] }).theme).toBe(
      '本赛季还没有赛季主题，先到「赛季设置」里添加',
    )
  })

  it('validates the capacity range from shared limits', () => {
    expect(
      validateChallengeDraft(draft({ capacity: '' }), { themes: THEMES }).capacity,
    ).toBeUndefined()
    expect(
      validateChallengeDraft(draft({ capacity: '1' }), { themes: THEMES }).capacity,
    ).toBeUndefined()
    expect(
      validateChallengeDraft(draft({ capacity: String(CHALLENGE_CAPACITY_LIMITS.max) }), {
        themes: THEMES,
      }).capacity,
    ).toBeUndefined()
    expect(validateChallengeDraft(draft({ capacity: 'abc' }), { themes: THEMES }).capacity).toBe(
      '命题容量必须是正整数',
    )
    expect(validateChallengeDraft(draft({ capacity: '0' }), { themes: THEMES }).capacity).toBe(
      `命题容量必须在 ${CHALLENGE_CAPACITY_LIMITS.min}–${CHALLENGE_CAPACITY_LIMITS.max} 之间`,
    )
    expect(
      validateChallengeDraft(draft({ capacity: String(CHALLENGE_CAPACITY_LIMITS.max + 1) }), {
        themes: THEMES,
      }).capacity,
    ).toBe(`命题容量必须在 ${CHALLENGE_CAPACITY_LIMITS.min}–${CHALLENGE_CAPACITY_LIMITS.max} 之间`)
  })
})

describe('toChallengePayload', () => {
  it('trims text and turns empty optional fields into null', () => {
    expect(
      toChallengePayload({
        title: '  储能站点数据预测  ',
        type: '',
        theme: '',
        capacity: '',
        realProblem: '  ',
        resourceCommitment: '',
      }),
    ).toEqual({
      title: '储能站点数据预测',
      type: null,
      theme: null,
      capacity: null,
      realProblem: null,
      resourceCommitment: null,
    })
  })

  it('keeps the filled fields and parses capacity as a number', () => {
    expect(
      toChallengePayload({
        title: '储能命题',
        type: 'data_research',
        theme: THEMES[0],
        capacity: '12',
        realProblem: '数据不可得',
        resourceCommitment: '3 个站点数据',
      }),
    ).toEqual({
      title: '储能命题',
      type: 'data_research',
      theme: THEMES[0],
      capacity: 12,
      realProblem: '数据不可得',
      resourceCommitment: '3 个站点数据',
    })
  })
})

describe('challengeDraftFromRow', () => {
  it('prefills the edit form from a table row', () => {
    expect(
      challengeDraftFromRow({
        title: '储能命题',
        type: 'solution_poc',
        theme: THEMES[1],
        realProblem: '问题',
        resourceCommitment: '资源',
        capacity: 8,
      }),
    ).toEqual({
      title: '储能命题',
      type: 'solution_poc',
      theme: THEMES[1],
      realProblem: '问题',
      resourceCommitment: '资源',
      capacity: '8',
    })
  })

  it('renders nulls as empty strings', () => {
    const values = challengeDraftFromRow({
      title: '储能命题',
      type: null,
      theme: null,
      realProblem: null,
      resourceCommitment: null,
      capacity: null,
    })
    expect(values.type).toBe('')
    expect(values.theme).toBe('')
    expect(values.capacity).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 资源清单
// ---------------------------------------------------------------------------

describe('resource drafts', () => {
  it('defaults a new row to 真实需求 / 已承诺', () => {
    expect(emptyResourceDraft()).toMatchObject({
      kind: ChallengeResourceKind.RealDemand,
      status: ChallengeResourceStatus.Committed,
      title: '',
    })
  })

  it('round-trips a DTO into draft strings', () => {
    expect(resourceDraftsFrom([resource()])).toEqual([
      {
        kind: ChallengeResourceKind.Database,
        title: '3 个站点历史数据',
        quantity: '3 个站点',
        conditions: '需签保密协议',
        owner: '数据平台',
        status: ChallengeResourceStatus.Committed,
      },
    ])
  })
})

describe('validateResourceDrafts', () => {
  it('accepts a complete row', () => {
    expect(validateResourceDrafts(resourceDraftsFrom([resource()]))).toEqual({})
  })

  it('requires a resource name', () => {
    const rows = resourceDraftsFrom([resource({ title: '  ' })])
    expect(validateResourceDrafts(rows)['0.title']).toBe('请填写资源名称')
  })

  it('rejects an unknown kind or status', () => {
    const rows = [{ ...resourceDraftsFrom([resource()])[0], kind: 'nope', status: 'nope' }]
    const errors = validateResourceDrafts(rows)
    expect(errors['0.kind']).toBe('请选择有效的资源类别')
    expect(errors['0.status']).toBe('请选择有效的资源状态')
  })

  it('enforces MAX_CHALLENGE_RESOURCES', () => {
    const rows = Array.from({ length: MAX_CHALLENGE_RESOURCES + 1 }, () =>
      resourceDraftsFrom([resource()])[0],
    )
    expect(validateResourceDrafts(rows).items).toBe(`资源最多 ${MAX_CHALLENGE_RESOURCES} 条`)
  })
})

describe('toResourcePayload', () => {
  it('keeps the array order and nulls the empty optional strings', () => {
    const rows = [
      { ...resourceDraftsFrom([resource()])[0], quantity: '  ', conditions: '', owner: '  ' },
      resourceDraftsFrom([
        resource({ title: '专家渠道', kind: ChallengeResourceKind.ExpertChannel }),
      ])[0],
    ]
    const payload = toResourcePayload(rows)
    expect(payload.items).toHaveLength(2)
    expect(payload.items[0]).toEqual({
      kind: ChallengeResourceKind.Database,
      title: '3 个站点历史数据',
      quantity: null,
      conditions: null,
      owner: null,
      status: ChallengeResourceStatus.Committed,
    })
    expect(payload.items[1].title).toBe('专家渠道')
  })
})

describe('resourceQuantityLabel', () => {
  it('prefers the quantity summary', () => {
    expect(resourceQuantityLabel({ quantity: '3 个站点', conditions: '需签保密协议' })).toBe(
      '3 个站点',
    )
  })

  it('falls back to the conditions when there is no quantity', () => {
    expect(resourceQuantityLabel({ quantity: null, conditions: '需签保密协议' })).toBe(
      '需签保密协议',
    )
  })

  it('falls back to a dash when both are empty', () => {
    expect(resourceQuantityLabel({ quantity: '  ', conditions: null })).toBe('—')
  })
})

// ---------------------------------------------------------------------------
// 企业合作配置
// ---------------------------------------------------------------------------

function cooperationDraft(overrides: Partial<CooperationDraft> = {}): CooperationDraft {
  return {
    ...cooperationDraftsFrom([cooperation()])[0],
    ...overrides,
  }
}

describe('cooperationDraftsFrom', () => {
  it('turns amounts into strings and nulls into empty strings', () => {
    expect(cooperationDraftsFrom([cooperation({ grade: null, dataGrant: null })])[0]).toEqual({
      enterpriseName: '储能联盟',
      tier: 'co_creation',
      grade: '',
      totalAmount: '120000',
      managementFee: '20000',
      prizePoolAmount: '80000',
      dataGrant: '',
      publicScope: EnterprisePublicScope.Public,
      status: EnterpriseCooperationStatus.Signed,
    })
  })
})

describe('validateCooperationDrafts', () => {
  it('accepts a complete row', () => {
    expect(validateCooperationDrafts([cooperationDraft()])).toEqual({})
  })

  it('requires an enterprise name', () => {
    expect(
      validateCooperationDrafts([cooperationDraft({ enterpriseName: ' ' })])['0.enterpriseName'],
    ).toBe('请填写企业名称')
  })

  it('validates each amount independently', () => {
    const errors = validateCooperationDrafts([
      cooperationDraft({ totalAmount: 'abc', managementFee: '-1', prizePoolAmount: '999999999' }),
    ])
    expect(errors['0.totalAmount']).toBe('总费用必须是整数（元）')
    expect(errors['0.managementFee']).toBe('管理费必须是整数（元）')
    expect(errors['0.prizePoolAmount']).toBe('奖金池出资必须在 0–100000000 元之间')
  })

  it('does NOT require the three amounts to add up (CHG-006: management fee is separate)', () => {
    // 三项金额口径不同，任何「加总对账」都会把合法的商务配置判成错误。
    const errors = validateCooperationDrafts([
      cooperationDraft({ totalAmount: '100', managementFee: '90', prizePoolAmount: '10' }),
    ])
    expect(errors).toEqual({})
  })

  it('rejects unknown enum values', () => {
    const errors = validateCooperationDrafts([
      cooperationDraft({ tier: 'nope', publicScope: 'nope', status: 'nope' }),
    ])
    expect(errors['0.tier']).toBe('请选择有效的合作档位')
    expect(errors['0.publicScope']).toBe('请选择有效的公开授权')
    expect(errors['0.status']).toBe('请选择有效的合作状态')
  })
})

describe('toCooperationPayload', () => {
  it('treats empty amounts as 0 and keeps the three amounts separate', () => {
    const payload = toCooperationPayload([
      cooperationDraft({ totalAmount: '', managementFee: '  ', prizePoolAmount: '80000' }),
    ])
    expect(payload.items[0]).toMatchObject({
      totalAmount: 0,
      managementFee: 0,
      prizePoolAmount: 80_000,
    })
  })

  it('nulls empty optional text', () => {
    const payload = toCooperationPayload([cooperationDraft({ grade: ' ', dataGrant: '' })])
    expect(payload.items[0].grade).toBeNull()
    expect(payload.items[0].dataGrant).toBeNull()
  })
})

describe('cooperationDisplayRows', () => {
  it('formats the three amounts with separators and never derives one from another', () => {
    const [row] = cooperationDisplayRows([cooperation()])
    expect(row.totalAmount).toBe('120,000')
    expect(row.managementFee).toBe('20,000')
    expect(row.prizePoolAmount).toBe('80,000')
    // 三项各自独立：总费用不等于管理费 + 奖金池时也原样展示。
    const toNumber = (value: string) => Number(value.replace(/,/g, ''))
    expect(toNumber(row.managementFee) + toNumber(row.prizePoolAmount)).not.toBe(
      toNumber(row.totalAmount),
    )
  })

  it('renders zero amounts and missing text as dashes', () => {
    const [row] = cooperationDisplayRows([
      cooperation({ totalAmount: 0, managementFee: 0, prizePoolAmount: 0, dataGrant: null }),
    ])
    expect(row.totalAmount).toBe('—')
    expect(row.managementFee).toBe('—')
    expect(row.prizePoolAmount).toBe('—')
    expect(row.dataGrant).toBe('—')
  })

  it('labels the tier with its grade and translates the enums', () => {
    const [row] = cooperationDisplayRows([cooperation()])
    expect(row.tierLabel).toBe(enterpriseCooperationTierLabel('co_creation', '金标'))
    expect(row.tierLabel).toBe('联合出品·金标')
    expect(row.publicScopeLabel).toBe('可公开企业名称与命题')
    expect(row.statusLabel).toBe('已签约')
    expect(row.statusTone).toBe('success')
  })

  it('tones an unsigned cooperation as a warning', () => {
    const [row] = cooperationDisplayRows([
      cooperation({ status: EnterpriseCooperationStatus.Intent }),
    ])
    expect(row.statusLabel).toBe('洽谈中')
    expect(row.statusTone).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// 下拉选项
// ---------------------------------------------------------------------------

describe('select options', () => {
  it('offers 未分类 plus the four challenge types', () => {
    const options = challengeTypeOptions()
    expect(options).toHaveLength(CHALLENGE_TYPES.length + 1)
    expect(options[0]).toEqual({ value: '', label: '未分类' })
    expect(options.slice(1).map((option) => option.value)).toEqual([...CHALLENGE_TYPES])
    expect(options.slice(1).map((option) => option.label)).toEqual([
      '商单验证型',
      '上下游合作型',
      '解决方案 / POC 型',
      '数据 / 研究验证型',
    ])
  })

  it('offers the six resource kinds and six statuses from shared', () => {
    expect(resourceKindOptions().map((option) => option.value)).toEqual([...CHALLENGE_RESOURCE_KINDS])
    expect(resourceStatusOptions().map((option) => option.value)).toEqual([
      ...CHALLENGE_RESOURCE_STATUSES,
    ])
    expect(resourceStatusOptions()[0]).toEqual({ value: 'committed', label: '已承诺' })
  })

  it('offers the four cooperation tiers', () => {
    expect(cooperationTierOptions().map((option) => option.value)).toEqual([
      ...ENTERPRISE_COOPERATION_TIERS,
    ])
  })

  it('offers both public scopes and both cooperation statuses', () => {
    expect(publicScopeOptions().map((option) => option.value)).toEqual([
      EnterprisePublicScope.Public,
      EnterprisePublicScope.Anonymous,
    ])
    expect(cooperationStatusOptions().map((option) => option.value)).toEqual([
      EnterpriseCooperationStatus.Signed,
      EnterpriseCooperationStatus.Intent,
    ])
  })
})

describe('challengeTypeHint', () => {
  it('returns the goal and results for a known type', () => {
    expect(challengeTypeHint('commercial_validation')).toBe(
      '验证目标：找到客户并形成付费；典型结果：订单、交付、回款、复购',
    )
  })

  it('returns undefined when no type is chosen', () => {
    expect(challengeTypeHint('')).toBeUndefined()
    expect(challengeTypeHint(null)).toBeUndefined()
    expect(challengeTypeHint('unknown')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 命题详情表单：回填 / 校验 / 请求体（契约 §1.1、§3.3、§4.2）
// ---------------------------------------------------------------------------

/** 详情表单夹具：默认全部空（未填写），按需覆盖。 */
function detail(overrides: Partial<ChallengeDetailValues> = {}): ChallengeDetailValues {
  return { ...emptyChallengeDetailDraft(), ...overrides }
}

/** 一份合法的五维权重（取 shared 的默认权重，合计 100）。 */
function defaultWeights(): Record<ChallengeScoringDimension, string> {
  return scoringWeightFormValues(CHALLENGE_SCORING_DEFAULT_WEIGHTS)
}

describe('emptyChallengeDetailDraft', () => {
  it('starts with every text field empty and no weights configured', () => {
    const values = emptyChallengeDetailDraft()
    expect(values.summary).toBe('')
    expect(values.suggestedSkills).toBe('')
    expect(values.teamCapacity).toBe('')
    expect(values.singleWorkCap).toBe('')
    expect(values.changeNote).toBe('')
    expect(values.weights).toEqual(emptyScoringWeights())
    for (const field of CHALLENGE_RIGHTS_FIELDS) {
      expect(values[field]).toBe('')
    }
  })

  it('has a weight input per shared dimension', () => {
    expect(Object.keys(emptyScoringWeights())).toEqual([...CHALLENGE_SCORING_DIMENSIONS])
    expect(SCORING_WEIGHT_OPTIONS.map((option) => option.dimension)).toEqual([
      ...CHALLENGE_SCORING_DIMENSIONS,
    ])
  })

  it('exposes the seven rights fields in shared order', () => {
    expect(CHALLENGE_RIGHTS_FORM_FIELDS.map((field) => field.key)).toEqual([
      ...CHALLENGE_RIGHTS_FIELDS,
    ])
    expect(CHALLENGE_RIGHTS_FORM_FIELDS[0]).toEqual({ key: 'rightsPublicScope', label: '公开范围' })
  })
})

describe('challengeDetailDraftFromRow', () => {
  it('prefills from a row that carries the new fields', () => {
    const values = challengeDetailDraftFromRow({
      summary: '谁会为储能柜付第一笔钱？',
      background: '背景',
      industry: '储能集成商',
      scope: '范围',
      outOfScope: '不做什么',
      monthlyGoal: '一个月成果',
      suggestedSkills: ['储能系统', '数据分析'],
      teamCapacity: 6,
      ownerName: '王工',
      responseSla: '工作日 48 小时内',
      scoringWeights: { ...CHALLENGE_SCORING_DEFAULT_WEIGHTS },
      singleWorkCap: 300,
      rightsPublicScope: '公开范围',
      rightsConfidentiality: '保密',
      rightsIp: '知识产权',
      rightsEnterpriseUsage: '企业使用权',
      rightsProcurement: '采购',
      rightsSpecialTerms: '特殊条件',
      rightsExclusivity: '排他',
    })

    expect(values.summary).toBe('谁会为储能柜付第一笔钱？')
    expect(values.suggestedSkills).toBe('储能系统、数据分析')
    expect(values.teamCapacity).toBe('6')
    expect(values.singleWorkCap).toBe('300')
    expect(values.rightsExclusivity).toBe('排他')
    expect(values.weights[ChallengeScoringDimension.CommercialResult]).toBe('35')
    expect(values.changeNote).toBe('')
  })

  it('treats a missing / null backend payload as 未填写 instead of crashing', () => {
    const values = challengeDetailDraftFromRow({})
    expect(values.summary).toBe('')
    expect(values.suggestedSkills).toBe('')
    expect(values.teamCapacity).toBe('')
    expect(values.weights).toEqual(emptyScoringWeights())

    const nulls = challengeDetailDraftFromRow({
      summary: null,
      suggestedSkills: [],
      teamCapacity: null,
      scoringWeights: null,
      singleWorkCap: null,
      rightsIp: null,
    })
    expect(nulls.teamCapacity).toBe('')
    expect(nulls.singleWorkCap).toBe('')
    expect(nulls.weights).toEqual(emptyScoringWeights())
    expect(nulls.rightsIp).toBe('')
  })

  it('keeps the difference between 未配置 and a configured weight of 0', () => {
    expect(scoringWeightFormValues(null)).toEqual(emptyScoringWeights())
    const configured = scoringWeightFormValues({
      [ChallengeScoringDimension.CommercialResult]: 0,
    })
    expect(configured[ChallengeScoringDimension.CommercialResult]).toBe('0')
    expect(configured[ChallengeScoringDimension.DeliveryQuality]).toBe('')
  })
})

describe('suggested skills parsing', () => {
  it('accepts Chinese / English commas, 顿号 and newlines', () => {
    expect(parseSuggestedSkills('储能系统,数据分析、硬件集成\n嵌入式')).toEqual([
      '储能系统',
      '数据分析',
      '硬件集成',
      '嵌入式',
    ])
  })

  it('trims, drops empties and round-trips through the display format', () => {
    expect(parseSuggestedSkills('  储能系统 ， ，  ')).toEqual(['储能系统'])
    expect(parseSuggestedSkills('')).toEqual([])
    expect(formatSuggestedSkills(['储能系统', '  ', '数据分析'])).toBe('储能系统、数据分析')
    expect(formatSuggestedSkills(null)).toBe('')
  })
})

describe('scoringWeightsTotal / hint', () => {
  it('sums the five dimensions and treats blanks as 0', () => {
    expect(scoringWeightsTotal(emptyScoringWeights())).toBe(0)
    expect(scoringWeightsTotal(defaultWeights())).toBe(CHALLENGE_SCORING_WEIGHT_TOTAL)
    expect(
      scoringWeightsTotal({
        ...emptyScoringWeights(),
        [ChallengeScoringDimension.CommercialResult]: '40',
      }),
    ).toBe(40)
  })

  it('reports how far the total is from 100 in both directions', () => {
    const under = {
      ...emptyScoringWeights(),
      [ChallengeScoringDimension.CommercialResult]: '60',
      [ChallengeScoringDimension.DeliveryQuality]: '20',
    }
    expect(scoringWeightsTotalHint(under)).toBe('五维权重合计 80，还差 20 才到 100，保存前需要补齐')

    const over = {
      ...emptyScoringWeights(),
      [ChallengeScoringDimension.CommercialResult]: '100',
      [ChallengeScoringDimension.DeliveryQuality]: '20',
    }
    expect(scoringWeightsTotalHint(over)).toBe('五维权重合计 120，超出 20，保存前需要调整')
  })

  it('stays quiet when unconfigured or exactly 100', () => {
    expect(scoringWeightsTotalHint(emptyScoringWeights())).toBeUndefined()
    expect(scoringWeightsTotalHint(defaultWeights())).toBeUndefined()
    expect(scoringWeightsAreEmpty(emptyScoringWeights())).toBe(true)
    expect(scoringWeightsAreEmpty(defaultWeights())).toBe(false)
  })

  it('treats all zeros as unconfigured', () => {
    expect(
      scoringWeightsAreEmpty(
        CHALLENGE_SCORING_DIMENSIONS.reduce(
          (acc, dimension) => ({ ...acc, [dimension]: '0' }),
          {} as Record<ChallengeScoringDimension, string>,
        ),
      ),
    ).toBe(true)
  })
})

describe('validateScoringWeights', () => {
  it('accepts the shared default weights (total 100)', () => {
    expect(validateScoringWeights(defaultWeights())).toEqual({ weightOf: {} })
  })

  it('accepts an unconfigured form (all empty)', () => {
    expect(validateScoringWeights(emptyScoringWeights())).toEqual({ weightOf: {} })
  })

  it('rejects a non-integer or out-of-range weight on the matching dimension', () => {
    const errors = validateScoringWeights({
      ...emptyScoringWeights(),
      [ChallengeScoringDimension.CommercialResult]: '35.5',
      [ChallengeScoringDimension.DeliveryQuality]: '101',
    })
    expect(errors.weightOf[ChallengeScoringDimension.CommercialResult]).toBe(
      '权重必须是 0–100 的整数',
    )
    expect(errors.weightOf[ChallengeScoringDimension.DeliveryQuality]).toBe(
      '权重必须在 0–100 之间',
    )
  })

  it('requires the total to be exactly 100 and explains the gap', () => {
    const errors = validateScoringWeights({
      ...emptyScoringWeights(),
      [ChallengeScoringDimension.CommercialResult]: '60',
    })
    expect(errors.weights).toBe('五维权重合计必须等于 100，当前 60（还差 40）')
    expect(errors.weightOf).toEqual({})

    const over = validateScoringWeights({
      ...emptyScoringWeights(),
      [ChallengeScoringDimension.CommercialResult]: '100',
      [ChallengeScoringDimension.DeliveryQuality]: '25',
    })
    expect(over.weights).toBe('五维权重合计必须等于 100，当前 125（超出 25）')
  })
})

describe('validateChallengeDetailDraft', () => {
  it('accepts a fully empty form (none of these fields gate publishing)', () => {
    expect(validateChallengeDetailDraft(emptyChallengeDetailDraft())).toEqual({})
  })

  it('enforces CHALLENGE_CARD_LIMITS on the text fields', () => {
    const errors = validateChallengeDetailDraft(
      detail({
        summary: 'x'.repeat(CHALLENGE_CARD_LIMITS.summary.max + 1),
        industry: 'x'.repeat(CHALLENGE_CARD_LIMITS.industry.max + 1),
        ownerName: 'x'.repeat(CHALLENGE_CARD_LIMITS.ownerName.max + 1),
      }),
    )
    expect(errors.summary).toBe(`简介最多 ${CHALLENGE_CARD_LIMITS.summary.max} 个字符`)
    expect(errors.industry).toBe(
      `目标客户 / 产业对象最多 ${CHALLENGE_CARD_LIMITS.industry.max} 个字符`,
    )
    expect(errors.ownerName).toBe(`负责人最多 ${CHALLENGE_CARD_LIMITS.ownerName.max} 个字符`)
  })

  it('limits suggested skills to 10 entries of 30 characters', () => {
    const many = Array.from(
      { length: CHALLENGE_CARD_LIMITS.suggestedSkills.max + 1 },
      (_, index) => `技能${index}`,
    ).join('、')
    expect(validateChallengeDetailDraft(detail({ suggestedSkills: many })).suggestedSkills).toBe(
      `建议技能最多 ${CHALLENGE_CARD_LIMITS.suggestedSkills.max} 条`,
    )

    const long = 'x'.repeat(CHALLENGE_CARD_LIMITS.suggestedSkills.itemMax + 1)
    expect(validateChallengeDetailDraft(detail({ suggestedSkills: long })).suggestedSkills).toBe(
      `单条建议技能最多 ${CHALLENGE_CARD_LIMITS.suggestedSkills.itemMax} 个字符`,
    )
  })

  it('validates team capacity and single work cap ranges', () => {
    expect(validateChallengeDetailDraft(detail({ teamCapacity: 'abc' })).teamCapacity).toBe(
      '团队容量必须是整数',
    )
    expect(validateChallengeDetailDraft(detail({ teamCapacity: '0' })).teamCapacity).toBe(
      `团队容量必须在 ${CHALLENGE_CARD_LIMITS.teamCapacity.min}–${CHALLENGE_CARD_LIMITS.teamCapacity.max} 之间`,
    )
    expect(
      validateChallengeDetailDraft(detail({ singleWorkCap: '10001' })).singleWorkCap,
    ).toBe(
      `单次评分上限必须在 ${CHALLENGE_CARD_LIMITS.singleWorkCap.min}–${CHALLENGE_CARD_LIMITS.singleWorkCap.max} 之间`,
    )
    expect(validateChallengeDetailDraft(detail({ singleWorkCap: '' })).singleWorkCap).toBeUndefined()
  })

  it('surfaces the weight errors through the same error object', () => {
    const errors = validateChallengeDetailDraft(
      detail({
        weights: {
          ...emptyScoringWeights(),
          [ChallengeScoringDimension.CommercialResult]: '60',
        },
      }),
    )
    expect(errors.weights).toBe('五维权重合计必须等于 100，当前 60（还差 40）')
  })

  it('limits each of the seven rights fields', () => {
    const errors = validateChallengeDetailDraft(
      detail({ rightsIp: 'x'.repeat(CHALLENGE_CARD_LIMITS.rights.max + 1) }),
    )
    expect(errors.rightsIp).toBe(`最多 ${CHALLENGE_CARD_LIMITS.rights.max} 个字符`)
  })

  it('limits the change note to 255 characters', () => {
    expect(validateChallengeDetailDraft(detail({ changeNote: 'x'.repeat(256) })).changeNote).toBe(
      '变更说明最多 255 个字符',
    )
  })
})

describe('toChallengeDetailPayload', () => {
  it('trims text and turns blanks into null', () => {
    const payload = toChallengeDetailPayload(
      detail({ summary: '  简介  ', background: '   ', ownerName: '' }),
    )
    expect(payload.summary).toBe('简介')
    expect(payload.background).toBeNull()
    expect(payload.ownerName).toBeNull()
    expect(payload.rightsPublicScope).toBeNull()
  })

  it('splits the skills string into an array and nulls the numeric blanks', () => {
    const payload = toChallengeDetailPayload(
      detail({ suggestedSkills: '储能系统、数据分析', teamCapacity: '', singleWorkCap: '  ' }),
    )
    expect(payload.suggestedSkills).toEqual(['储能系统', '数据分析'])
    expect(payload.teamCapacity).toBeNull()
    expect(payload.singleWorkCap).toBeNull()
  })

  it('parses the numeric fields', () => {
    const payload = toChallengeDetailPayload(
      detail({ teamCapacity: '6', singleWorkCap: '300' }),
    )
    expect(payload.teamCapacity).toBe(6)
    expect(payload.singleWorkCap).toBe(300)
  })

  it('sends null weights when unconfigured, and numbers otherwise', () => {
    expect(toChallengeDetailPayload(detail()).scoringWeights).toBeNull()
    expect(toChallengeDetailPayload(detail({ weights: defaultWeights() })).scoringWeights).toEqual(
      { ...CHALLENGE_SCORING_DEFAULT_WEIGHTS },
    )
  })

  it('only includes changeNote when it is filled in', () => {
    expect(toChallengeDetailPayload(detail())).not.toHaveProperty('changeNote')
    expect(
      toChallengeDetailPayload(detail({ changeNote: '  补充评分权重  ' })).changeNote,
    ).toBe('补充评分权重')
  })

  it('covers all seven rights fields', () => {
    const payload = toChallengeDetailPayload(
      detail({
        rightsPublicScope: '公开',
        rightsConfidentiality: '保密',
        rightsIp: '知识产权',
        rightsEnterpriseUsage: '企业使用',
        rightsProcurement: '采购',
        rightsSpecialTerms: '特殊条件',
        rightsExclusivity: '排他',
      }),
    )
    expect(payload).toMatchObject({
      rightsPublicScope: '公开',
      rightsConfidentiality: '保密',
      rightsIp: '知识产权',
      rightsEnterpriseUsage: '企业使用',
      rightsProcurement: '采购',
      rightsSpecialTerms: '特殊条件',
      rightsExclusivity: '排他',
    })
  })
})

// ---------------------------------------------------------------------------
// 版本记录 / 选择本命题的项目
// ---------------------------------------------------------------------------

describe('challengeVersionRows', () => {
  it('flattens every challenge with a 命题 column and newest version first', () => {
    const rows = challengeVersionRows([
      {
        id: 1,
        title: '储能命题',
        versions: [
          { id: 11, version: 1, note: '初版命题卡', changedBy: 'u_a', createdAt: '2026-11-01T02:00:00.000Z' },
          { id: 12, version: 2, note: '补充权重', changedBy: 'u_b', createdAt: '2026-11-02T02:00:00.000Z' },
        ],
      },
      {
        id: 2,
        title: 'AI 命题',
        versions: [
          { id: 21, version: 1, note: '发布命题', changedBy: 'u_c', createdAt: '2026-11-03T02:00:00.000Z' },
        ],
      },
    ])

    expect(rows.map((row) => [row.challengeTitle, row.versionLabel])).toEqual([
      ['储能命题', 'v2'],
      ['储能命题', 'v1'],
      ['AI 命题', 'v1'],
    ])
    expect(rows[0].note).toBe('补充权重')
    expect(rows[0].changedBy).toBe('u_b')
    expect(rows[0].timeLabel).toMatch(/^2026-11-02 \d{2}:\d{2}$/)
  })

  it('tolerates a backend that has not shipped versions yet', () => {
    expect(challengeVersionRows([{ id: 1, title: '储能命题' }])).toEqual([])
    expect(challengeVersionRows([{ id: 1, title: '储能命题', versions: [] }])).toEqual([])
  })

  it('falls back for missing notes / operators and bad timestamps', () => {
    const [row] = challengeVersionRows([
      {
        id: 1,
        title: '储能命题',
        versions: [
          { id: 1, version: 1, note: '  ', changedBy: '', createdAt: 'not-a-date' },
        ],
      },
    ])
    expect(row.note).toBe('—')
    expect(row.changedBy).toBe('—')
    expect(row.timeLabel).toBe('待定')
  })
})

describe('formatDetailTimestamp', () => {
  it('formats in Asia/Shanghai and falls back to 待定', () => {
    expect(formatDetailTimestamp('2026-11-08T12:10:00.000Z')).toBe('2026-11-08 20:10')
    expect(formatDetailTimestamp(null)).toBe('待定')
    expect(formatDetailTimestamp('')).toBe('待定')
    expect(formatDetailTimestamp('nope')).toBe('待定')
  })
})

describe('challengeProjectRows', () => {
  it('flattens projects with the challenge title and the shared stage label', () => {
    const rows = challengeProjectRows([
      {
        id: 1,
        title: '储能命题',
        projects: [
          {
            seasonProjectId: 31,
            projectId: 7,
            name: '峰谷电价计算器',
            tagline: null,
            stage: 'grow',
            ownerName: '江河',
          },
        ],
      },
      { id: 2, title: 'AI 命题', projects: [] },
    ])

    expect(rows).toEqual([
      {
        seasonProjectId: 31,
        projectId: 7,
        challengeId: 1,
        challengeTitle: '储能命题',
        name: '峰谷电价计算器',
        stageLabel: seasonProjectStageLabel('grow'),
        ownerName: '江河',
      },
    ])
    expect(rows[0].stageLabel).toBe('生长')
  })

  it('tolerates a backend that has not shipped projects yet', () => {
    expect(challengeProjectRows([{ id: 1, title: '储能命题' }])).toEqual([])
  })

  it('falls back for a blank project name / owner and an unknown stage', () => {
    const [row] = challengeProjectRows([
      {
        id: 1,
        title: '储能命题',
        projects: [
          {
            seasonProjectId: 31,
            projectId: 7,
            name: '  ',
            tagline: null,
            stage: 'unknown-stage',
            ownerName: null,
          },
        ],
      },
    ])
    expect(row.name).toBe('未命名项目')
    expect(row.ownerName).toBe('—')
    expect(row.stageLabel).toBe('unknown-stage')
  })
})
