import { afterAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { ConnectionRequestStatus, ProjectStatus, Role, TalentProfileStatus } from '@shenicest/shared'
import { db } from '../../../src/db'
import { connectionDailyLimits, connectionRequests, projects, talentModerationRecords, talentProfiles, userIdentities } from '../../../src/db/schema'
import { talentModule, talentOperatorModule } from '../../../src/modules/talent'
import { SHARED_USERS_TABLE } from '../../../src/modules/user/service'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'

const app = new Elysia().use(talentModule).use(talentOperatorModule)
const base = Math.floor(700000000 + Math.random() * 10000000)
let nextUser = base
const users: string[] = []
const projectIds: number[] = []

function user() {
  const id = String(nextUser++)
  users.push(id)
  return id
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    headline: '全栈产品搭档',
    bio: '擅长从用户研究到产品交付，希望与认真解决真实问题的团队长期合作。',
    city: '上海',
    roles: ['开发'],
    skills: ['前端开发', '后端开发', '全栈开发'],
    seekingSkills: [],
    domains: ['效率工具'],
    durations: ['长期合作'],
    ...overrides,
  }
}

async function request(path: string, options: { userId?: string; method?: string; body?: unknown } = {}) {
  const token = options.userId ? await signToken({ user_id: options.userId }) : null
  return app.handle(new Request(`http://localhost${path}`, {
    method: options.method ?? 'GET',
    headers: token ? (options.body === undefined ? authHeaders(token) : jsonHeaders(token)) : options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }))
}

async function publish(userId: string, body = profile()) {
  return request('/talents/me', { userId, method: 'POST', body })
}

async function send(sender: string, receiver: string, overrides: Record<string, unknown> = {}) {
  return request('/talents/connections', {
    userId: sender,
    method: 'POST',
    body: { receiverUserId: receiver, purpose: '短期协作', message: '希望一起推进这个产品并验证市场需求，认真讨论合作方式并尽快开始执行。', wechat: `wx-${sender}`, ...overrides },
  })
}

async function grantOperator(userId: string) {
  await db.insert(userIdentities).values({ userId, role: Role.Operator })
}

async function sharedUser(userId: string, nickname: string) {
  await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname) VALUES (${Number(userId)}, ${nickname})`)
}

describe('Talent Plaza API', () => {
  afterAll(async () => {
    const profileRows = users.length ? await db.select({ id: talentProfiles.id }).from(talentProfiles).where(inArray(talentProfiles.userId, users)) : []
    if (profileRows.length) await db.delete(talentModerationRecords).where(inArray(talentModerationRecords.talentProfileId, profileRows.map((row) => row.id)))
    if (users.length) {
      await db.delete(connectionRequests).where(orUsers(users))
      await db.delete(connectionDailyLimits).where(inArray(connectionDailyLimits.senderUserId, users))
      await db.delete(talentProfiles).where(inArray(talentProfiles.userId, users))
      await db.delete(userIdentities).where(inArray(userIdentities.userId, users))
      await db.execute(sql`DELETE FROM ${sql.raw(SHARED_USERS_TABLE)} WHERE id IN (${sql.join(users.map((id) => sql`${Number(id)}`), sql`, `)})`)
    }
    if (projectIds.length) await db.delete(projects).where(inArray(projects.id, projectIds))
  })

  it('publishes, pauses, resumes without changing first publication time, and exposes management state', async () => {
    const owner = user()
    expect((await publish(owner)).status).toBe(200)
    const first = await db.select().from(talentProfiles).where(eq(talentProfiles.userId, owner)).then(([row]) => row)
    expect((await request('/talents/me/pause', { userId: owner, method: 'POST' })).status).toBe(200)
    expect((await request(`/talents/${owner}`)).status).toBe(404)
    const me = await request('/talents/me', { userId: owner })
    expect(me.status).toBe(200)
    expect((await me.json()).status).toBe(TalentProfileStatus.Paused)
    const resumed = await request('/talents/me/resume', { userId: owner, method: 'POST', body: profile({ city: '北京' }) })
    expect(resumed.status).toBe(200)
    const current = await db.select().from(talentProfiles).where(eq(talentProfiles.userId, owner)).then(([row]) => row)
    expect(current.status).toBe(TalentProfileStatus.Published)
    expect(current.publishedAt.getTime()).toBe(first.publishedAt.getTime())
  })

  it('validates and deduplicates the confirmed profile fields', async () => {
    const owner = user()
    expect((await publish(owner, profile({ headline: '短' }))).status).toBe(422)
    expect((await publish(owner, profile({ skills: ['前端开发', '后端开发'] }))).status).toBe(400)
    const invalidAfterDedupe = await db.select().from(talentProfiles).where(eq(talentProfiles.userId, owner))
    expect(invalidAfterDedupe).toHaveLength(0)
    const valid = await publish(owner, profile({ skills: ['前端开发', '前端开发', '后端开发', '全栈开发'], seekingSkills: [] }))
    expect(valid.status).toBe(200)
    expect((await valid.json()).skills).toEqual(['前端开发', '后端开发', '全栈开发'])
  })

  it('normalizes contacts and enforces the fixed purpose and message contract', async () => {
    const sender = user(); const receiver = user(); await publish(receiver)
    expect((await send(sender, receiver, { purpose: '自由目的' })).status).toBe(422)
    expect((await send(sender, receiver, { message: '太短' })).status).toBe(422)
    expect((await send(sender, receiver, { wechat: `good\nwechat` })).status).toBe(400)
    expect((await send(sender, receiver, { wechat: 'a'.repeat(65) })).status).toBe(422)
    const response = await send(sender, receiver, { wechat: '  good-wechat  ', email: '  PERSON@Example.COM ' })
    expect(response.status).toBe(200)
    const id = (await response.json()).id
    await request(`/talents/connections/${id}/accept`, { userId: receiver, method: 'POST', body: { email: '  RECEIVER@Example.COM ' } })
    const contacts = await request(`/talents/connections/${id}/contacts`, { userId: sender })
    expect((await contacts.json()).other.email).toBe('receiver@example.com')
  })

  it('filters before pagination, reports filtered total, supports new/active, searches headline, skills, nickname, and Live project name, and omits match', async () => {
    const first = user(); const second = user(); const unrelated = user()
    await sharedUser(first, '昵称检索目标')
    await publish(first, profile({ headline: '列表检索甲', skills: ['前端开发', '后端开发', '全栈开发'] }))
    await publish(second, profile({ headline: '列表检索乙', skills: ['前端开发', 'AI 开发', '数据开发'] }))
    await publish(unrelated, profile({ headline: '无关档案', skills: ['产品策略', '需求分析', '用户研究'] }))
    const [created] = await db.insert(projects).values({ userId: second, status: ProjectStatus.Live, name: '项目名称检索目标' })
    projectIds.push(created.insertId)
    await db.update(talentProfiles).set({ publishedAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-03') }).where(eq(talentProfiles.userId, first))
    await db.update(talentProfiles).set({ publishedAt: new Date('2024-01-02'), updatedAt: new Date('2024-01-02') }).where(eq(talentProfiles.userId, second))
    const page = await (await request('/talents/?q=%E5%88%97%E8%A1%A8%E6%A3%80%E7%B4%A2&skills=%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91&limit=1&offset=1')).json()
    expect(page.total).toBe(2)
    expect(page.data).toHaveLength(1)
    expect(page.data[0]).not.toHaveProperty('match')
    expect((await (await request('/talents/?q=%E6%98%B5%E7%A7%B0%E6%A3%80%E7%B4%A2%E7%9B%AE%E6%A0%87')).json()).data[0].userId).toBe(first)
    expect((await (await request('/talents/?q=%E9%A1%B9%E7%9B%AE%E5%90%8D%E7%A7%B0%E6%A3%80%E7%B4%A2%E7%9B%AE%E6%A0%87')).json()).data[0].userId).toBe(second)
    expect((await (await request('/talents/?q=%E5%88%97%E8%A1%A8%E6%A3%80%E7%B4%A2&sort=new')).json()).data[0].userId).toBe(second)
    expect((await (await request('/talents/?q=%E5%88%97%E8%A1%A8%E6%A3%80%E7%B4%A2&sort=active')).json()).data[0].userId).toBe(first)
  })

  it('allows no-profile and Paused senders, requires a Published receiver, forbids self and invalid projects', async () => {
    const sender = user(); const receiver = user(); const paused = user(); const hidden = user(); const otherOwner = user()
    await publish(receiver)
    await publish(paused)
    await request('/talents/me/pause', { userId: paused, method: 'POST' })
    await publish(hidden)
    await request('/talents/me/pause', { userId: hidden, method: 'POST' })
    expect((await send(sender, receiver)).status).toBe(200)
    expect((await send(paused, receiver)).status).toBe(200)
    expect((await send(user(), hidden)).status).toBe(404)
    expect((await send(receiver, receiver)).status).toBe(400)
    const [draft] = await db.insert(projects).values({ userId: sender, status: ProjectStatus.Draft, name: 'Draft' })
    const [other] = await db.insert(projects).values({ userId: otherOwner, status: ProjectStatus.Live, name: 'Other' })
    const validSender = user(); const validReceiver = user(); await publish(validReceiver)
    const [live] = await db.insert(projects).values({ userId: validSender, status: ProjectStatus.Live, name: 'Live' })
    projectIds.push(draft.insertId, other.insertId, live.insertId)
    const draftReceiver = user(); await publish(draftReceiver)
    const otherReceiver = user(); await publish(otherReceiver)
    expect((await send(sender, draftReceiver, { projectId: draft.insertId })).status).toBe(409)
    expect((await send(sender, otherReceiver, { projectId: other.insertId })).status).toBe(403)
    expect((await send(validSender, validReceiver, { projectId: live.insertId })).status).toBe(200)
  })

  it('enforces unordered Pending, permits retry after idempotent ignore, and blocks both directions after idempotent accept', async () => {
    const a = user(); const b = user(); await publish(a); await publish(b)
    const pending = await send(a, b)
    const id = (await pending.json()).id
    expect((await send(b, a)).status).toBe(409)
    const ignored = await request(`/talents/connections/${id}/ignore`, { userId: b, method: 'POST' })
    expect(ignored.status).toBe(200)
    expect((await request(`/talents/connections/${id}/ignore`, { userId: b, method: 'POST' })).status).toBe(200)
    const retry = await send(a, b)
    const retryId = (await retry.json()).id
    const accepted = await request(`/talents/connections/${retryId}/accept`, { userId: b, method: 'POST', body: { email: 'receiver@example.com' } })
    const acceptedAt = (await accepted.json()).acceptedAt
    const repeated = await request(`/talents/connections/${retryId}/accept`, { userId: b, method: 'POST', body: {} })
    expect(repeated.status).toBe(200)
    expect((await repeated.json()).acceptedAt).toBe(acceptedAt)
    expect((await send(a, b)).status).toBe(409)
    expect((await send(b, a)).status).toBe(409)
    expect((await request(`/talents/connections/${retryId}/ignore`, { userId: b, method: 'POST' })).status).toBe(409)
  })

  it('never leaks ciphertext and only gives Accepted contacts to participants', async () => {
    const sender = user(); const receiver = user(); const outsider = user(); await publish(receiver)
    const created = await send(sender, receiver, { wechat: 'secret-sender-wechat' })
    const createdBody = await created.json()
    const id = createdBody.id
    expect(JSON.stringify(createdBody)).not.toContain('secret-sender-wechat')
    expect((await request(`/talents/connections/${id}/contacts`, { userId: sender })).status).toBe(403)
    await request(`/talents/connections/${id}/accept`, { userId: receiver, method: 'POST', body: { email: 'secret-receiver@example.com' } })
    const senderContacts = await request(`/talents/connections/${id}/contacts`, { userId: sender })
    expect(senderContacts.status).toBe(200)
    expect((await senderContacts.json()).other.email).toBe('secret-receiver@example.com')
    expect((await request(`/talents/connections/${id}/contacts`, { userId: outsider })).status).toBe(403)
    const row = await db.select().from(connectionRequests).where(eq(connectionRequests.id, id)).then(([value]) => value)
    expect(row.senderContact).not.toContain('secret-sender-wechat')
    expect(JSON.stringify(await (await request('/talents/connections', { userId: sender })).json())).not.toContain(row.senderContact)
  })

  it('applies the no-profile/Paused limit of 3 and Published limit of 10 by the current Beijing date', async () => {
    const limited = user(); const published = user(); await publish(published)
    for (const [sender, maximum] of [[limited, 3], [published, 10]] as const) {
      const duplicateReceiver = user(); await publish(duplicateReceiver)
      expect((await send(sender, duplicateReceiver)).status).toBe(200)
      expect((await send(sender, duplicateReceiver)).status).toBe(409)
      for (let index = 1; index < maximum; index++) {
        const receiver = user(); await publish(receiver)
        const response = await send(sender, receiver)
        expect(response.status).toBe(200)
      }
      const extra = user(); await publish(extra)
      expect((await send(sender, extra)).status).toBe(409)
      expect((await (await send(sender, extra)).json()).error.code).toBe('RATE_LIMITED')
    }
  })

  it('suspension blocks sending/processing, cancels Pending, preserves Accepted, and records operator audit without contacts', async () => {
    const operator = user(); const target = user(); const sender = user(); const acceptedPeer = user()
    await grantOperator(operator); await publish(target); await publish(acceptedPeer)
    const pendingId = (await (await send(sender, target)).json()).id
    const acceptedId = (await (await send(target, acceptedPeer)).json()).id
    await request(`/talents/connections/${acceptedId}/accept`, { userId: acceptedPeer, method: 'POST', body: { wechat: 'accepted-peer' } })
    expect((await request(`/operator/talents/${target}/suspend`, { userId: sender, method: 'POST', body: { reason: '违规内容' } })).status).toBe(403)
    const suspended = await request(`/operator/talents/${target}/suspend`, { userId: operator, method: 'POST', body: { reason: '违规内容' } })
    expect(suspended.status).toBe(200)
    expect((await db.select().from(connectionRequests).where(eq(connectionRequests.id, pendingId)).then(([row]) => row.status))).toBe(ConnectionRequestStatus.Cancelled)
    expect((await db.select().from(connectionRequests).where(eq(connectionRequests.id, acceptedId)).then(([row]) => row.status))).toBe(ConnectionRequestStatus.Accepted)
    expect((await send(target, user())).status).toBe(409)
    expect((await request(`/talents/connections/${pendingId}/accept`, { userId: target, method: 'POST', body: { wechat: 'x' } })).status).toBe(409)
    const meResponse = await request('/talents/me', { userId: target })
    expect(meResponse.status).toBe(200)
    const me = await meResponse.json()
    expect(me.status).toBe(TalentProfileStatus.Suspended)
    expect(me.suspension.reason).toBe('违规内容')
    const audit = await request(`/operator/talents/${target}/suspension-audit`, { userId: operator })
    expect(audit.status).toBe(200)
    expect(JSON.stringify(await audit.json())).not.toContain('accepted-peer')
    expect((await request(`/operator/talents/${target}/suspension-audit`, { userId: sender })).status).toBe(403)
  })
})

function orUsers(values: string[]) {
  return sql`(${connectionRequests.senderUserId} IN (${sql.join(values.map((value) => sql`${value}`), sql`, `)}) OR ${connectionRequests.receiverUserId} IN (${sql.join(values.map((value) => sql`${value}`), sql`, `)}))`
}
