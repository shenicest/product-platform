import { describe, expect, it } from 'vitest'
import { SeasonParticipantStatus, WechatStatus } from '@shenicest/shared'
import {
  contactSummary,
  countWechatStatuses,
  formatMonthDayTime,
  participantInitial,
  participantLockReason,
  recorderOf,
  wechatActionsFor,
  wechatStatusMeta,
  type SeasonParticipant,
} from '@/lib/organizer-manual-group'

/**
 * 拉群页的纯函数。
 *
 * 重点是**状态机 → 按钮**这一层：写错一个跳转，用户就会点到一个后端必然 409 的按钮。
 * 所以每个状态都单独钉一条断言，而不是只测「已邀请」这一条。
 */

function participant(overrides: Partial<SeasonParticipant> = {}): SeasonParticipant {
  return {
    id: 1,
    seasonId: 7,
    userId: '101',
    applicationId: 11,
    wechatStatus: WechatStatus.NotInvited,
    wechatInvitedBy: null,
    wechatInvitedAt: null,
    joinedAt: null,
    status: SeasonParticipantStatus.Active,
    withdrawnAt: null,
    withdrawnBy: null,
    withdrawReason: null,
    applicant: { userId: '101', name: '周默', avatarUrl: null },
    contact: { wechat: 'zhou_b1' },
    reviewedAt: '2026-11-03T07:00:00.000Z',
    wechatInvitedByUser: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('wechatStatusMeta', () => {
  it('labels every state in the state machine', () => {
    expect(wechatStatusMeta(WechatStatus.NotInvited)).toEqual({ label: '未邀请', tone: 'neutral' })
    expect(wechatStatusMeta(WechatStatus.Invited)).toEqual({ label: '已邀请', tone: 'sky' })
    expect(wechatStatusMeta(WechatStatus.Joined)).toEqual({ label: '已加入', tone: 'success' })
    expect(wechatStatusMeta(WechatStatus.Failed)).toEqual({ label: '邀请失败', tone: 'danger' })
  })

  it('degrades an unknown or missing status instead of rendering nothing', () => {
    expect(wechatStatusMeta(null)).toEqual({ label: '—', tone: 'neutral' })
    expect(wechatStatusMeta('archived_by_backend')).toEqual({
      label: 'archived_by_backend',
      tone: 'neutral',
    })
  })
})

describe('wechatActionsFor', () => {
  it('offers exactly one invite action when not invited', () => {
    const actions = wechatActionsFor({
      wechatStatus: WechatStatus.NotInvited,
      status: SeasonParticipantStatus.Active,
    })
    expect(actions.map((action) => action.target)).toEqual([WechatStatus.Invited])
    expect(actions[0].label).toBe('邀请')
  })

  it('offers join then failure when invited, primary action first', () => {
    const actions = wechatActionsFor({
      wechatStatus: WechatStatus.Invited,
      status: SeasonParticipantStatus.Active,
    })
    expect(actions.map((action) => action.target)).toEqual([
      WechatStatus.Joined,
      WechatStatus.Failed,
    ])
    expect(actions[0].label).toBe('标记已入群')
    expect(actions[0].variant).toBe('primary')
    expect(actions[1].label).toBe('标记邀请失败')
    expect(actions[1].variant).toBe('ghost')
  })

  it('offers a re-invite after a failure', () => {
    const actions = wechatActionsFor({
      wechatStatus: WechatStatus.Failed,
      status: SeasonParticipantStatus.Active,
    })
    expect(actions.map((action) => action.target)).toEqual([WechatStatus.Invited])
    expect(actions[0].label).toBe('重新邀请')
  })

  it('offers nothing for the terminal joined state', () => {
    expect(
      wechatActionsFor({
        wechatStatus: WechatStatus.Joined,
        status: SeasonParticipantStatus.Active,
      }),
    ).toEqual([])
  })

  it('offers nothing for a withdrawn participant in any wechat state', () => {
    for (const wechatStatus of Object.values(WechatStatus)) {
      expect(
        wechatActionsFor({ wechatStatus, status: SeasonParticipantStatus.Withdrawn }),
      ).toEqual([])
    }
  })

  it('never targets a state the backend state machine would reject', () => {
    // 后端允许的跳转（service.ts 的 WECHAT_TRANSITIONS）就是这份对照表。
    const allowed: Record<string, string[]> = {
      [WechatStatus.NotInvited]: [WechatStatus.Invited],
      [WechatStatus.Invited]: [WechatStatus.Joined, WechatStatus.Failed],
      [WechatStatus.Failed]: [WechatStatus.Invited],
      [WechatStatus.Joined]: [],
    }
    for (const [from, targets] of Object.entries(allowed)) {
      const offered = wechatActionsFor({
        wechatStatus: from,
        status: SeasonParticipantStatus.Active,
      }).map((action) => action.target)
      expect(offered.sort()).toEqual([...targets].sort())
    }
  })
})

describe('participantLockReason', () => {
  it('explains a terminal or withdrawn row', () => {
    expect(
      participantLockReason({ wechatStatus: WechatStatus.Joined, status: SeasonParticipantStatus.Active }),
    ).toBe('已加入为终态')
    expect(
      participantLockReason({ wechatStatus: WechatStatus.Invited, status: SeasonParticipantStatus.Withdrawn }),
    ).toBe('选手已退出赛季')
    expect(
      participantLockReason({ wechatStatus: WechatStatus.Invited, status: SeasonParticipantStatus.Active }),
    ).toBeNull()
  })
})

describe('contactSummary', () => {
  it('prefixes wechat so it is obvious which channel the string is', () => {
    expect(contactSummary({ wechat: 'zhou_b1' })).toBe('wx: zhou_b1')
  })

  it('falls back to the phone, then to a dash', () => {
    expect(contactSummary({ phone: '13800000000' })).toBe('13800000000')
    expect(contactSummary({})).toBe('—')
    expect(contactSummary(null)).toBe('—')
    expect(contactSummary(undefined)).toBe('—')
  })

  it('prefers wechat when both are present, since that is the invite channel', () => {
    expect(contactSummary({ wechat: 'zhou_b1', phone: '13800000000' })).toBe('wx: zhou_b1')
  })

  it('ignores blank strings', () => {
    expect(contactSummary({ wechat: '   ', phone: '13800000000' })).toBe('13800000000')
  })
})

describe('recorderOf', () => {
  it('returns the recorder profile with its timestamp', () => {
    expect(
      recorderOf(
        participant({
          wechatStatus: WechatStatus.Invited,
          wechatInvitedBy: '2',
          wechatInvitedAt: '2026-11-03T07:00:00.000Z',
          wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: 'https://example.com/a.png' },
        }),
      ),
    ).toEqual({ name: '李想', avatarUrl: 'https://example.com/a.png', at: '2026-11-03T07:00:00.000Z' })
  })

  it('falls back to the raw userId when the profile row is missing', () => {
    expect(
      recorderOf(
        participant({
          wechatInvitedBy: '2',
          wechatInvitedAt: '2026-11-03T07:00:00.000Z',
          wechatInvitedByUser: { userId: '2', name: null, avatarUrl: null },
        }),
      ),
    ).toEqual({ name: '2', avatarUrl: null, at: '2026-11-03T07:00:00.000Z' })
  })

  it('returns null when nobody has been recorded', () => {
    expect(recorderOf(participant())).toBeNull()
  })
})

describe('participantInitial', () => {
  it('uses the first character of the nickname', () => {
    expect(participantInitial({ name: '周默', userId: '101' })).toBe('周')
  })

  it('falls back to the userId when there is no profile', () => {
    expect(participantInitial({ name: null, userId: '101' })).toBe('1')
    expect(participantInitial({ name: '  ', userId: 'abc' })).toBe('A')
  })
})

describe('formatMonthDayTime', () => {
  it('renders a compact Beijing-time stamp', () => {
    // 07:00Z = 15:00 北京时间。
    expect(formatMonthDayTime('2026-11-03T07:00:00.000Z')).toBe('11月3日 15:00')
  })

  it('renders a dash for missing or unparseable values', () => {
    expect(formatMonthDayTime(null)).toBe('—')
    expect(formatMonthDayTime(undefined)).toBe('—')
    expect(formatMonthDayTime('not-a-date')).toBe('—')
  })

  it('stays on Beijing time regardless of the runner time zone', () => {
    // 跨日：UTC 的 10 月 31 日 16:30 是北京时间 11 月 1 日 00:30。
    expect(formatMonthDayTime('2026-10-31T16:30:00.000Z')).toBe('11月1日 00:30')
  })
})

describe('countWechatStatuses', () => {
  it('counts each state and the total', () => {
    expect(
      countWechatStatuses([
        { wechatStatus: WechatStatus.NotInvited },
        { wechatStatus: WechatStatus.NotInvited },
        { wechatStatus: WechatStatus.Invited },
        { wechatStatus: WechatStatus.Joined },
        { wechatStatus: WechatStatus.Failed },
      ]),
    ).toEqual({ total: 5, notInvited: 2, invited: 1, joined: 1, failed: 1 })
  })

  it('is all zeros for an empty roster', () => {
    expect(countWechatStatuses([])).toEqual({
      total: 0,
      notInvited: 0,
      invited: 0,
      joined: 0,
      failed: 0,
    })
  })

  it('ignores unknown statuses without losing the total', () => {
    expect(countWechatStatuses([{ wechatStatus: 'something_new' }])).toMatchObject({
      total: 1,
      notInvited: 0,
    })
  })
})
