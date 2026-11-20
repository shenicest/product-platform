import type { Database } from '../../db'
import { projects } from '../../db/schema'
import { UserProfileService } from '../user/service'
import { UserIdentityService } from '../user-identity/service'
import { Role } from '../user-identity/model'
import { ProjectStatus } from '../project/model'
import type { ImportProjectItem, ProjectImportResponse } from './model'

type ProjectValues = Partial<typeof projects.$inferInsert>

function isValidUrl(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  try {
    const url = new URL(String(value))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function projectFields(item: ImportProjectItem): ProjectValues {
  const fields: ProjectValues = { name: item.name }
  if (item.tagline !== undefined) fields.tagline = item.tagline
  if (item.cover_url !== undefined) fields.coverUrl = item.cover_url
  if (item.demo_images !== undefined) fields.demoImages = item.demo_images
  if (item.demo_video_url !== undefined) fields.demoVideoUrl = item.demo_video_url
  if (item.demo_link !== undefined) fields.demoLink = item.demo_link
  if (item.stage !== undefined) fields.stage = item.stage
  if (item.categories !== undefined) fields.categories = item.categories
  if (item.problem_statement !== undefined) fields.problemStatement = item.problem_statement
  if (item.progress !== undefined) fields.progress = item.progress
  if (item.next_steps !== undefined) fields.nextSteps = item.next_steps
  if (item.differentiation !== undefined) fields.differentiation = item.differentiation
  if (item.business_model !== undefined) fields.businessModel = item.business_model
  if (item.team_name !== undefined) fields.teamName = item.team_name
  return fields
}

export class ProjectImportService {
  constructor(
    private db: Database,
    private users: UserProfileService,
    private userIdentity: UserIdentityService,
  ) {}

  async importProjects(sourceName: string, items: ImportProjectItem[]): Promise<ProjectImportResponse> {
    const response: ProjectImportResponse = { imported: 0, updated: 0, failed: [] }

    for (const item of items) {
      const invalid = this.invalidReason(item)
      if (invalid) {
        response.failed.push({ external_id: item.external_id, error: invalid })
        continue
      }

      const userId = await this.users.resolveUserIdByEmail(item.owner_email, item.owner_name)
      if (!userId) {
        response.failed.push({ external_id: item.external_id, error: '无法解析或创建项目属主（邮箱不可用）' })
        continue
      }

      // Imported owners must be able to open the Founder dashboard, the same as
      // a user who creates a project themselves. Idempotent upsert.
      await this.userIdentity.grantRole(userId, Role.Founder)

      const fields = { ...projectFields(item), userId }
      try {
        const [result] = await this.db
          .insert(projects)
          .values({
            ...fields,
            status: ProjectStatus.Live,
            sourceName,
            externalId: item.external_id,
          } as typeof projects.$inferInsert)
          // A manual operator delist/reject is respected: re-import updates
          // content and owner but never resurrects the lifecycle status.
          .onDuplicateKeyUpdate({ set: fields })
        if (result.affectedRows === 1) response.imported += 1
        else response.updated += 1
      } catch {
        response.failed.push({ external_id: item.external_id, error: '写入失败' })
      }
    }

    return response
  }

  private invalidReason(item: ImportProjectItem): string | null {
    for (const [field, value] of [
      ['cover_url', item.cover_url],
      ['demo_video_url', item.demo_video_url],
      ['demo_link', item.demo_link],
    ] as const) {
      if (!isValidUrl(value)) return `${field} 必须是有效的 http(s) 链接`
    }
    if (item.stage !== undefined && item.stage !== null && (item.stage < 0 || item.stage > 4)) {
      return 'stage 必须在 0-4 之间'
    }
    return null
  }
}
