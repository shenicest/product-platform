// Structured funnel-event logging (PRD 15.2). P0 has no analytics system, so
// key events go to stdout as one JSON line per event for log shipping/grep.
//
// Privacy contract: callers pass ONLY the PRD 15.2 allow-list — event name,
// eventId / hackathonProjectId / requestId, source, status, error code. The
// helper does not redact; never pass contacts, emails, message bodies, or
// ciphertext here.
export type EventFields = {
  eventId?: number
  hackathonProjectId?: number
  requestId?: number
  deliveryId?: number
  notificationType?: string
  source?: string
  status?: string | number
  errorCode?: string
}

export function logEvent(event: string, fields: EventFields = {}): void {
  console.log(JSON.stringify({ event, time: new Date().toISOString(), ...fields }))
}
