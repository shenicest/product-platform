import { and, eq, sql } from 'drizzle-orm'
import { projectLikes, projects } from '../../db/schema'
import type { Database } from '../../db'
import { ProjectStatus } from '../project/model'
import { NotLikableError } from './model'

export class LikeService {
  constructor(private db: Database) {}

  async like(projectId: number, userId: string): Promise<{ liked: true; likeCount: number } | NotLikableError | null> {
    return this.db.transaction(async (tx) => {
      const [project] = await tx.select({ status: projects.status }).from(projects).where(eq(projects.id, projectId)).limit(1)
      if (!project) return null
      if (project.status !== ProjectStatus.Live) return new NotLikableError()

      const [insertResult] = await tx.execute(sql`INSERT IGNORE INTO ${projectLikes} (project_id, user_id) VALUES (${projectId}, ${userId})`)
      if (insertResult.affectedRows === 1) {
        await tx.update(projects).set({ likeCount: sql`${projects.likeCount} + 1` }).where(eq(projects.id, projectId))
      }

      const [updated] = await tx.select({ likeCount: projects.likeCount }).from(projects).where(eq(projects.id, projectId)).limit(1)
      return { liked: true, likeCount: updated.likeCount }
    })
  }

  async unlike(projectId: number, userId: string): Promise<{ liked: false; likeCount: number } | null> {
    return this.db.transaction(async (tx) => {
      const result = await tx.delete(projectLikes).where(and(eq(projectLikes.projectId, projectId), eq(projectLikes.userId, userId)))
      if (result[0].affectedRows === 1) {
        await tx.update(projects).set({ likeCount: sql`GREATEST(${projects.likeCount} - 1, 0)` }).where(eq(projects.id, projectId))
      }
      const [updated] = await tx.select({ likeCount: projects.likeCount }).from(projects).where(eq(projects.id, projectId)).limit(1)
      return updated ? { liked: false, likeCount: updated.likeCount } : null
    })
  }

  async getMyLikes(userId: string): Promise<number[]> {
    const rows = await this.db.select({ projectId: projectLikes.projectId }).from(projectLikes).where(eq(projectLikes.userId, userId))
    return rows.map(({ projectId }) => projectId)
  }
}
