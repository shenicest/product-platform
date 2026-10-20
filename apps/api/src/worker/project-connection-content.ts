import { eq } from 'drizzle-orm'
import type { Database } from '../db'
import { projectConnectionRequests, projects } from '../db/schema'
import { NOTIFICATION_TYPES } from '../lib/mail/notification-types'
import { renderHackathonConnectionAcceptedEmail } from '../lib/mail/templates/hackathon-connection-accepted'
import { renderHackathonConnectionCreatedEmail } from '../lib/mail/templates/hackathon-connection-created'
import type { ContentResolver } from './mail-worker'

export interface ProjectConnectionContentResolverDeps {
  db: Database
  webBaseUrl: string
}

// Builds the email for a platform-Project connection delivery row. Returns
// null (→ terminal Failed) when the request or project row is gone; throws on
// transient failures so the worker retries.
export function createProjectConnectionContentResolver(
  deps: ProjectConnectionContentResolverDeps,
): ContentResolver {
  const base = deps.webBaseUrl.replace(/\/+$/, '')
  const connectionsUrl = `${base}/connections`
  return async (task) => {
    if (
      task.notificationType !== NOTIFICATION_TYPES.PROJECT_CONNECTION_CREATED &&
      task.notificationType !== NOTIFICATION_TYPES.PROJECT_CONNECTION_ACCEPTED
    ) {
      return null
    }
    const [request] = await deps.db
      .select()
      .from(projectConnectionRequests)
      .where(eq(projectConnectionRequests.id, task.connectionRequestId))
      .limit(1)
    if (!request) return null
    const [project] = await deps.db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, request.projectId))
      .limit(1)
    if (!project) return null
    const projectUrl = `${base}/projects/${request.projectId}`
    if (task.notificationType === NOTIFICATION_TYPES.PROJECT_CONNECTION_ACCEPTED) {
      return renderHackathonConnectionAcceptedEmail({
        projectName: project.name,
        projectUrl,
        acceptedAt: request.acceptedAt ?? request.handledAt ?? request.createdAt,
        connectionsUrl,
      })
    }
    return renderHackathonConnectionCreatedEmail({
      projectName: project.name,
      projectUrl,
      purpose: request.purpose,
      message: request.message,
      createdAt: request.createdAt,
      connectionsUrl,
      projectLabel: '项目',
    })
  }
}
