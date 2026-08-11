import { describe, expect, it } from 'vitest'
import { ProjectStatus } from '@shenicest/shared'
import {
  FOUNDER_STATUS_LABELS,
  hasActiveFounderFilters,
  parseFounderParams,
} from '@/lib/founder-filters'

describe('parseFounderParams', () => {
  it('returns defaults for empty search params', () => {
    expect(parseFounderParams({})).toEqual({ page: 1 })
  })

  it('accepts every known founder status', () => {
    for (const value of Object.keys(FOUNDER_STATUS_LABELS)) {
      const n = Number(value)
      expect(parseFounderParams({ status: value })).toEqual({ page: 1, status: n })
    }
  })

  it('accepts status=0 (Draft) and does not drop it as falsy', () => {
    expect(parseFounderParams({ status: '0' })).toEqual({
      page: 1,
      status: ProjectStatus.Draft,
    })
  })

  it('drops unknown status values', () => {
    expect(parseFounderParams({ status: '99' })).toEqual({ page: 1 })
    expect(parseFounderParams({ status: 'abc' })).toEqual({ page: 1 })
    expect(parseFounderParams({ status: '' })).toEqual({ page: 1 })
  })

  it('trims the search query and drops empty strings', () => {
    expect(parseFounderParams({ q: '  hello ' })).toEqual({ page: 1, q: 'hello' })
    expect(parseFounderParams({ q: '   ' })).toEqual({ page: 1 })
    expect(parseFounderParams({ q: '' })).toEqual({ page: 1 })
  })

  it('parses valid page numbers and falls back on invalid input', () => {
    expect(parseFounderParams({ page: '5' })).toEqual({ page: 5 })
    expect(parseFounderParams({ page: '0' })).toEqual({ page: 1 })
    expect(parseFounderParams({ page: '-1' })).toEqual({ page: 1 })
    expect(parseFounderParams({ page: '1.5' })).toEqual({ page: 1 })
    expect(parseFounderParams({ page: 'abc' })).toEqual({ page: 1 })
  })

  it('uses the first entry when arrays are supplied', () => {
    expect(parseFounderParams({ status: ['3', '1'] })).toEqual({
      page: 1,
      status: ProjectStatus.Live,
    })
  })

  it('combines every recognised filter', () => {
    expect(
      parseFounderParams({
        status: String(ProjectStatus.PendingReview),
        q: '  api ',
        page: '2',
      })
    ).toEqual({
      page: 2,
      status: ProjectStatus.PendingReview,
      q: 'api',
    })
  })
})

describe('hasActiveFounderFilters', () => {
  it('is false for empty filters', () => {
    expect(hasActiveFounderFilters({})).toBe(false)
  })

  it('detects each field individually', () => {
    expect(hasActiveFounderFilters({ status: ProjectStatus.Live })).toBe(true)
    expect(hasActiveFounderFilters({ q: 'ai' })).toBe(true)
  })

  it('treats status=0 (Draft) as active', () => {
    expect(hasActiveFounderFilters({ status: ProjectStatus.Draft })).toBe(true)
  })
})
