import { afterAll, describe, expect, it } from 'bun:test'
import { inArray } from 'drizzle-orm'
import { db } from '../../src/db'
import { projectConnectionRequests, projects } from '../../src/db/schema'
import { NOTIFICATION_TYPES } from '../../src/lib/mail/notification-types'
import { createProjectConnectionContentResolver } from '../../src/worker/project-connection-content'

const insertedRequestIds: number[] = []
const insertedProjectIds: number[] = []

async function insertRequest(overrides: Partial<typeof projectConnectionRequests.$inferInsert> = {}) {
  const [project] = await db
    .insert(projects)
    .values({ userId: '930001', status: 3, name: `平台项目 ${insertedProjectIds.length + 1}` })
    .$returningId()
  insertedProjectIds.push(project.id)
  const [row] = await db
    .insert(projectConnectionRequests)
    .values({
      projectId: project.id,
      receiverUserId: '930001',
      senderUserId: '930002',
      purpose: '合作交流',
      message: '希望交流产品设计经验。',
      senderContact: 'iv.ciphertext.test',
      status: 0,
      ...overrides,
    })
    .$returningId()
  insertedRequestIds.push(row.id)
  return { id: row.id, projectId: project.id, name: `平台项目 ${insertedProjectIds.length}` }
}

function buildResolver() {
  return createProjectConnectionContentResolver({
    db,
    webBaseUrl: 'https://shenicest.test/',
  })
}

afterAll(async () => {
  if (insertedRequestIds.length) {
    await db.delete(projectConnectionRequests).where(inArray(projectConnectionRequests.id, insertedRequestIds))
  }
  if (insertedProjectIds.length) {
    await db.delete(projects).where(inArray(projects.id, insertedProjectIds))
  }
})

describe('createProjectConnectionContentResolver', () => {
  it('renders the created-email with project wording and links', async () => {
    const request = await insertRequest()
    const content = await buildResolver()({
      id: request.id,
      connectionRequestId: request.id,
      notificationType: NOTIFICATION_TYPES.PROJECT_CONNECTION_CREATED,
      recipientEmail: 'owner@example.com',
    })

    expect(content).not.toBeNull()
    expect(content!.subject).toBe('[SheNicest] 你的项目收到一条新的建联申请')
    expect(content!.html).toContain(request.name)
    expect(content!.html).toContain(`href="https://shenicest.test/projects/${request.projectId}"`)
    expect(content!.html).toContain('href="https://shenicest.test/connections"')
    expect(content!.text).toContain('希望交流产品设计经验。')
  })

  it('renders the accepted-email and ignores unknown notification types', async () => {
    const request = await insertRequest({ status: 1, acceptedAt: new Date('2026-09-07T02:00:00Z') })
    const resolver = buildResolver()
    const content = await resolver({
      id: request.id,
      connectionRequestId: request.id,
      notificationType: NOTIFICATION_TYPES.PROJECT_CONNECTION_ACCEPTED,
      recipientEmail: 'sender@example.com',
    })
    expect(content!.subject).toBe('[SheNicest] 你的建联申请已被项目方接受')
    expect(content!.text).toContain('登录平台查看联系方式：https://shenicest.test/connections')

    expect(
      await resolver({
        id: 1,
        connectionRequestId: 99999999,
        notificationType: NOTIFICATION_TYPES.PROJECT_CONNECTION_CREATED,
        recipientEmail: 'x@example.com',
      }),
    ).toBeNull()
    expect(
      await resolver({
        id: 1,
        connectionRequestId: 1,
        notificationType: 'something_else',
        recipientEmail: 'x@example.com',
      }),
    ).toBeNull()
  })
})
