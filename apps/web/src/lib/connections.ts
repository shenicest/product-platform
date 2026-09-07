import { ConnectionRequestStatus } from '@shenicest/shared'

export type ConnectionTargetType = 'talent_user' | 'hackathon_project'

export interface ConnectionTarget {
  type: ConnectionTargetType
  projectId?: number
  eventId?: number
  name?: string
  url?: string
  unavailable?: boolean
}

interface ConnectionItemParty {
  userId: string
  nickname: string | null
  avatarUrl: string | null
  hasPublishedTalentProfile: boolean
}

export interface ContactInfo {
  wechat: string | null
  email: string | null
}

// Unified connection card DTO — mirrors the GET /connections aggregate output
// (ticket 05).
export interface ConnectionItem {
  id: number
  source: 'talent' | 'hackathon'
  status: number
  senderUserId: string
  receiverUserId: string
  sender: ConnectionItemParty
  receiver: ConnectionItemParty
  target: ConnectionTarget
  purpose: string
  message: string
  createdAt: string
  acceptedAt: string | null
  handledAt: string | null
  contacts?: { mine: ContactInfo; other: ContactInfo }
}

export interface ConnectionsResult {
  data: ConnectionItem[]
  pendingReceived: number
}

export const CONNECTION_SOURCE_LABELS: Record<ConnectionItem['source'], string> = {
  talent: '人才',
  hackathon: '黑客松项目',
}

// Unified status label for both sources. Sent-view result deaths read from the
// sender's perspective, mirroring lib/talent.ts's connectionStatusLabel.
export function connectionItemStatusLabel(status: number, sent: boolean) {
  if (sent && status === ConnectionRequestStatus.Ignored) return '暂未建立连接'
  if (sent && status === ConnectionRequestStatus.Cancelled) return '连接请求已结束'
  return CONNECTION_STATUS_LABELS[status] ?? '未知状态'
}

const CONNECTION_STATUS_LABELS: Record<number, string> = {
  [ConnectionRequestStatus.Pending]: '等待对方回应',
  [ConnectionRequestStatus.Accepted]: '已建立连接',
  [ConnectionRequestStatus.Ignored]: '已被忽略',
  [ConnectionRequestStatus.Cancelled]: '连接请求已结束',
}

export function connectionSourceLabel(source: ConnectionItem['source']) {
  return CONNECTION_SOURCE_LABELS[source]
}
