import { describe, expect, it } from 'vitest'
import { ProjectStage, ProjectStatus } from '@shenicest/shared'
import {
  hasActiveOperatorProjectFilters,
  OPERATOR_STATUS_LABELS,
  parseAuditRecordParams,
  parseOperatorProjectParams,
  parseOperatorProposalParams,
} from '@/lib/operator-filters'

describe('parseOperatorProjectParams', () => {
  it('returns defaults for empty search params', () => {
    expect(parseOperatorProjectParams({})).toEqual({ page: 1 })
  })

  it('accepts every operator-visible status', () => {
    for (const key of Object.keys(OPERATOR_STATUS_LABELS)) {
      const n = Number(key)
      expect(parseOperatorProjectParams({ status: key })).toEqual({ page: 1, status: n })
    }
  })

  it('drops Draft status (operators do not see drafts)', () => {
    expect(parseOperatorProjectParams({ status: String(ProjectStatus.Draft) })).toEqual({
      page: 1,
    })
  })

  it('drops unknown status values', () => {
    expect(parseOperatorProjectParams({ status: '99' })).toEqual({ page: 1 })
    expect(parseOperatorProjectParams({ status: 'abc' })).toEqual({ page: 1 })
  })

  it('parses valid stages', () => {
    expect(parseOperatorProjectParams({ stage: String(ProjectStage.MVP) })).toEqual({
      page: 1,
      stage: ProjectStage.MVP,
    })
  })

  it('drops unknown stages', () => {
    expect(parseOperatorProjectParams({ stage: '9' })).toEqual({ page: 1 })
    expect(parseOperatorProjectParams({ stage: '' })).toEqual({ page: 1 })
  })

  it('accepts known categories only', () => {
    expect(parseOperatorProjectParams({ category: '开发者工具' })).toEqual({
      page: 1,
      category: '开发者工具',
    })
    expect(parseOperatorProjectParams({ category: 'bogus' })).toEqual({ page: 1 })
  })

  it('trims the search query and drops empty strings', () => {
    expect(parseOperatorProjectParams({ q: '  hello ' })).toEqual({ page: 1, q: 'hello' })
    expect(parseOperatorProjectParams({ q: '   ' })).toEqual({ page: 1 })
  })

  it('validates sort against a whitelist', () => {
    expect(parseOperatorProjectParams({ sort: 'created_at' })).toEqual({
      page: 1,
      sort: 'created_at',
    })
    expect(parseOperatorProjectParams({ sort: 'updated_at' })).toEqual({
      page: 1,
      sort: 'updated_at',
    })
    expect(parseOperatorProjectParams({ sort: 'bogus' })).toEqual({ page: 1 })
  })

  it('validates order against a whitelist', () => {
    expect(parseOperatorProjectParams({ order: 'asc' })).toEqual({ page: 1, order: 'asc' })
    expect(parseOperatorProjectParams({ order: 'desc' })).toEqual({ page: 1, order: 'desc' })
    expect(parseOperatorProjectParams({ order: 'bogus' })).toEqual({ page: 1 })
  })

  it('combines every recognised filter', () => {
    expect(
      parseOperatorProjectParams({
        status: String(ProjectStatus.PendingReview),
        stage: String(ProjectStage.Growth),
        category: '效率工具',
        q: '  ai ',
        sort: 'updated_at',
        order: 'asc',
        page: '3',
      })
    ).toEqual({
      page: 3,
      status: ProjectStatus.PendingReview,
      stage: ProjectStage.Growth,
      category: '效率工具',
      q: 'ai',
      sort: 'updated_at',
      order: 'asc',
    })
  })
})

describe('parseOperatorProposalParams', () => {
  it('returns defaults for empty search params', () => {
    expect(parseOperatorProposalParams({})).toEqual({ page: 1 })
  })

  it('accepts stage and category', () => {
    expect(
      parseOperatorProposalParams({
        stage: String(ProjectStage.MVP),
        category: '开发者工具',
      })
    ).toEqual({ page: 1, stage: ProjectStage.MVP, category: '开发者工具' })
  })

  it('drops unknown stage and category values', () => {
    expect(parseOperatorProposalParams({ stage: '9', category: 'x' })).toEqual({ page: 1 })
  })
})

describe('parseAuditRecordParams', () => {
  it('returns defaults for empty search params', () => {
    expect(parseAuditRecordParams({})).toEqual({ page: 1 })
  })

  it('parses a positive projectId only', () => {
    expect(parseAuditRecordParams({ projectId: '42' })).toEqual({ page: 1, projectId: 42 })
    expect(parseAuditRecordParams({ projectId: '0' })).toEqual({ page: 1 })
    expect(parseAuditRecordParams({ projectId: '-1' })).toEqual({ page: 1 })
    expect(parseAuditRecordParams({ projectId: 'abc' })).toEqual({ page: 1 })
  })

  it('trims from/to and drops empty strings', () => {
    expect(parseAuditRecordParams({ from: '  2025-01-01  ', to: ' 2025-01-31 ' })).toEqual({
      page: 1,
      from: '2025-01-01',
      to: '2025-01-31',
    })
    expect(parseAuditRecordParams({ from: '   ', to: '' })).toEqual({ page: 1 })
  })

  it('parses valid pages and falls back on invalid input', () => {
    expect(parseAuditRecordParams({ page: '4' })).toEqual({ page: 4 })
    expect(parseAuditRecordParams({ page: '0' })).toEqual({ page: 1 })
    expect(parseAuditRecordParams({ page: 'x' })).toEqual({ page: 1 })
  })
})

describe('hasActiveOperatorProjectFilters', () => {
  it('is false for empty filters', () => {
    expect(hasActiveOperatorProjectFilters({})).toBe(false)
  })

  it('detects each field individually', () => {
    expect(hasActiveOperatorProjectFilters({ status: ProjectStatus.PendingReview })).toBe(true)
    expect(hasActiveOperatorProjectFilters({ stage: ProjectStage.MVP })).toBe(true)
    expect(hasActiveOperatorProjectFilters({ category: '效率工具' })).toBe(true)
    expect(hasActiveOperatorProjectFilters({ q: 'ai' })).toBe(true)
  })

  it('does not treat sort or order alone as active filters', () => {
    expect(hasActiveOperatorProjectFilters({ sort: 'created_at' })).toBe(false)
    expect(hasActiveOperatorProjectFilters({ order: 'asc' })).toBe(false)
  })

  it('treats stage=0 (MVP) as active', () => {
    expect(hasActiveOperatorProjectFilters({ stage: ProjectStage.MVP })).toBe(true)
  })
})
