import type { TalentService } from '../talent/service'
import type { HackathonConnectionListItem } from '../hackathon-connection/service'
import { ConnectionRequestStatus } from '@shenicest/shared'

// Unified connection card shape (ticket 05). The hackathon dependency is typed
// with its own (narrower) HackathonConnectionListItem, so the two shapes are
// structurally aligned by the wiring — the `source`/`target.type` literals are
// widened here to admit both sources.
export interface ConnectionListItem {
  id: number
  source: 'talent' | 'hackathon'
  status: number
  senderUserId: string
  receiverUserId: string
  sender: Participant
  receiver: Participant
  target: {
    type: 'talent_user' | 'hackathon_project'
    projectId?: number
    eventId?: number
    name?: string
    url?: string
    unavailable?: boolean
  }
  purpose: string
  message: string
  createdAt: string
  acceptedAt: string | null
  handledAt: string | null
  contacts?: { mine: { wechat: string | null; email: string | null }; other: { wechat: string | null; email: string | null } }
}

interface Participant {
  userId: string
  nickname: string | null
  avatarUrl: string | null
  hasPublishedTalentProfile: boolean
}

type TalentConnectionsResult = Awaited<ReturnType<TalentService['connections']>>
type TalentConnectionView = TalentConnectionsResult['data'][number]

export interface ConnectionsQuery {
  source?: 'all' | 'talent' | 'hackathon'
  direction?: 'all' | 'sent' | 'received'
}

export interface ConnectionsServiceDeps {
  talentConnections: (userId: string) => Promise<TalentConnectionsResult>
  hackathonConnections: (userId: string) => Promise<{ data: HackathonConnectionListItem[]; pendingReceived: number }>
}

// Read-only composition of the Talent and Hackathon connection sources into
// one paginated-shape list (ticket 05). No state machine logic lives here.
export class ConnectionsService {
  constructor(private readonly deps: ConnectionsServiceDeps) {}

  async connections(userId: string, query: ConnectionsQuery = {}) {
    const source = query.source ?? 'all'
    const direction = query.direction ?? 'all'
    // Skipped sources are not fetched at all — a talent-only viewer never
    // triggers hackathon project summary lookups.
    const talent = source === 'hackathon' ? null : await this.deps.talentConnections(userId)
    const hackathon = source === 'talent' ? null : await this.deps.hackathonConnections(userId)

    const items = [...(talent ? talent.data.map((item) => this.talentItem(item)) : []), ...(hackathon?.data ?? [])]
    const filtered = items.filter((item) => {
      if (direction === 'sent' && item.senderUserId !== userId) return false
      if (direction === 'received' && item.receiverUserId !== userId) return false
      return true
    })
    // Pending requests addressed to the viewer first, then newest first.
    filtered.sort((a, b) => {
      const aPriority = Number(this.isPendingReceived(a, userId))
      const bPriority = Number(this.isPendingReceived(b, userId))
      if (aPriority !== bPriority) return bPriority - aPriority
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
      return a.id - b.id
    })
    // pendingReceived follows the source filter (direction-independent) so with
    // source=talent it equals GET /talents/connections pendingReceived exactly.
    const pendingReceived = (talent?.pendingReceived ?? 0) + (hackathon?.pendingReceived ?? 0)
    return { data: filtered, pendingReceived }
  }

  private isPendingReceived(item: ConnectionListItem, userId: string) {
    return item.status === ConnectionRequestStatus.Pending && item.receiverUserId === userId
  }

  // Trim the talent connectionView into the unified shape: drop the full
  // talentProfile mount and the referenced project payload.
  private talentItem(item: TalentConnectionView): ConnectionListItem {
    const contacts = item.contacts
    return {
      id: item.id,
      source: 'talent',
      status: item.status,
      senderUserId: item.senderUserId,
      receiverUserId: item.receiverUserId,
      sender: this.talentParticipant(item.sender),
      receiver: this.talentParticipant(item.receiver),
      target: { type: 'talent_user' },
      purpose: item.purpose,
      message: item.message,
      createdAt: new Date(item.createdAt).toISOString(),
      acceptedAt: item.acceptedAt ?? null,
      handledAt: item.handledAt ?? null,
      ...(contacts ? { contacts } : {}),
    }
  }

  private talentParticipant(participant: TalentConnectionView['sender']): Participant {
    return {
      userId: participant.userId,
      nickname: participant.identity?.nickname ?? null,
      avatarUrl: participant.identity?.avatarUrl ?? null,
      hasPublishedTalentProfile: participant.hasPublishedTalentProfile,
    }
  }
}
