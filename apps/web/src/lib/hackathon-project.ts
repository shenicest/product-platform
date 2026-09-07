import type { HackathonTrack } from '@shenicest/shared'
import { ConnectionRequestStatus, HACKATHON_CONNECTION_PURPOSES } from '@shenicest/shared'

export function stripTrackAppendix(description: string | null | undefined) {
  if (!description) return ''
  return description
    .replace(/\s*---+\s*(?:\r?\n\s*)?G001[^\r\n]*赛道附加材料[\s\S]*$/i, '')
    .trim()
}

export function normalizeHackathonTrack(track: string | null | undefined, name = ''): HackathonTrack | null {
  const text = `${track ?? ''} ${name}`.toLowerCase()
  if (text.includes('硬件') || text.includes('hardware')) return 'hardware'
  if (text.includes('游戏') || text.includes('game')) return 'game'
  if (text.includes('aigc') || text.includes('影像')) return 'aigc'
  if (text.includes('软件') || text.includes('software')) return 'software'
  return null
}

// Covers every ConnectionRequestStatus value; keyed numerically so lookup
// sites can pass raw tinyint values from API payloads.
export const HACKATHON_CONNECTION_STATUS_LABELS: Record<number, string> = {
  [ConnectionRequestStatus.Pending]: '等待项目方回应',
  [ConnectionRequestStatus.Accepted]: '已建立连接',
  [ConnectionRequestStatus.Ignored]: '暂未建立连接',
  [ConnectionRequestStatus.Cancelled]: '申请已结束',
}

export function validateHackathonConnectionBody(body: {
  purpose: string
  message: string
  wechat?: string
  email?: string
}) {
  const errors: Record<string, string> = {}
  if (
    !HACKATHON_CONNECTION_PURPOSES.includes(
      body.purpose as (typeof HACKATHON_CONNECTION_PURPOSES)[number],
    )
  )
    errors.purpose = '请选择联系目的'
  if (body.message.trim().length < 30 || body.message.trim().length > 500)
    errors.message = '留言请输入 30-500 个字符'
  if (!body.wechat?.trim() && !body.email?.trim())
    errors.contact = '至少提供微信或邮箱'
  if (body.wechat && body.wechat.trim().length > 64)
    errors.wechat = '微信号最长 64 个字符'
  if (body.email && body.email.trim().length > 254)
    errors.email = '邮箱最长 254 个字符'
  if (body.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))
    errors.email = '邮箱格式不正确'
  return errors
}
