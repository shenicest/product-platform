import { afterAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { count, eq, inArray } from 'drizzle-orm'
import {
  AnnouncementLevel,
  AnnouncementScope,
  AnnouncementType,
} from '@shenicest/shared'
import { db } from '../../../src/db'
import { announcementRecipients, announcements, userAnnouncementReads } from '../../../src/db/schema'
import { announcementModule, announcementService } from '../../../src/modules/announcement'
import { authHeaders, signToken } from '../../fixtures/auth'

const app = new Elysia().use(announcementModule)

const users = new Set<string>()
const announcementIds: number[] = []

/** 每个用例用自己的随机用户，互不继承读水位线。 */
function newUser(): string {
  const userId = `announcement-user-${crypto.randomUUID()}`
  users.add(userId)
  return userId
}

function track(id: number | null): number {
  if (id === null) throw new Error('expected an announcement id')
  announcementIds.push(id)
  return id
}

async function publishGlobal(overrides: Partial<Parameters<typeof announcementService.publishGlobal>[0]> = {}) {
  const result = await announcementService.publishGlobal({
    type: AnnouncementType.System,
    level: AnnouncementLevel.Info,
    title: '平台公告',
    content: '平台公告正文',
    createdBy: 'system',
    ...overrides,
  })
  return track(result.id)
}

async function request(userId: string | null, path: string, method: 'GET' | 'POST' = 'GET') {
  const headers = userId ? authHeaders(await signToken({ user_id: userId })) : undefined
  return app.handle(new Request(`http://localhost${path}`, { method, headers }))
}

async function summary(userId: string) {
  const response = await request(userId, '/me/announcements/summary')
  expect(response.status).toBe(200)
  return response.json() as Promise<{ unreadCount: number; lastReadAt: string | null }>
}

async function list(userId: string, query = '') {
  const response = await request(userId, `/me/announcements${query}`)
  expect(response.status).toBe(200)
  return response.json() as Promise<{
    items: Array<{ id: number; title: string; publishedAt: string; isRead: boolean }>
    nextCursor: string | null
    unreadCount: number
  }>
}

async function readAll(userId: string) {
  const response = await request(userId, '/me/announcements/read-all', 'POST')
  expect(response.status).toBe(200)
  return response.json() as Promise<{ lastReadAt: string; unreadCount: 0 }>
}

describe('Announcement routes', () => {
  afterAll(async () => {
    if (announcementIds.length > 0) {
      await db.delete(announcementRecipients).where(inArray(announcementRecipients.announcementId, announcementIds))
      await db.delete(announcements).where(inArray(announcements.id, announcementIds))
    }
    if (users.size > 0) {
      await db.delete(userAnnouncementReads).where(inArray(userAnnouncementReads.userId, [...users]))
    }
  })

  it('requires authentication on every route', async () => {
    expect((await request(null, '/me/announcements/summary')).status).toBe(401)
    expect((await request(null, '/me/announcements')).status).toBe(401)
    expect((await request(null, '/me/announcements/read-all', 'POST')).status).toBe(401)
  })

  // 必须先于任何发公告的用例：新用户没有任何水位行，也就没有任何历史未读。
  it('starts with no read watermark and zero unread', async () => {
    const userId = newUser()
    expect(await summary(userId)).toEqual({ unreadCount: 0, lastReadAt: null })
    expect((await list(userId)).items).toEqual([])
  })

  it('counts a global announcement for everyone and writes no recipient rows', async () => {
    const first = newUser()
    const second = newUser()
    const firstBefore = (await summary(first)).unreadCount
    const secondBefore = (await summary(second)).unreadCount
    const id = await publishGlobal({ title: '赛程系统维护' })

    expect((await summary(first)).unreadCount).toBe(firstBefore + 1)
    expect((await summary(second)).unreadCount).toBe(secondBefore + 1)

    const [recipients] = await db
      .select({ value: count() })
      .from(announcementRecipients)
      .where(eq(announcementRecipients.announcementId, id))
    expect(recipients?.value).toBe(0)

    const listed = await list(first)
    expect(listed.items.map((item) => item.id)).toContain(id)
    expect(listed.unreadCount).toBe(firstBefore + 1)
  })

  it('shows a targeted announcement only to its recipients', async () => {
    const recipient = newUser()
    const outsider = newUser()
    const recipientBefore = (await summary(recipient)).unreadCount
    const outsiderBefore = (await summary(outsider)).unreadCount

    const result = await announcementService.publishDirect([recipient], {
      type: AnnouncementType.Application,
      level: AnnouncementLevel.Success,
      title: '报名已通过审核',
      content: '请尽快完成组队',
      linkPath: '/me/applications',
      createdBy: 'system',
    })
    const id = track(result.id)

    expect((await summary(recipient)).unreadCount).toBe(recipientBefore + 1)
    expect((await summary(outsider)).unreadCount).toBe(outsiderBefore)
    expect((await list(recipient)).items.map((item) => item.id)).toContain(id)
    expect((await list(outsider)).items.map((item) => item.id)).not.toContain(id)
  })

  it('publishes inside a caller transaction (the shape business modules will use)', async () => {
    const userId = newUser()
    const before = (await summary(userId)).unreadCount
    await db.transaction(async (tx) => {
      const result = await announcementService.publishDirect(
        [userId],
        {
          type: AnnouncementType.Team,
          title: '队伍已成立',
          content: '队伍「像素花园」已创建',
          createdBy: 'system',
        },
        tx,
      )
      track(result.id)
    })
    expect((await summary(userId)).unreadCount).toBe(before + 1)
  })

  it('is idempotent on dedupeKey and skips a repeated recipient fan-out', async () => {
    const userId = newUser()
    const before = (await summary(userId)).unreadCount
    const input = {
      type: AnnouncementType.Application,
      title: '报名结果已更新',
      content: '你的报名状态已更新',
      createdBy: 'system',
      dedupeKey: `application:${crypto.randomUUID()}:accepted`,
    }
    const first = await announcementService.publishDirect([userId], input)
    track(first.id)
    const second = await announcementService.publishDirect([userId], input)

    expect(second).toEqual({ id: first.id, created: false })

    const [rows] = await db
      .select({ value: count() })
      .from(announcementRecipients)
      .where(eq(announcementRecipients.announcementId, first.id))
    expect(rows?.value).toBe(1)
    expect((await summary(userId)).unreadCount).toBe(before + 1)
  })

  it('marks everything read and only counts announcements published afterwards', async () => {
    const userId = newUser()
    await publishGlobal()
    expect((await summary(userId)).unreadCount).toBeGreaterThan(0)

    const marked = await readAll(userId)
    expect(marked.unreadCount).toBe(0)
    expect((await summary(userId)).unreadCount).toBe(0)

    await publishGlobal()
    expect((await summary(userId)).unreadCount).toBe(1)
    expect((await list(userId, '?unreadOnly=true')).items).toHaveLength(1)
  })

  it('never moves the read watermark backwards', async () => {
    const userId = newUser()
    const future = new Date(Date.now() + 60 * 60 * 1000)
    await db.insert(userAnnouncementReads).values({ userId, lastReadAt: future })

    const marked = await readAll(userId)
    expect(new Date(marked.lastReadAt).getTime()).toBe(future.getTime())
  })

  it('ignores an announcement whose published_at is still in the future', async () => {
    const userId = newUser()
    const before = (await summary(userId)).unreadCount
    const [result] = await db.insert(announcements).values({
      scope: AnnouncementScope.Global,
      type: AnnouncementType.System,
      title: '定时发布的公告',
      content: '还没到发布时间',
      publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdBy: 'system',
    })
    track(result.insertId)

    expect((await summary(userId)).unreadCount).toBe(before)
    expect((await list(userId)).items.map((item) => item.id)).not.toContain(result.insertId)
  })

  it('stops counting a revoked announcement, and drops it from the list', async () => {
    const userId = newUser()
    const before = (await summary(userId)).unreadCount
    const id = await publishGlobal()
    expect((await summary(userId)).unreadCount).toBe(before + 1)

    await db.update(announcements).set({ revokedAt: new Date() }).where(eq(announcements.id, id))
    expect((await summary(userId)).unreadCount).toBe(before)
    expect((await list(userId)).items.map((item) => item.id)).not.toContain(id)
  })

  it('paginates newest first with a stable (publishedAt, id) cursor', async () => {
    const userId = newUser()
    const newer = await publishGlobal({ title: '第二条' })
    const middle = await publishGlobal({ title: '第三条' })
    const oldest = await publishGlobal({ title: '第四条' })

    const firstPage = await list(userId, '?limit=2')
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.nextCursor).not.toBeNull()
    expect(firstPage.items[0]!.id).toBe(oldest)
    expect(firstPage.items[1]!.id).toBe(middle)

    const secondPage = await list(userId, `?limit=2&cursor=${firstPage.nextCursor}`)
    expect(secondPage.items.map((item) => item.id)).toContain(newer)

    const ids = [...firstPage.items, ...secondPage.items].map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('reports isRead against the watermark and filters unreadOnly', async () => {
    const userId = newUser()
    const readOne = await publishGlobal({ title: '已读的一条' })
    const readTwo = await publishGlobal({ title: '已读的另一条' })
    await readAll(userId)
    const unreadOne = await publishGlobal({ title: '新的未读' })

    const all = await list(userId)
    const byId = new Map(all.items.map((item) => [item.id, item]))
    expect(byId.get(readOne)?.isRead).toBe(true)
    expect(byId.get(readTwo)?.isRead).toBe(true)
    expect(byId.get(unreadOne)?.isRead).toBe(false)

    const unreadOnly = await list(userId, '?unreadOnly=true')
    expect(unreadOnly.items.map((item) => item.id)).toEqual([unreadOne])
    expect(unreadOnly.unreadCount).toBe(1)

    const invalid = await request(userId, '/me/announcements?cursor=not-a-cursor')
    expect(invalid.status).toBe(422)
  })

  it('refuses off-site link paths', async () => {
    for (const linkPath of ['//evil.example.com', 'https://evil.example.com', '/\\evil']) {
      await expect(
        announcementService.publishGlobal({
          type: AnnouncementType.System,
          title: '坏链接',
          content: '坏链接',
          createdBy: 'system',
          linkPath,
        }),
      ).rejects.toThrow('internal path')
    }
  })
})
