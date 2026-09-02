import { describe, expect, it } from 'vitest'
import { middleware } from '@/middleware'

describe('middleware', () => {
  it('allows requests through without inferring authentication from cookies', () => {
    const res = middleware()

    expect(res.headers.get('location')).toBeNull()
  })
})
