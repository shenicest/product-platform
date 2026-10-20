'use client'

import { ConnectionRequestButton } from '@/components/connection-request-button'
import { sendProjectConnection, type MyProjectConnectionStatus } from '@/lib/client-api'
import { PROJECT_CONNECTION_STATUS_LABELS } from '@/lib/project-connection'
import { PROJECT_CONNECTION_PURPOSES } from '@shenicest/shared'

export function projectPendingConnectKey(projectId: number) {
  return `shenicest_pending_project_connect:${projectId}`
}

// Connection entry for platform project detail pages. The shared component
// owns the dialog and status behaviour; this wrapper supplies the project
// purpose vocabulary, endpoint, and login return path.
export function ProjectConnectButton({
  projectId,
  initialStatus,
}: {
  projectId: number
  initialStatus: MyProjectConnectionStatus | null
}) {
  return (
    <ConnectionRequestButton
      projectId={projectId}
      initialStatus={initialStatus}
      purposes={PROJECT_CONNECTION_PURPOSES}
      statusLabels={PROJECT_CONNECTION_STATUS_LABELS}
      pendingKey={projectPendingConnectKey}
      loginReturnTo={`/projects/${projectId}`}
      send={sendProjectConnection}
      contactFields={['wechat', 'phone', 'email']}
    />
  )
}
