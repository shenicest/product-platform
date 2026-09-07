// Delivery notification types. The delivery table is intentionally not
// hackathon-specific (PRD 19) so future Talent / platform-Project connection
// flows can add their own types here.
export const NOTIFICATION_TYPES = {
  CONNECTION_CREATED: 'hackathon_connection_created',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]
