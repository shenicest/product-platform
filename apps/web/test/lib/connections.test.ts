import { describe, expect, it } from 'vitest'
import { ConnectionRequestStatus } from '@shenicest/shared'
import { connectionItemStatusLabel, connectionSourceLabel } from '@/lib/connections'

describe('connection labels', () => {
  it('labels sources in Chinese for the card source chip', () => {
    expect(connectionSourceLabel('talent')).toBe('人才')
    expect(connectionSourceLabel('hackathon')).toBe('黑客松项目')
  })

  it('labels statuses with sent-perspective result deaths', () => {
    expect(connectionItemStatusLabel(ConnectionRequestStatus.Pending, false)).toBe('等待对方回应')
    expect(connectionItemStatusLabel(ConnectionRequestStatus.Accepted, false)).toBe('已建立连接')
    expect(connectionItemStatusLabel(ConnectionRequestStatus.Ignored, false)).toBe('已被忽略')
    expect(connectionItemStatusLabel(ConnectionRequestStatus.Ignored, true)).toBe('暂未建立连接')
    expect(connectionItemStatusLabel(ConnectionRequestStatus.Cancelled, true)).toBe('连接请求已结束')
    expect(connectionItemStatusLabel(99, false)).toBe('未知状态')
  })
})
