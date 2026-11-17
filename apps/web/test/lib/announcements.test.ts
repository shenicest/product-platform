import { describe, expect, it } from 'vitest'
import {
  announcementBadgeLabel,
  announcementTypeLabel,
  formatAnnouncementTime,
} from '@/lib/announcements'

describe('announcementBadgeLabel', () => {
  it('hides zero and caps at 99+', () => {
    expect(announcementBadgeLabel(0)).toBe('')
    expect(announcementBadgeLabel(-3)).toBe('')
    expect(announcementBadgeLabel(1)).toBe('1')
    expect(announcementBadgeLabel(99)).toBe('99')
    expect(announcementBadgeLabel(100)).toBe('99+')
    expect(announcementBadgeLabel(1234)).toBe('99+')
  })
})

describe('announcementTypeLabel', () => {
  it('maps known types and degrades unknown ones', () => {
    expect(announcementTypeLabel('season')).toBe('赛季')
    expect(announcementTypeLabel('application')).toBe('报名')
    expect(announcementTypeLabel('brand-new-type')).toBe('公告')
  })
})

describe('formatAnnouncementTime', () => {
  const now = new Date('2026-11-15T12:00:00+08:00')

  it('uses relative wording inside a week', () => {
    expect(formatAnnouncementTime('2026-11-15T11:59:30+08:00', now)).toBe('刚刚')
    expect(formatAnnouncementTime('2026-11-15T11:55:00+08:00', now)).toBe('5 分钟前')
    expect(formatAnnouncementTime('2026-11-15T09:00:00+08:00', now)).toBe('3 小时前')
    expect(formatAnnouncementTime('2026-11-13T12:00:00+08:00', now)).toBe('2 天前')
  })

  it('falls back to a Shanghai date after a week', () => {
    expect(formatAnnouncementTime('2026-11-01T12:00:00+08:00', now)).toBe('11.01')
  })

  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatAnnouncementTime('not-a-date', now)).toBe('')
  })
})
