import { describe, expect, it } from 'vitest'
import {
  HACKATHON_CONNECTION_STATUS_LABELS,
  validateHackathonConnectionBody,
} from '@/lib/hackathon-project'

describe('validateHackathonConnectionBody', () => {
  const base = {
    purpose: '合作交流',
    message: '我们正在做相近方向的产品，希望交流产品设计与用户验证经验，期待长期合作。',
    wechat: 'wx-id',
  }

  it('accepts a complete body', () => {
    expect(validateHackathonConnectionBody(base)).toEqual({})
  })

  it('requires a known purpose', () => {
    expect(validateHackathonConnectionBody({ ...base, purpose: '' })).toEqual({ purpose: '请选择联系目的' })
    expect(validateHackathonConnectionBody({ ...base, purpose: '自由目的' })).toEqual({ purpose: '请选择联系目的' })
  })

  it('requires a 30-500 char message after trimming', () => {
    expect(validateHackathonConnectionBody({ ...base, message: '太短' })).toEqual({ message: '留言请输入 30-500 个字符' })
    expect(validateHackathonConnectionBody({ ...base, message: ` ${'字'.repeat(30)} ` })).toEqual({})
    expect(validateHackathonConnectionBody({ ...base, message: ' '.repeat(400) })).toEqual({ message: '留言请输入 30-500 个字符' })
  })

  it('requires at least one contact method', () => {
    expect(validateHackathonConnectionBody({ ...base, wechat: '' })).toEqual({ contact: '至少提供微信或邮箱' })
    expect(validateHackathonConnectionBody({ ...base, wechat: '  ', email: undefined })).toEqual({ contact: '至少提供微信或邮箱' })
    expect(validateHackathonConnectionBody({ ...base, wechat: undefined, email: 'me@example.com' })).toEqual({})
  })

  it('validates the email format and contact length limits', () => {
    expect(validateHackathonConnectionBody({ ...base, wechat: undefined, email: 'not-an-email' })).toEqual({ email: '邮箱格式不正确' })
    expect(validateHackathonConnectionBody({ ...base, wechat: undefined, email: 'ME@Example.COM' })).toEqual({})
    expect(validateHackathonConnectionBody({ ...base, wechat: 'a'.repeat(65) })).toEqual({ wechat: '微信号最长 64 个字符' })
    expect(validateHackathonConnectionBody({ ...base, wechat: undefined, email: `${'m'.repeat(250)}@example.com` })).toEqual({ email: '邮箱最长 254 个字符' })
  })

  it('exposes the state labels for every ConnectionRequestStatus value', () => {
    expect(HACKATHON_CONNECTION_STATUS_LABELS).toEqual({
      0: '等待项目方回应',
      1: '已建立连接',
      2: '暂未建立连接',
      3: '申请已结束',
    })
  })
})
