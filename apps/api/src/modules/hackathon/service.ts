import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { hackathonProjectHidden, hackathonProjectLikes } from '../../db/schema'
import type { EventManagementDatabase } from '../../db/event-management'

const HACKATHON_EVENT_ID = 4
const HACKATHON_PROJECTS_TABLE = 'projects'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type HackathonRow = {
  id: number; project_name: string; tagline: string | null; project_description: string | null
  cover_image_url: string | null; demo_link: string | null; video_link: string | null
  screenshot_urls: string | null; team_name: string | null; track_code: string | null
  github_repo_url: string | null; xiaohongshu_likes: number | null; event_id: number
}

function mapHackathonProject(row: HackathonRow) {
  let demoImages: string[] = []
  if (row.screenshot_urls) {
    try {
      const parsed = JSON.parse(row.screenshot_urls)
      demoImages = Array.isArray(parsed) ? parsed : []
    } catch {
      demoImages = []
    }
  }
  return {
    id: row.id, name: row.project_name, tagline: row.tagline, description: row.project_description,
    coverUrl: row.cover_image_url, demoLink: row.demo_link, demoVideoUrl: row.video_link, demoImages,
    teamName: row.team_name, track: row.track_code, githubUrl: row.github_repo_url,
     likeCount: 0, eventId: row.event_id,
  }
}

function clampLimit(raw: number | undefined) {
  return Math.max(1, Math.min(raw ?? DEFAULT_LIMIT, MAX_LIMIT))
}

function escapeSqlString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "''")
}

export class HackathonService {
  constructor(private eventDb: EventManagementDatabase, private platformDb = db) {}

  private async getLikeCounts(projectIds: number[]) {
    if (!projectIds.length) return new Map<number, number>()
    const rows = await this.platformDb.execute(sql`SELECT hackathon_project_id, COUNT(*) AS total FROM ${hackathonProjectLikes} WHERE hackathon_project_id IN (${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)}) GROUP BY hackathon_project_id`)
    return new Map((rows[0] as unknown as Array<{ hackathon_project_id: number; total: number }>).map((row) => [row.hackathon_project_id, Number(row.total)]))
  }

  private async getHiddenProjectIds() {
    const rows = await this.platformDb.select({ projectId: hackathonProjectHidden.hackathonProjectId })
      .from(hackathonProjectHidden)
      .where(eq(hackathonProjectHidden.eventId, HACKATHON_EVENT_ID))
    return rows.map(({ projectId }) => projectId)
  }

  private hiddenClause(hiddenIds: number[]) {
    return hiddenIds.length
      ? ` AND id NOT IN (${hiddenIds.join(',')})`
      : ''
  }

  async listProjects(query: { track?: 'software' | 'hardware' | 'game' | 'aigc'; q?: string; limit?: number; offset?: number }) {
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0
    const hiddenIds = await this.getHiddenProjectIds()
    const trackText = "CONCAT(COALESCE(track_code, ''), ' ', COALESCE(project_name, ''))"
    const trackWhere = query.track === 'hardware'
      ? ` AND (${trackText} LIKE '%硬件%' OR ${trackText} LIKE '%hardware%')`
      : query.track === 'game'
        ? ` AND (${trackText} LIKE '%游戏%' OR ${trackText} LIKE '%game%')`
        : query.track === 'aigc'
          ? ` AND (${trackText} LIKE '%aigc%' OR ${trackText} LIKE '%影像%')`
          : query.track === 'software'
              ? ` AND NOT (${trackText} LIKE '%硬件%' OR ${trackText} LIKE '%hardware%' OR ${trackText} LIKE '%游戏%' OR ${trackText} LIKE '%game%' OR ${trackText} LIKE '%aigc%' OR ${trackText} LIKE '%影像%')`
            : ''
    const search = query.q?.trim()
    const searchWhere = search
      ? ` AND (project_name LIKE '%${escapeSqlString(search)}%' OR team_name LIKE '%${escapeSqlString(search)}%' OR tagline LIKE '%${escapeSqlString(search)}%')`
      : ''
    const [rows, totals] = await Promise.all([
       this.eventDb.execute(sql.raw(`SELECT id, project_name, tagline, project_description, cover_image_url, demo_link, video_link, screenshot_urls, team_name, track_code, github_repo_url, xiaohongshu_likes, event_id FROM ${HACKATHON_PROJECTS_TABLE} WHERE event_id = ${HACKATHON_EVENT_ID}${this.hiddenClause(hiddenIds)}${trackWhere}${searchWhere} ORDER BY COALESCE(demo_order, 999999), id LIMIT ${limit} OFFSET ${offset}`)),
        this.eventDb.execute(sql.raw(`SELECT COUNT(*) AS total FROM ${HACKATHON_PROJECTS_TABLE} WHERE event_id = ${HACKATHON_EVENT_ID}${this.hiddenClause(hiddenIds)}${trackWhere}${searchWhere}`)),
     ])
    const data = (rows[0] as unknown as HackathonRow[]).map(mapHackathonProject)
    const counts = await this.getLikeCounts(data.map((project) => project.id))
    return {
      data: data.map((project) => ({ ...project, likeCount: counts.get(project.id) ?? 0 })),
      total: Number((totals[0] as unknown as { total: number }[])[0]?.total ?? 0),
    }
  }

  async getProject(projectId: number) {
    const hidden = await this.platformDb.select({ id: hackathonProjectHidden.id }).from(hackathonProjectHidden).where(and(eq(hackathonProjectHidden.eventId, HACKATHON_EVENT_ID), eq(hackathonProjectHidden.hackathonProjectId, projectId))).limit(1)
    if (hidden.length) return null
    const rows = await this.eventDb.execute(sql.raw(`SELECT id, project_name, tagline, project_description, cover_image_url, demo_link, video_link, screenshot_urls, team_name, track_code, github_repo_url, xiaohongshu_likes, event_id FROM ${HACKATHON_PROJECTS_TABLE} WHERE event_id = ${HACKATHON_EVENT_ID} AND id = ${projectId} LIMIT 1`))
    const row = (rows[0] as unknown as HackathonRow[])[0]
    if (!row) return null
    const [result] = await this.platformDb.select({ total: sql<number>`COUNT(*)` }).from(hackathonProjectLikes).where(eq(hackathonProjectLikes.hackathonProjectId, projectId))
    return { ...mapHackathonProject(row), likeCount: Number(result?.total ?? 0) }
  }

  async hideProject(projectId: number, userId: string) {
    if (!(await this.getProject(projectId))) return false
    await this.platformDb.insert(hackathonProjectHidden).values({ eventId: HACKATHON_EVENT_ID, hackathonProjectId: projectId, hiddenBy: userId }).onDuplicateKeyUpdate({ set: { hiddenBy: userId } })
    return true
  }

  async getMyLikes(userId: string) {
    const rows = await this.platformDb.select({ projectId: hackathonProjectLikes.hackathonProjectId }).from(hackathonProjectLikes).where(eq(hackathonProjectLikes.userId, userId))
    return rows.map(({ projectId }) => projectId)
  }

  async like(projectId: number, userId: string) {
    if (!(await this.getProject(projectId))) return null
    await this.platformDb.execute(sql`INSERT IGNORE INTO ${hackathonProjectLikes} (hackathon_project_id, user_id) VALUES (${projectId}, ${userId})`)
    return this.getProject(projectId)
  }

  async unlike(projectId: number, userId: string) {
    if (!(await this.getProject(projectId))) return null
    await this.platformDb.delete(hackathonProjectLikes).where(and(eq(hackathonProjectLikes.hackathonProjectId, projectId), eq(hackathonProjectLikes.userId, userId)))
    return this.getProject(projectId)
  }
}
