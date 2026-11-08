import { describe, expect, it } from 'vitest'
import {
  ALL_REVIEW_STATUS_FILTER,
  APPLICATION_REVIEW_PAGE_SIZE,
  applicationReviewActions,
  applicationReviewHref,
  isReviewable,
  isReviewStatus,
  parseApplicationReviewParams,
  reviewFilterDescription,
  reviewOutcomeMessage,
  reviewStatusMeta,
  submissionStamp,
  summarizeApplicationReview,
  summarizeApplicationWindow,
  teamIntentLabel,
} from '@/lib/organizer-applications'

const NOW = new Date('2026-11-08T04:00:00.000Z')

describe('reviewStatusMeta', () => {
  it('calls submitted “审核中” in the organizer queue', () => {
    expect(reviewStatusMeta('submitted')).toEqual({ label: '审核中', tone: 'sky' })
  })

  it('maps every review status to a label and tone', () => {
    expect(reviewStatusMeta('accepted').label).toBe('已通过')
    expect(reviewStatusMeta('waitlisted').label).toBe('候补')
    expect(reviewStatusMeta('rejected').tone).toBe('danger')
    expect(reviewStatusMeta('withdrawn').tone).toBe('neutral')
  })

  it('falls back to the raw status for unknown values', () => {
    expect(reviewStatusMeta('weird')).toEqual({ label: 'weird', tone: 'neutral' })
  })
})

describe('isReviewStatus / isReviewable', () => {
  it('accepts every backend status and rejects anything else', () => {
    for (const status of ['submitted', 'accepted', 'pending', 'waitlisted', 'rejected', 'withdrawn']) {
      expect(isReviewStatus(status)).toBe(true)
    }
    expect(isReviewStatus('deleted')).toBe(false)
  })

  it('locks accepted and withdrawn', () => {
    expect(isReviewable('submitted')).toBe(true)
    expect(isReviewable('pending')).toBe(true)
    expect(isReviewable('accepted')).toBe(false)
    expect(isReviewable('withdrawn')).toBe(false)
  })
})

describe('applicationReviewActions', () => {
  it('offers every other status for a submitted application, main action first', () => {
    const actions = applicationReviewActions('submitted')
    expect(actions.map((action) => action.target)).toEqual(['accepted', 'pending', 'waitlisted', 'rejected'])
    expect(actions[0]).toMatchObject({ label: '通过' })
    expect(actions[3]).toMatchObject({ label: '不通过', requiresReason: true })
  })

  it('gives each action a semantic tone for the icon button', () => {
    const tones = Object.fromEntries(
      applicationReviewActions('submitted').map((action) => [action.target, action.tone]),
    )
    expect(tones).toEqual({
      accepted: 'brand-solid',
      pending: 'warning',
      waitlisted: 'warning',
      rejected: 'danger',
    })
  })

  it('drops the action matching the current status', () => {
    expect(applicationReviewActions('pending').map((action) => action.target))
      .toEqual(['accepted', 'waitlisted', 'rejected'])
    expect(applicationReviewActions('waitlisted').map((action) => action.target))
      .toEqual(['accepted', 'pending', 'rejected'])
    expect(applicationReviewActions('rejected').map((action) => action.target))
      .toEqual(['accepted', 'pending', 'waitlisted'])
  })

  it('offers nothing for terminal statuses', () => {
    expect(applicationReviewActions('accepted')).toEqual([])
    expect(applicationReviewActions('withdrawn')).toEqual([])
  })
})

describe('reviewOutcomeMessage', () => {
  it('explains the capacity downgrade instead of pretending the accept worked', () => {
    expect(reviewOutcomeMessage('accepted', 'waitlisted')).toBe('名额已满，该报名已进入候补队列。')
  })

  it('echoes the effective status otherwise', () => {
    expect(reviewOutcomeMessage('accepted', 'accepted')).toBe('已标记为「已通过」。')
    expect(reviewOutcomeMessage('rejected', 'rejected')).toBe('已标记为「未通过」。')
  })
})

describe('parseApplicationReviewParams', () => {
  it('defaults to the pending queue', () => {
    expect(parseApplicationReviewParams({})).toEqual({
      status: 'submitted',
      statusFilter: 'submitted',
      page: 1,
    })
  })

  it('maps status=all to “no backend filter” while keeping the UI value', () => {
    const params = parseApplicationReviewParams({ status: ALL_REVIEW_STATUS_FILTER })
    expect(params.status).toBeUndefined()
    expect(params.statusFilter).toBe('all')
  })

  it('ignores unknown statuses and keeps the default', () => {
    expect(parseApplicationReviewParams({ status: 'nope' }).status).toBe('submitted')
  })

  it('reads visibility, keyword and page', () => {
    const params = parseApplicationReviewParams({
      status: 'waitlisted',
      visibility: 'public',
      q: '  前端  ',
      page: '3',
    })
    expect(params).toMatchObject({
      status: 'waitlisted',
      statusFilter: 'waitlisted',
      visibility: 'public',
      q: '前端',
      page: 3,
    })
  })

  it('drops a non-numeric page and a bad visibility', () => {
    const params = parseApplicationReviewParams({ page: '0', visibility: 'secret' })
    expect(params.page).toBe(1)
    expect(params.visibility).toBeUndefined()
  })
})

describe('applicationReviewHref', () => {
  it('keeps the address clean at the default filter', () => {
    expect(applicationReviewHref({ statusFilter: 'submitted', seasonId: 21 }))
      .toBe('/organizer/applications?season=21')
  })

  it('writes non-default filters and pages', () => {
    expect(applicationReviewHref({ statusFilter: 'all', page: 2, seasonId: 21 }))
      .toBe('/organizer/applications?season=21&status=all&page=2')
  })

  it('omits the page when it is the first one', () => {
    expect(applicationReviewHref({ statusFilter: 'rejected', page: 1, seasonId: 21 }))
      .toBe('/organizer/applications?season=21&status=rejected')
  })
})

describe('reviewFilterDescription', () => {
  it('names the filter, falling back to “全部报名”', () => {
    expect(reviewFilterDescription('submitted')).toBe('待处理')
    expect(reviewFilterDescription('all')).toBe('全部报名')
    expect(reviewFilterDescription('unknown')).toBe('全部报名')
  })
})

describe('submissionStamp', () => {
  it('splits the timestamp into a date line and a time line', () => {
    // 2026-10-26T01:40Z = 北京 10月26日 09:40
    const stamp = submissionStamp('2026-10-26T01:40:00.000Z', NOW)
    expect(stamp.date).toBe('10月26日')
    expect(stamp.time).toBe('09:40')
  })

  it('shows a dash for a missing or invalid value', () => {
    expect(submissionStamp(null)).toEqual({ date: '—', time: '' })
    expect(submissionStamp('not-a-date')).toEqual({ date: '—', time: '' })
  })
})

describe('teamIntentLabel', () => {
  it('reads the solo flag as a sentence', () => {
    expect(teamIntentLabel(true)).toBe('可单人开始')
    expect(teamIntentLabel(false)).toBe('需要组队')
  })
})

describe('summarizeApplicationWindow', () => {
  const open = { opensAt: '2026-10-12T00:00:00.000Z', closesAt: '2026-10-26T00:00:00.000Z', isOpen: true }

  it('reports an open window with its range', () => {
    const summary = summarizeApplicationWindow(open, 'active', NOW)
    expect(summary.open).toBe(true)
    expect(summary.label).toBe('报名中')
    expect(summary.range).toBe('10月12日 — 10月26日')
  })

  it('explains why a closed window is closed', () => {
    const closed = { ...open, isOpen: false }
    expect(summarizeApplicationWindow(closed, 'active', NOW).label).toBe('报名已截止')
    expect(summarizeApplicationWindow(closed, 'suspended', NOW).label).toBe('赛季已暂停')
    expect(summarizeApplicationWindow(closed, 'cancelled', NOW).label).toBe('赛季已取消')
    expect(
      summarizeApplicationWindow(
        { opensAt: '2026-12-01T00:00:00.000Z', closesAt: '2026-12-10T00:00:00.000Z', isOpen: false },
        'upcoming',
        NOW,
      ).label,
    ).toBe('报名未开始')
  })

  it('says the window is unpublished when the schedule is empty', () => {
    const summary = summarizeApplicationWindow({ opensAt: null, closesAt: null, isOpen: false }, 'upcoming', NOW)
    expect(summary.label).toBe('报名时间待公布')
    expect(summary.range).toBeNull()
  })
})

describe('summarizeApplicationReview', () => {
  const window = { opensAt: '2026-10-12T00:00:00.000Z', closesAt: '2026-10-26T00:00:00.000Z', isOpen: false }

  it('counts approved participants against the capacity', () => {
    const stats = summarizeApplicationReview({
      participantCapacity: 20,
      participantCount: 19,
      waitlistedCount: 0,
      applicationWindow: window,
      seasonStatus: 'active',
      now: NOW,
    })
    expect(stats.approved).toBe('19 / 20')
    expect(stats.waitlisted).toBe(0)
    expect(stats.window.label).toBe('报名已截止')
    expect(stats.window.range).toBe('10月12日 — 10月26日')
  })

  it('writes 不限 when there is no capacity', () => {
    const stats = summarizeApplicationReview({
      participantCapacity: null,
      participantCount: 7,
      waitlistedCount: 3,
      applicationWindow: window,
      seasonStatus: 'active',
      now: NOW,
    })
    expect(stats.approved).toBe('7 / 不限')
    expect(stats.waitlisted).toBe(3)
  })
})

describe('APPLICATION_REVIEW_PAGE_SIZE', () => {
  it('stays within the backend pageSize cap', () => {
    expect(APPLICATION_REVIEW_PAGE_SIZE).toBeLessThanOrEqual(100)
    expect(APPLICATION_REVIEW_PAGE_SIZE).toBeGreaterThan(0)
  })
})
