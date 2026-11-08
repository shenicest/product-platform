import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_CAPACITY_LIMITS,
  CHALLENGE_RESOURCE_KINDS,
  CHALLENGE_RESOURCE_STATUSES,
  CHALLENGE_TYPES,
  ChallengeResourceKind,
  ChallengeResourceStatus,
  ChallengeStatus,
  ENTERPRISE_COOPERATION_TIERS,
  EnterpriseCooperationStatus,
  EnterprisePublicScope,
  MAX_CHALLENGE_RESOURCES,
  enterpriseCooperationTierLabel,
} from '@shenicest/shared'
import {
  FIVE_PIECE_FIELDS,
  canEditChallenge,
  capacityLabel,
  challengeDraftFromRow,
  challengeRowActions,
  challengeThemeLabel,
  challengeTitleLabel,
  challengeTypeHint,
  challengeTypeOptions,
  cooperationDisplayRows,
  cooperationDraftsFrom,
  cooperationStatusOptions,
  cooperationTierOptions,
  emptyChallengeDraft,
  emptyResourceDraft,
  fivePieceSummary,
  formatAmount,
  isChallengeLocked,
  missingFivePieceFields,
  publicScopeOptions,
  publishBlockedReason,
  resourceDraftsFrom,
  resourceKindOptions,
  resourceQuantityLabel,
  resourceStatusOptions,
  toChallengePayload,
  toCooperationPayload,
  toResourcePayload,
  validateChallengeDraft,
  validateCooperationDrafts,
  validateResourceDrafts,
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
