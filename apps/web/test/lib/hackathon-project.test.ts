import { describe, expect, it } from 'vitest'
import { normalizeHackathonTrack, stripTrackAppendix } from '@/lib/hackathon-project'

describe('stripTrackAppendix', () => {
  it.each(['软件', '游戏', '硬件', 'AIGC 影像'])(
    'removes the %s track appendix and everything after it',
    (track) => {
      const description = `项目正文\n\n---\nG001 ${track} 赛道附加材料\n\n- Slogan: 不应展示\n- GitHub 仓库: https://example.com`
      expect(stripTrackAppendix(description)).toBe('项目正文')
    },
  )

  it('supports the marker on one line', () => {
    expect(stripTrackAppendix('项目正文\n--- G001 游戏 赛道附加材料\n附加内容')).toBe('项目正文')
  })

  it('keeps descriptions without a track appendix unchanged', () => {
    expect(stripTrackAppendix('项目正文\n包含正常内容')).toBe('项目正文\n包含正常内容')
  })
})

describe('normalizeHackathonTrack', () => {
  it('normalizes known Chinese and English track names', () => {
    expect(normalizeHackathonTrack('硬件赛道')).toBe('hardware')
    expect(normalizeHackathonTrack('Game')).toBe('game')
    expect(normalizeHackathonTrack('AIGC 视频作品')).toBe('aigc')
  })

  it('falls back to software and considers the project name', () => {
    expect(normalizeHackathonTrack(null, '智能硬件套件')).toBe('hardware')
    expect(normalizeHackathonTrack(null, '效率助手')).toBe('software')
  })
})
