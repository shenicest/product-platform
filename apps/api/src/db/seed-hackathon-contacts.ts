import { db } from './index'
import { hackathonProjectContacts } from './schema'

// Preset receiver mappings for hackathon project connections (PRD 16).
// One row per (event_id, hackathon_project_id): `receiver_user_id` gates who
// can view/handle requests on the platform; `notification_email` is only the
// delivery address for reminder mail. Idempotent — rerun freely.
//
// To maintain the list, edit HACKATHON_PROJECT_CONTACTS below (or generate it
// from the ops TSV) and rerun: bun src/db/seed-hackathon-contacts.ts
type HackathonProjectContact = typeof hackathonProjectContacts.$inferInsert

const HACKATHON_PROJECT_CONTACTS: HackathonProjectContact[] = [
  {
    eventId: 4,
    hackathonProjectId: 1,
    receiverUserId: '1',
    notificationEmail: 'team@example.com',
    displayName: '示例项目方',
  },
]

async function seedHackathonContacts() {
  for (const contact of HACKATHON_PROJECT_CONTACTS) {
    await db
      .insert(hackathonProjectContacts)
      .values(contact)
      .onDuplicateKeyUpdate({
        set: {
          receiverUserId: contact.receiverUserId,
          notificationEmail: contact.notificationEmail,
          displayName: contact.displayName ?? null,
        },
      })
    console.log(
      `Upserted receiver for event ${contact.eventId} project ${contact.hackathonProjectId} -> user ${contact.receiverUserId}`,
    )
  }
  console.log(`Seeded ${HACKATHON_PROJECT_CONTACTS.length} hackathon project contacts`)
  process.exit(0)
}

seedHackathonContacts().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
