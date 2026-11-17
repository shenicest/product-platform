import { describe, expect, it } from 'vitest'
import {
  approveBlocker,
  canAccessPlatformConsole,
  canApproveSeason,
  canWritePlatformConsole,
  formatScheduleRange,
  isPendingApproval,
  memberCountLabel,
  pendingApprovalRows,
  platformSeasonStatusMeta,
  platformTabFromPathname,
  platformTabHref,
  readinessRatio,
  readinessRatioFromChecks,
  seasonsOfOrg,
  shouldShowPlatformEntry,
  validateMemberUserId,
  validateOrgName,
  type PlatformSeasonRow,
} from '@/lib/platform-console'

const NOW = new Date('2026-11-15T12:00:00+08:00')

function row(overrides: Partial<PlatformSeasonRow> = {}): PlatformSeasonRow {
  return {
    id: 1,
    code: 'S01',
    name: '测试赛季',
    type: 'season',
    city: null,
    status: 'upcoming',
    themes: [],
    schedule: null,
    organizerOrgs: [{ id: 3, name: 'Proto Seeds' }],
    pinned: false,
    approvedAt: null,
    awardingEntity: null,
    participantCapacity: null,
    participantCount: 0,
    publishedChallengeCount: 0,
    pendingApproval: true,
    readinessReady: true,
    readinessPassed: 9,
    readinessTotal: 9,
    applicationCount: 0,
    acceptedCount: 0,
    ...overrides,
  }
}

describe('平台后台准入', () => {
  it('对平台管理员与主办方成员都显示入口', () => {
    expect(shouldShowPlatformEntry({ isLoggedIn: true, isOperator: true, isOrganizerMember: false })).toBe(true)
    expect(shouldShowPlatformEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: true })).toBe(true)
    expect(shouldShowPlatformEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: null })).toBe(false)
    expect(shouldShowPlatformEntry({ isLoggedIn: false, isOperator: true, isOrganizerMember: true })).toBe(false)
  })

  it('成员进得来，但没有任何写权限', () => {
    expect(canAccessPlatformConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: true })).toBe(true)
    expect(canAccessPlatformConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
    expect(canWritePlatformConsole(false)).toBe(false)
    expect(canWritePlatformConsole(true)).toBe(true)
  })
})

describe('待批准判定', () => {
  it('待批 = upcoming 且没有 approvedAt', () => {
    expect(isPendingApproval({ status: 'upcoming', approvedAt: null })).toBe(true)
    expect(isPendingApproval({ status: 'upcoming', approvedAt: '2026-11-01T00:00:00.000Z' })).toBe(false)
    expect(isPendingApproval({ status: 'draft', approvedAt: null })).toBe(false)
    expect(isPendingApproval({ status: 'active', approvedAt: null })).toBe(false)
  })

  it('待批用「待批准」而不是「即将开始」', () => {
    expect(platformSeasonStatusMeta({ status: 'upcoming', approvedAt: null })).toEqual({
      label: '待批准',
      tone: 'warning',
    })
    expect(platformSeasonStatusMeta({ status: 'upcoming', approvedAt: '2026-11-01T00:00:00.000Z' }).label).toBe('即将开始')
  })

  it('队列只保留待批行，且不改顺序', () => {
    const rows = [
      row({ id: 1 }),
      row({ id: 2, status: 'active', approvedAt: '2026-10-01T00:00:00.000Z' }),
      row({ id: 3, status: 'upcoming', approvedAt: '2026-11-02T00:00:00.000Z' }),
    ]
    expect(pendingApprovalRows(rows).map((season) => season.id)).toEqual([1])
  })
})

describe('发布门槛', () => {
  it('按后端返回的项数展示，不写死 9', () => {
    expect(readinessRatio({ readinessPassed: 9, readinessTotal: 9, readinessReady: true }).label).toBe('9 / 9')
    // 不计分赛季会免除三项，总数要跟着变。
    expect(readinessRatio({ readinessPassed: 6, readinessTotal: 6, readinessReady: true }).label).toBe('6 / 6')
  })

  it('通过数不会盖过总数', () => {
    const ratio = readinessRatio({ readinessPassed: 12, readinessTotal: 9, readinessReady: true })
    expect(ratio.passed).toBe(9)
    expect(ratio.label).toBe('9 / 9')
  })

  it('从就绪度检查项算计数（预览页用的是另一份数据源）', () => {
    const ratio = readinessRatioFromChecks([
      { passed: true },
      { passed: false },
      { passed: true },
    ])
    expect(ratio).toEqual({ passed: 2, total: 3, ready: false, label: '2 / 3' })
    expect(readinessRatioFromChecks([]).label).toBe('0 / 0')
  })

  it('批准要求：管理员 + 待批 + 门槛全过', () => {
    const pending = { status: 'upcoming', approvedAt: null, readinessReady: true }
    expect(canApproveSeason(pending, true)).toBe(true)
    expect(canApproveSeason(pending, false)).toBe(false)
    expect(canApproveSeason({ ...pending, readinessReady: false }, true)).toBe(false)
    expect(canApproveSeason({ ...pending, approvedAt: '2026-11-02T00:00:00.000Z' }, true)).toBe(false)
  })

  it('按钮禁用时说清原因', () => {
    const pending = { status: 'upcoming', approvedAt: null, readinessReady: true }
    expect(approveBlocker(pending, true)).toBeNull()
    expect(approveBlocker(pending, false)).toContain('只有平台管理员')
    expect(approveBlocker({ ...pending, readinessReady: false }, true)).toContain('发布门槛')
    expect(approveBlocker({ ...pending, status: 'draft' }, true)).toContain('待批准')
  })
})

describe('赛程区间文案', () => {
  it('今年内的赛季省略年份', () => {
    expect(formatScheduleRange({
      startAt: '2026-11-01T00:00:00+08:00',
      settleDate: '2026-11-05T00:00:00+08:00',
    }, NOW)).toBe('11月1日 — 11月5日')
  })

  it('往季带上年份，避免被读成今年', () => {
    expect(formatScheduleRange({
      startAt: '2025-09-20T00:00:00+08:00',
      settleDate: '2025-09-21T00:00:00+08:00',
    }, NOW)).toBe('2025年9月20日 — 2025年9月21日')
  })

  it('跨年时结束日期单独带上年份', () => {
    expect(formatScheduleRange({
      startAt: '2026-12-20T00:00:00+08:00',
      settleDate: '2027-01-20T00:00:00+08:00',
    }, NOW)).toBe('12月20日 — 2027年1月20日')
  })

  it('没有赛程时给「待定」', () => {
    expect(formatScheduleRange(null, NOW)).toBe('待定')
    expect(formatScheduleRange(undefined, NOW)).toBe('待定')
  })

  it('按北京时间取日期，而不是浏览器时区', () => {
    // UTC 的 2026-10-31T17:00Z 是北京时间 11 月 1 日 01:00。
    expect(formatScheduleRange({
      startAt: '2026-10-31T17:00:00Z',
      settleDate: '2026-11-05T00:00:00+08:00',
    }, NOW)).toBe('11月1日 — 11月5日')
  })
})

describe('主办方组织', () => {
  it('按 organizerOrgs 过滤出某个组织主办的赛季', () => {
    const rows = [
      row({ id: 1, organizerOrgs: [{ id: 3, name: 'Proto Seeds' }] }),
      row({ id: 2, organizerOrgs: [{ id: 4, name: 'SheNicest' }] }),
      row({ id: 3, organizerOrgs: [{ id: 3, name: 'Proto Seeds' }, { id: 4, name: 'SheNicest' }] }),
    ]
    expect(seasonsOfOrg(3, rows).map((season) => season.id)).toEqual([1, 3])
    expect(seasonsOfOrg(9, rows)).toEqual([])
  })

  it('人数文案在 0 人时明确说没有成员', () => {
    expect(memberCountLabel(0)).toBe('还没有成员')
    expect(memberCountLabel(2)).toBe('2 名成员')
  })
})

describe('表单校验', () => {
  it('组织名称 trim 后 2—100 字', () => {
    expect(validateOrgName('  ')).toContain('填写')
    expect(validateOrgName('  A ')).toContain('至少 2 个字')
    expect(validateOrgName('SheNicest')).toBeNull()
    expect(validateOrgName('x'.repeat(101))).toContain('最多 100')
  })

  it('成员用户 ID 不能为空', () => {
    expect(validateMemberUserId(' ')).toContain('填写')
    expect(validateMemberUserId('10086')).toBeNull()
  })
})

describe('tab 解析', () => {
  it('预览页仍然高亮「赛季治理」', () => {
    expect(platformTabFromPathname('/operator/boomland/seasons').slug).toBe('seasons')
    expect(platformTabFromPathname('/operator/boomland/seasons/12').slug).toBe('seasons')
  })

  it('认得出组织 tab 与占位 tab', () => {
    expect(platformTabFromPathname('/operator/boomland/orgs').slug).toBe('orgs')
    expect(platformTabFromPathname('/operator/boomland/points').slug).toBe('points')
  })

  it('未知路径回落到默认 tab', () => {
    expect(platformTabFromPathname('/operator/boomland').slug).toBe('seasons')
    expect(platformTabFromPathname('/organizer/overview').slug).toBe('seasons')
  })

  it('tab 地址是真实路由', () => {
    expect(platformTabHref('orgs')).toBe('/operator/boomland/orgs')
  })
})
