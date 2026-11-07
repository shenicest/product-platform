import { and, count, eq } from 'drizzle-orm'
import { ChallengeStatus, SeasonParticipantStatus } from '@shenicest/shared'
import type { Database } from '../../db'
import {
  challenges,
  organizerOrgs,
  scheduleFromRow,
  seasonOrganizers,
  seasonParticipants,
  seasons,
} from '../../db/schema'
import { iso } from './validation'

export type SeasonRow = typeof seasons.$inferSelect

export interface SeasonSummaryDto {
  id: number
  code: string
  name: string
  type: string
  city: string | null
  status: string
  themes: string[]
  schedule: ReturnType<typeof scheduleFromRow>
  organizerOrgs: Array<{ id: number; name: string }>
  pinned: boolean
  participantCapacity: number | null
  approvedAt: string | null
  participantCount: number
  publishedChallengeCount: number
}

export async function getSeasonSummary(db: Database, row: SeasonRow): Promise<SeasonSummaryDto> {
  const [orgs, participantRows, challengeRows] = await Promise.all([
    db
      .select({ id: organizerOrgs.id, name: organizerOrgs.name })
      .from(seasonOrganizers)
      .innerJoin(organizerOrgs, eq(seasonOrganizers.orgId, organizerOrgs.id))
      .where(eq(seasonOrganizers.seasonId, row.id)),
    db
      .select({ value: count() })
      .from(seasonParticipants)
      .where(and(
        eq(seasonParticipants.seasonId, row.id),
        eq(seasonParticipants.status, SeasonParticipantStatus.Active),
      )),
    db
      .select({ value: count() })
      .from(challenges)
      .where(and(eq(challenges.seasonId, row.id), eq(challenges.status, ChallengeStatus.Published))),
  ])
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    city: row.city,
    status: row.status,
    themes: row.themes ?? [],
    schedule: scheduleFromRow(row),
    organizerOrgs: orgs,
    pinned: row.pinned,
    participantCapacity: row.participantCapacity,
    approvedAt: iso(row.approvedAt),
    participantCount: participantRows[0]?.value ?? 0,
    publishedChallengeCount: challengeRows[0]?.value ?? 0,
  }
}

export async function getSeasonSummaryById(db: Database, seasonId: number): Promise<SeasonSummaryDto | null> {
  const rows = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1)
  return rows[0] ? getSeasonSummary(db, rows[0]) : null
}
