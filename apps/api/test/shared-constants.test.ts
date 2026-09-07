import { describe, expect, it } from 'bun:test'
import { HACKATHON_CONNECTION_PURPOSES } from '@shenicest/shared'

describe('HACKATHON_CONNECTION_PURPOSES', () => {
  it('exposes the PRD-fixed purpose enum in order', () => {
    expect([...HACKATHON_CONNECTION_PURPOSES]).toEqual([
      '试用产品',
      '合作交流',
      '加入项目',
      '提供专业帮助',
      '寻求反馈',
      '其他',
    ])
  })
})
