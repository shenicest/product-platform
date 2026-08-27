import { like } from 'drizzle-orm'
import { db } from './index'
import { bathBookings } from './schema'

// Pre-seeded bookings from the signup sheet — these slots are already occupied.
// user_ids are placeholder values (`seed_*`) so they never collide with real
// numeric user ids and cannot be cancelled by mistake. The participant name is
// displayed via a hardcoded map in the frontend (apps/web/src/components/bath-booking.tsx),
// because placeholder user_ids do not resolve to a real application record.
const SEED_BOOKINGS = [
  // ♀ Female — 8/27
  { userId: 'seed_范心怡', date: '2026-08-27', timeSlot: '12:00', gender: 'female' },
  { userId: 'seed_张艾佳', date: '2026-08-27', timeSlot: '18:30', gender: 'female' },
  { userId: 'seed_罗晨菲', date: '2026-08-27', timeSlot: '19:00', gender: 'female' },
  { userId: 'seed_邓思涵', date: '2026-08-27', timeSlot: '19:30', gender: 'female' },
  { userId: 'seed_王佳音', date: '2026-08-27', timeSlot: '20:00', gender: 'female' },
  { userId: 'seed_范晓君', date: '2026-08-27', timeSlot: '20:30', gender: 'female' },
  { userId: 'seed_廖思怡', date: '2026-08-27', timeSlot: '21:00', gender: 'female' },
  // ♀ Female — 8/28
  { userId: 'seed_廖思怡', date: '2026-08-28', timeSlot: '20:30', gender: 'female' },
  { userId: 'seed_张艾佳', date: '2026-08-28', timeSlot: '21:00', gender: 'female' },
  // ♀ Female — 8/29
  { userId: 'seed_廖思怡', date: '2026-08-29', timeSlot: '20:30', gender: 'female' },
  // ♂ Male — 8/27
  { userId: 'seed_聂宇杰', date: '2026-08-27', timeSlot: '10:00', gender: 'male' },
  { userId: 'seed_王志宇', date: '2026-08-27', timeSlot: '19:00', gender: 'male' },
  { userId: 'seed_Alexandru', date: '2026-08-27', timeSlot: '20:30', gender: 'male' },
]

async function main() {
  console.log('Seeding occupied bath bookings...')

  // Clear previously seeded placeholder bookings first so the script is idempotent.
  const cleaned = await db.delete(bathBookings).where(like(bathBookings.userId, 'seed_%'))
  console.log(`  Cleaned ${cleaned[0].affectedRows} placeholder booking(s)`)

  for (const booking of SEED_BOOKINGS) {
    await db.insert(bathBookings).values(booking).execute()
    console.log(`  ✓ ${booking.date} ${booking.gender} ${booking.timeSlot}`)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
