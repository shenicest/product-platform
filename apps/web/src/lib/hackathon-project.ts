import type { HackathonTrack } from '@shenicest/shared'

export function stripTrackAppendix(description: string | null | undefined) {
  if (!description) return ''
  return description
    .replace(/\s*---+\s*(?:\r?\n\s*)?G001[^\r\n]*赛道附加材料[\s\S]*$/i, '')
    .trim()
}

export function normalizeHackathonTrack(track: string | null | undefined, name = ''): HackathonTrack {
  const text = `${track ?? ''} ${name}`.toLowerCase()
  if (text.includes('硬件') || text.includes('hardware')) return 'hardware'
  if (text.includes('游戏') || text.includes('game')) return 'game'
  if (text.includes('aigc') || text.includes('影像')) return 'aigc'
  return 'software'
}
