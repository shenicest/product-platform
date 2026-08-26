import { db } from './index'
import { bathBookings } from './schema'

// Pre-seeded bookings for Aug 27 — these slots are already occupied.
// user_ids are placeholder values; replace with real user_ids from event_management.applications if needed.
const SEED_BOOKINGS = [
  // ♀ Female
  { userId: 'seed_female_1', date: '2026-08-27', timeSlot: '11:30', gender: 'female' },
  { userId: 'seed_female_2', date: '2026-08-27', timeSlot: '12:00', gender: 'female' },
  { userId: 'seed_female_3', date: '2026-08-27', timeSlot: '13:00', gender: 'female' },
  { userId: 'seed_female_4', date: '2026-08-27', timeSlot: '13:30', gender: 'female' },
  // ♂ Male
  { userId: 'seed_male_1', date: '2026-08-27', timeSlot: '11:30', gender: 'male' },
  { userId: 'seed_male_2', date: '2026-08-27', timeSlot: '12:30', gender: 'male' },
  { userId: 'seed_male_3', date: '2026-08-27', timeSlot: '13:00', gender: 'male' },
]

async function main() {
  console.log('Seeding bath bookings for 2026-08-27...')
  for (const booking of SEED_BOOKINGS) {
    await db.insert(bathBookings).values(booking).execute()
    console.log(`  ✓ ${booking.gender} ${booking.timeSlot}`)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
