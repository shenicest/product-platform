import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { eq, inArray, like, sql } from 'drizzle-orm'
import { db } from '../../../src/db'
import { projects, rateLimitCounters, userIdentities } from '../../../src/db/schema'
import { projectImportModule } from '../../../src/modules/project-import'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { Role } from '../../../src/modules/user-identity/model'
import { ProjectStatus } from '../../../src/modules/project/model'

const SOURCE = 'test-source'
const API_KEY = 'test-import-key'

function createApp() {
  return new Elysia().use(projectImportModule)
}

function request(body: unknown, key?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (key !== undefined) headers['x-api-key'] = key
  return new Request('http://localhost/import/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

const item = (overrides: Record<string, unknown> = {}) => ({
  external_id: 'ext-1',
  owner_email: 'import-owner@example.com',
  owner_name: 'Import Owner',
  name: 'Imported Project',
  tagline: 'Imported tagline',
  ...overrides,
})

describe('POST /import/projects', () => {
  const app = createApp()
  const emails = ['import-owner@example.com', 'import-owner-2@example.com']
  const createdOwnerIds: string[] = []

  beforeAll(async () => {
    await db.execute(sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE email IN ('import-owner@example.com', 'import-owner-2@example.com')`)
    await db.delete(projects).where(like(projects.sourceName, '%test-source%'))
  })

  afterAll(async () => {
    await db.delete(projects).where(like(projects.sourceName, '%test-source%'))
    await db.execute(sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE email IN ('import-owner@example.com', 'import-owner-2@example.com')`)
    if (createdOwnerIds.length > 0) {
      await db.delete(userIdentities).where(inArray(userIdentities.userId, createdOwnerIds))
    }
    await db.delete(rateLimitCounters).where(like(rateLimitCounters.scope, 'import.projects.%'))
  })

  it('returns 401 without an API key', async () => {
    const res = await app.handle(request({ source_name: SOURCE, projects: [item()] }))
    expect(res.status).toBe(401)
  })

  it('returns 401 with an unknown API key', async () => {
    const res = await app.handle(request({ source_name: SOURCE, projects: [item()] }, 'wrong-key'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when body source_name disagrees with the key', async () => {
    const res = await app.handle(request({ source_name: 'another-source', projects: [item()] }, API_KEY))
    expect(res.status).toBe(403)
  })

  it('rejects an empty or oversized batch', async () => {
    const empty = await app.handle(request({ source_name: SOURCE, projects: [] }, API_KEY))
    expect(empty.status).toBe(422)

    const oversized = await app.handle(
      request({ source_name: SOURCE, projects: Array.from({ length: 21 }, (_, i) => item({ external_id: `ext-${i}` })) }, API_KEY),
    )
    expect(oversized.status).toBe(422)
  })

  it('imports a project Live and creates its owner in the shared users table', async () => {
    const res = await app.handle(request({ source_name: SOURCE, projects: [item()] }, API_KEY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(1)
    expect(body.updated).toBe(0)
    expect(body.failed).toEqual([])

    const [project] = await db.select().from(projects).where(like(projects.sourceName, SOURCE))
    expect(project).toBeDefined()
    expect(project.status).toBe(ProjectStatus.Live)
    expect(project.name).toBe('Imported Project')
    expect(project.externalId).toBe('ext-1')

    const [users] = (await db.execute(sql`SELECT id, email, nickname FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE email = 'import-owner@example.com' LIMIT 1`)) as unknown as [Array<{ id: number; email: string; nickname: string | null }>]
    expect(users[0]).toBeDefined()
    expect(users[0].nickname).toBe('Import Owner')
    expect(project.userId).toBe(String(users[0].id))
    createdOwnerIds.push(String(users[0].id))

    const identities = await db.select().from(userIdentities).where(eq(userIdentities.userId, String(users[0].id)))
    expect(identities.some((row) => row.role === Role.Founder)).toBe(true)
  })

  it('upserts on the same (source_name, external_id) instead of duplicating', async () => {
    const res = await app.handle(request({ source_name: SOURCE, projects: [item({ name: 'Renamed Project' })] }, API_KEY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.updated).toBe(1)

    const rows = await db.select().from(projects).where(like(projects.sourceName, SOURCE))
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Renamed Project')
  })

  it('marks an item failed when its owner email is unusable', async () => {
    const res = await app.handle(request({ source_name: SOURCE, projects: [item({ external_id: 'ext-bad', owner_email: 'not-an-email' })] }, API_KEY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.failed).toEqual([{ external_id: 'ext-bad', error: '无法解析或创建项目属主（邮箱不可用）' }])
  })

  it('rate-limits the source after its per-minute budget is exhausted', async () => {
    await db.delete(rateLimitCounters).where(like(rateLimitCounters.scope, 'import.projects.%'))
    let last: Response | null = null
    for (let i = 0; i < 11; i += 1) {
      last = await app.handle(request({ source_name: SOURCE, projects: [item({ external_id: `ext-rate-${i}` })] }, API_KEY))
    }
    expect(last!.status).toBe(429)
  })
})
