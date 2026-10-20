'use client'

import { ConnectionRequestButton } from '@/components/connection-request-button'
import { sendHackathonConnection, type MyHackathonConnectionStatus } from '@/lib/client-api'
import { HACKATHON_CONNECTION_STATUS_LABELS } from '@/lib/hackathon-project'
import { HACKATHON_CONNECTION_PURPOSES } from '@shenicest/shared'

export function hackathonPendingConnectKey(projectId: number) {
  return `shenicest_pending_hackathon_connect:${projectId}`
}

// Connection entry for hackathon project detail pages. The shared component
// owns the dialog and status behaviour; this wrapper supplies the hackathon
// purpose vocabulary, endpoint, and login return path.
export function HackathonConnectButton({
  projectId,
  initialStatus,
}: {
  projectId: number
  initialStatus: MyHackathonConnectionStatus | null
}) {
  return (
    <ConnectionRequestButton
      projectId={projectId}
      initialStatus={initialStatus}
      purposes={HACKATHON_CONNECTION_PURPOSES}
      statusLabels={HACKATHON_CONNECTION_STATUS_LABELS}
      pendingKey={hackathonPendingConnectKey}
      loginReturnTo={`/hackathon/projects/${projectId}`}
      send={sendHackathonConnection}
    />
  )
}
