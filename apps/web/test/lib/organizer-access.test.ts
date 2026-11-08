import { describe, expect, it } from 'vitest'
import { canAccessOrganizerConsole, shouldShowOrganizerEntry } from '@/lib/organizer-access'

// 准入规则与构建环境无关：没有「本地永久开放」的开关，本地靠 mock 用户覆盖身份
// （见 apps/api/src/mock/fixtures.ts 的 `organizer` / `admin` 条目）。
// 所以这里直接调用即可，不需要像以前那样按 NODE_ENV 重新导入模块。

describe('canAccessOrganizerConsole', () => {
  it('requires a login', () => {
    expect(canAccessOrganizerConsole({ isLoggedIn: false, isOperator: false, isOrganizerMember: false })).toBe(false)
    expect(canAccessOrganizerConsole({ isLoggedIn: false, isOperator: true, isOrganizerMember: true })).toBe(false)
  })

  it('admits platform operators', () => {
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: true, isOrganizerMember: false })).toBe(true)
  })

  it('admits organizer org members', () => {
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: true })).toBe(true)
  })

  it('rejects logged-in accounts with neither role nor org', () => {
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
  })
})

describe('shouldShowOrganizerEntry', () => {
  it('requires a login', () => {
    expect(shouldShowOrganizerEntry({ isLoggedIn: false, isOperator: false, isOrganizerMember: null })).toBe(false)
    expect(shouldShowOrganizerEntry({ isLoggedIn: false, isOperator: true, isOrganizerMember: true })).toBe(false)
  })

  it('shows the entry to platform operators', () => {
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: true, isOrganizerMember: false })).toBe(true)
  })

  it('shows the entry to organizer org members', () => {
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: true })).toBe(true)
  })

  it('hides the entry from logged-in accounts with neither role nor org', () => {
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
  })

  // `null` = /api/me 还没带回组织归属。生产口径下按「没有」处理，
  // 不能因为状态未知就把入口放出来 —— 页面守卫会直接渲染 403。
  it('treats unknown membership as no membership', () => {
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: null })).toBe(false)
  })
})
