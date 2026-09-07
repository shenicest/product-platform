import { eq } from 'drizzle-orm'
import type { Database } from '../db'
import { hackathonConnectionRequests } from '../db/schema'
import { NOTIFICATION_TYPES } from '../lib/mail/notification-types'
import { renderHackathonConnectionAcceptedEmail } from '../lib/mail/templates/hackathon-connection-accepted'
import { renderHackathonConnectionCreatedEmail } from '../lib/mail/templates/hackathon-connection-created'
import type { ContentResolver } from './mail-worker'

export interface HackathonConnectionContentResolverDeps {
  db: Database
  // D5-style seam over the event database so tests can stub project lookups.
  getProjectSummary: (hackathonProjectId: number) => Promise<{ name: string } | null>
  getSenderNickname: (userId: string) => Promise<string | null>
  webBaseUrl: string
}

// Builds the email for a hackathon connection delivery row (created reminder
// or accepted outcome). Returns null (→ terminal Failed) when the backing
// request or project no longer exists; throws on transient failures so the
// worker retries.
export function createHackathonConnectionContentResolver(
  deps: HackathonConnectionContentResolverDeps,
): ContentResolver {
  const base = deps.webBaseUrl.replace(/\/+$/, '')
  const connectionsUrl = `${base}/connections`
  return async (task) => {
    if (task.notificationType !== NOTIFICATION_TYPES.CONNECTION_CREATED && task.notificationType !== NOTIFICATION_TYPES.CONNECTION_ACCEPTED) {
      return null
    }
    const [request] = await deps.db
      .select()
      .from(hackathonConnectionRequests)
      .where(eq(hackathonConnectionRequests.id, task.connectionRequestId))
      .limit(1)
    if (!request) return null
    const project = await deps.getProjectSummary(request.hackathonProjectId)
    if (!project) return null
    if (task.notificationType === NOTIFICATION_TYPES.CONNECTION_ACCEPTED) {
      return renderHackathonConnectionAcceptedEmail({
        projectName: project.name,
        projectUrl: `${base}/hackathon/projects/${request.hackathonProjectId}`,
        acceptedAt: request.acceptedAt ?? request.handledAt ?? request.createdAt,
        connectionsUrl,
      })
    }
    const nickname = await deps.getSenderNickname(request.senderUserId)
    return renderHackathonConnectionCreatedEmail({
      projectName: project.name,
      projectUrl: `${base}/hackathon/projects/${request.hackathonProjectId}`,
      senderNickname: nickname ?? '平台用户',
      purpose: request.purpose,
      message: request.message,
      createdAt: request.createdAt,
      connectionsUrl,
    })
  }
}
