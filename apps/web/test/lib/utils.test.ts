import { describe, expect, it } from 'vitest'
import { cn, projectIdLabel } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('supports conditional object form', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })

  it('resolves tailwind class conflicts (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})

describe('projectIdLabel', () => {
  it('zero-pads to 3 digits', () => {
    expect(projectIdLabel(1)).toBe('P-001')
    expect(projectIdLabel(42)).toBe('P-042')
    expect(projectIdLabel(999)).toBe('P-999')
  })

  it('does not truncate ids that exceed 3 digits', () => {
    expect(projectIdLabel(1000)).toBe('P-1000')
    expect(projectIdLabel(123456)).toBe('P-123456')
  })

  it('handles zero', () => {
    expect(projectIdLabel(0)).toBe('P-000')
  })
})
