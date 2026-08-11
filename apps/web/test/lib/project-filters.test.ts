import { describe, expect, it } from 'vitest'
import { ProjectStage } from '@shenicest/shared'
import {
  hasActiveFilters,
  parseListParams,
  SORT_LABELS,
  SORTS,
  STAGE_LABELS,
} from '@/lib/project-filters'

describe('parseListParams', () => {
  it('returns defaults for empty search params', () => {
    expect(parseListParams({})).toEqual({ page: 1 })
  })

  it('accepts a valid category', () => {
    expect(parseListParams({ category: '开发者工具' })).toEqual({
      page: 1,
      category: '开发者工具',
    })
  })

  it('drops unknown categories silently', () => {
    expect(parseListParams({ category: 'unknown' })).toEqual({ page: 1 })
  })

  it('parses stage as a number when valid', () => {
    expect(parseListParams({ stage: String(ProjectStage.MVP) })).toEqual({
      page: 1,
      stage: ProjectStage.MVP,
    })
    expect(parseListParams({ stage: String(ProjectStage.Growth) })).toEqual({
      page: 1,
      stage: ProjectStage.Growth,
    })
  })

  it('ignores stage values outside the enum', () => {
    expect(parseListParams({ stage: '2' })).toEqual({ page: 1 })
    expect(parseListParams({ stage: 'abc' })).toEqual({ page: 1 })
    expect(parseListParams({ stage: '' })).toEqual({ page: 1 })
  })

  it('trims the search query and drops empty strings', () => {
    expect(parseListParams({ q: '  hello  ' })).toEqual({ page: 1, q: 'hello' })
    expect(parseListParams({ q: '   ' })).toEqual({ page: 1 })
    expect(parseListParams({ q: '' })).toEqual({ page: 1 })
  })

  it('accepts known sort values only', () => {
    for (const sort of SORTS) {
      expect(parseListParams({ sort })).toMatchObject({ sort })
    }
    expect(parseListParams({ sort: 'bogus' })).toEqual({ page: 1 })
  })

  it('parses valid page numbers', () => {
    expect(parseListParams({ page: '5' })).toEqual({ page: 5 })
    expect(parseListParams({ page: '1' })).toEqual({ page: 1 })
  })

  it('falls back to page=1 for invalid or non-positive pages', () => {
    expect(parseListParams({ page: '0' })).toEqual({ page: 1 })
    expect(parseListParams({ page: '-3' })).toEqual({ page: 1 })
    expect(parseListParams({ page: '1.5' })).toEqual({ page: 1 })
    expect(parseListParams({ page: 'abc' })).toEqual({ page: 1 })
  })

  it('uses the first entry when the same key appears multiple times', () => {
    expect(parseListParams({ category: ['开发者工具', '教育学习'] })).toEqual({
      page: 1,
      category: '开发者工具',
    })
  })

  it('combines every recognised filter', () => {
    expect(
      parseListParams({
        category: '效率工具',
        stage: String(ProjectStage.Growth),
        q: '  ai  ',
        sort: 'recently_updated',
        page: '3',
      })
    ).toEqual({
      page: 3,
      category: '效率工具',
      stage: ProjectStage.Growth,
      q: 'ai',
      sort: 'recently_updated',
    })
  })
})

describe('hasActiveFilters', () => {
  it('is false for an empty filter object', () => {
    expect(hasActiveFilters({})).toBe(false)
  })

  it('detects each filter individually', () => {
    expect(hasActiveFilters({ category: '开发者工具' })).toBe(true)
    expect(hasActiveFilters({ stage: ProjectStage.MVP })).toBe(true)
    expect(hasActiveFilters({ q: 'ai' })).toBe(true)
  })

  it('treats stage=0 as active (MVP is a real filter)', () => {
    expect(hasActiveFilters({ stage: ProjectStage.MVP })).toBe(true)
  })

  it('does not treat sort-only as an active filter', () => {
    expect(hasActiveFilters({ sort: 'recently_updated' })).toBe(false)
  })
})

describe('label maps', () => {
  it('covers every sort value', () => {
    for (const sort of SORTS) expect(SORT_LABELS[sort]).toBeTruthy()
  })

  it('covers both stages', () => {
    expect(STAGE_LABELS[ProjectStage.MVP]).toBeTruthy()
    expect(STAGE_LABELS[ProjectStage.Growth]).toBeTruthy()
  })
})
