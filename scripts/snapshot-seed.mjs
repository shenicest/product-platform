#!/usr/bin/env node
/**
 * Prepare the dev database and auth tokens so every page in the UI-snapshot set
 * renders with real content.
 *
 *   node scripts/snapshot-seed.mjs
 *
 * Why this exists: a snapshot is server-rendered markup, so an empty database
 * produces empty states and an anonymous request produces a login redirect. Both
 * are correct behaviour and useless for a UI walkthrough. This script fills the
 * gaps the regular `bun run seed` leaves (it only seeds projects and roles):
 *
 *   - talent profiles, so /talents and /talents/me/edit have something to show
 *   - hackathon projects (event_management), so /hackathon and its detail page work
 *   - connection requests, so /connections shows every card state
 *   - signed JWTs, so the auth-gated pages render instead of redirecting
 *
 * Connection rows are written through the API rather than by INSERT: the contact
 * columns are AES-GCM encrypted at the service layer, and a hand-written row
 * would make /connections throw on decrypt. Every other table is plain data and
 * is upserted directly, so rerunning is safe.
 *
 * Tokens are written to .scratch/snapshot/tokens.json for the orchestrator.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { SignJWT } from 'jose'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, '.scratch/snapshot')

// --------------------------------------------------------------- env / db ---

/** Minimal .env reader: `KEY=value`, `#` comments, optional surrounding quotes. */
async function readEnvFile(file) {
  let text
  try {
    text = await fs.readFile(file, 'utf8')
  } catch {
    return {}
  }
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

// --------------------------------------------------------------- fixtures ---

const TALENTS = [
  {
    userId: '101',
    nickname: '林一舟',
    avatarSeed: 'avatar-101',
    headline: '全栈工程师 · 想做有温度的产品',
    bio: '五年 Web 全栈经验，独立做过三个副业产品，擅长把想法快速做成能用的原型。想找一位懂设计的伙伴，一起做面向女性的工具类产品。',
    city: '上海',
    roles: ['开发', '产品'],
    skills: ['frontend', 'backend', 'fullstack', 'ai'],
    seekingSkills: ['ui', 'visual'],
    domains: ['效率工具', '女性健康'],
    durations: ['长期合作', '短期项目'],
  },
  {
    userId: '102',
    nickname: '苏晚',
    avatarSeed: 'avatar-102',
    headline: '产品设计师 · 专注 B 端与工具类体验',
    bio: '八年设计经验，从 0 到 1 带过两款 SaaS 产品的设计体系。擅长把复杂流程压缩成三步，喜欢和工程师坐在一起改稿。寻找有真实用户的产品深度参与。',
    city: '杭州',
    roles: ['设计', '产品'],
    skills: ['ui', 'ux', 'visual', 'userResearch'],
    seekingSkills: ['frontend', 'productStrategy'],
    domains: ['效率工具', '开发者工具'],
    durations: ['长期合作'],
  },
  {
    userId: '103',
    nickname: '陈知微',
    avatarSeed: 'avatar-103',
    headline: '增长负责人 · 内容与社群双轮驱动',
    bio: '从 0 做到 50 万注册用户，主要靠内容选题和社群冷启动。相信早期增长不是投放，而是把产品讲到目标用户听得懂。想加入一个已经有人愿意付费的项目。',
    city: '北京',
    roles: ['增长', '运营'],
    skills: ['growthStrategy', 'contentPlanning', 'socialMedia', 'seo'],
    seekingSkills: ['productStrategy', 'dataAnalysis'],
    domains: ['教育学习', '生活方式'],
    durations: ['短期项目', '长期合作'],
  },
  {
    userId: '104',
    nickname: '周牧',
    avatarSeed: 'avatar-104',
    headline: '数据分析师 · 用数据回答产品问题',
    bio: '六年在消费与教育行业做数据分析，习惯先定义问题再取数。能搭指标体系、写 SQL、做看板，也能把结论讲给非技术同事听。希望参与早期产品的度量体系搭建。',
    city: '深圳',
    roles: ['数据', '运营'],
    skills: ['dataAnalysis', 'businessAnalysis', 'userResearch'],
    seekingSkills: ['productStrategy', 'backend'],
    domains: ['教育学习', '效率工具'],
    durations: ['一次咨询', '短期项目'],
  },
  {
    userId: '105',
    nickname: '何迟',
    avatarSeed: 'avatar-105',
    headline: '社区运营 · 把冷启动社群做热',
    bio: '做过三个产品的社区冷启动，擅长设计激励规则和线下活动。认为社区运营的核心是让早期用户互相认识，而不是官方一直说话。寻找需要从零建社区的团队。',
    city: '成都',
    roles: ['运营', '增长'],
    skills: ['communityOperations', 'userOperations', 'eventOperations', 'customerSuccess'],
    seekingSkills: ['contentCreation', 'brandCommunication'],
    domains: ['生活方式', '女性健康'],
    durations: ['短期项目', '长期合作'],
  },
  {
    // The seeded founder also keeps a profile: it makes the talent wall show a
    // founder-owned card and lets /talents/me/edit open with data filled in.
    userId: '1',
    nickname: '示例创始人',
    avatarSeed: 'founder-avatar',
    headline: '连续创业者 · 正在做第二款产品',
    bio: '做过两款面向女性的工具类产品，第一款跑到月收入两万后停掉，现在专注做隐私优先的记录工具。需要一位设计合伙人补齐体验，也欢迎增长和数据方向的朋友交流。',
    city: '上海',
    roles: ['产品', '商务/职能'],
    skills: ['productStrategy', 'businessStrategy', 'fundraising', 'needsAnalysis'],
    seekingSkills: ['ui', 'ux', 'growthStrategy'],
    domains: ['女性健康', '效率工具'],
    durations: ['长期合作', '一次咨询'],
  },
]

const HACKATHON_PROJECTS = [
  {
    id: 1,
    name: '潮汐日记',
    tagline: '把经期、情绪与睡眠画成一条潮汐线',
    description:
      '一个只存在本地的身体记录工具。每天用三次点击记录状态，一个月后自动生成一张潮汐图，让你看见自己的周期规律。所有数据加密后保存在设备上，不上传服务器。',
    coverSeed: 'hack-tide',
    demoLink: 'https://example.com/tide',
    screenshots: ['hack-tide-1', 'hack-tide-2'],
    teamName: '潮汐小队',
    track: 'software',
    github: 'https://github.com/example/tide',
    likes: 128,
    order: 1,
  },
  {
    id: 2,
    name: '拾光盒子',
    tagline: '给独居老人的一键视频信箱',
    description:
      '一台放在客厅的小设备，子女用手机录一段视频，老人按一下就能播放。反过来老人按另一个键录制，自动同步给家人。硬件成本控制在两百元以内。',
    coverSeed: 'hack-box',
    demoLink: 'https://example.com/box',
    screenshots: ['hack-box-1'],
    teamName: '拾光组',
    track: 'hardware',
    github: 'https://github.com/example/box',
    likes: 96,
    order: 2,
  },
  {
    id: 3,
    name: '字里行间',
    tagline: '用 AI 把长文变成可玩的阅读关卡',
    description:
      '把一篇长文章拆成若干关卡，每关要求你回答一个理解问题才能继续。适合备考和通勤阅读。内置了十二篇示例长文，可以直接体验完整流程。',
    coverSeed: 'hack-word',
    demoLink: 'https://example.com/word',
    screenshots: ['hack-word-1', 'hack-word-2'],
    teamName: '字里行间',
    track: 'aigc',
    github: 'https://github.com/example/word',
    likes: 212,
    order: 3,
  },
  {
    id: 4,
    name: '夜市大亨',
    tagline: '在两平米的摊位上做一晚生意',
    description:
      '一款模拟夜市经营的休闲游戏。你要在有限的备货预算里选品、定价、应对突发天气，目标是撑过三十天。美术风格参考九十年代香港夜市。',
    coverSeed: 'hack-night',
    demoLink: 'https://example.com/night',
    screenshots: ['hack-night-1'],
    teamName: '夜市三人组',
    track: 'game',
    github: 'https://github.com/example/night',
    likes: 174,
    order: 4,
  },
  {
    id: 5,
    name: '慢下来',
    tagline: '给注意力涣散的人一个五分钟呼吸入口',
    description:
      '打开就是一次五分钟的呼吸引导，没有注册、没有会员、没有推送。做完可以记录当下的情绪，形成一条只给自己看的曲线。',
    coverSeed: 'hack-breathe',
    demoLink: 'https://example.com/breathe',
    screenshots: ['hack-breathe-1'],
    teamName: '慢小组',
    track: 'software',
    github: 'https://github.com/example/breathe',
    likes: 63,
    order: 5,
  },
  {
    id: 6,
    name: '线稿工坊',
    tagline: '把手绘线稿一键变成可编辑矢量图',
    description:
      '拍一张手绘草图，自动识别线条并输出可编辑的 SVG，支持分层和改色。面向插画师和产品设计师的日常草图整理场景。',
    coverSeed: 'hack-vector',
    demoLink: 'https://example.com/vector',
    screenshots: ['hack-vector-1'],
    teamName: '线稿组',
    track: 'aigc',
    github: 'https://github.com/example/vector',
    likes: 189,
    order: 6,
  },
]

const HACKATHON_EVENT_ID = 4

// Connection fixtures. `purpose` and `message` must satisfy the API schema
// (message 30-500 chars, purpose from CONNECTION_PURPOSES).
const CONNECTIONS = [
  {
    sender: '101',
    receiver: '1',
    purpose: '共同创业',
    message:
      '你好，看了你的项目介绍很感兴趣。我做过三款工具类产品的全栈，想聊聊有没有一起做第二款的可能。',
    wechat: 'linyizhou_demo',
    accept: false,
  },
  {
    sender: '102',
    receiver: '1',
    purpose: '加入项目',
    message:
      '我是产品设计师，做过两款 SaaS 的设计体系。你的隐私记录工具我很想参与，可以先从体验梳理开始。',
    email: 'suwan@example.com',
    // Accepted, so /connections renders the revealed-contacts state.
    accept: { wechat: 'founder_demo_wechat', email: 'founder@example.com' },
  },
  {
    sender: '1',
    receiver: '103',
    purpose: '专业咨询',
    message:
      '想请教一下早期产品从零做内容冷启动的路径，我们现在的用户主要是靠口碑来的，希望能系统一点。',
    wechat: 'founder_demo_wechat',
    accept: false,
  },
  {
    sender: '104',
    receiver: '1',
    purpose: '认识交流',
    message:
      '你好，我一直在关注隐私优先的工具产品，想认识一下交流行业里的观察，不知道方不方便。',
    email: 'zhoumu@example.com',
    // Ignored, so the panel shows a handled request too.
    ignore: true,
  },
]

// ---------------------------------------------------------------- seeding ---

const cover = (seed, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`

async function seedTalentProfiles(db) {
  for (const t of TALENTS) {
    await db.execute(
      `INSERT INTO talent_profiles
         (user_id, status, headline, bio, city, roles, skills, seeking_skills, domains, durations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status), headline = VALUES(headline), bio = VALUES(bio),
         city = VALUES(city), roles = VALUES(roles), skills = VALUES(skills),
         seeking_skills = VALUES(seeking_skills), domains = VALUES(domains),
         durations = VALUES(durations)`,
      [
        t.userId,
        0, // TalentProfileStatus.Published
        t.headline,
        t.bio,
        t.city,
        JSON.stringify(t.roles),
        JSON.stringify(t.skills),
        JSON.stringify(t.seekingSkills),
        JSON.stringify(t.domains),
        JSON.stringify(t.durations),
      ],
    )
  }
  console.log(`  talent profiles      ${TALENTS.length}`)
}

async function seedSharedUsers(eventDb) {
  for (const t of TALENTS) {
    if (!/^\d+$/.test(t.userId)) continue
    await eventDb.execute(
      `INSERT INTO users (id, nickname, avatar_url) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_url = VALUES(avatar_url)`,
      [Number(t.userId), t.nickname, cover(t.avatarSeed, 200, 200)],
    )
  }
  console.log(`  shared user profiles ${TALENTS.length}`)
}

async function seedHackathonProjects(eventDb) {
  for (const p of HACKATHON_PROJECTS) {
    await eventDb.execute(
      `INSERT INTO projects
         (id, event_id, project_name, tagline, project_description, cover_image_url,
          demo_link, video_link, screenshot_urls, team_name, track_code, github_repo_url,
          xiaohongshu_likes, demo_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         event_id = VALUES(event_id), project_name = VALUES(project_name),
         tagline = VALUES(tagline), project_description = VALUES(project_description),
         cover_image_url = VALUES(cover_image_url), demo_link = VALUES(demo_link),
         screenshot_urls = VALUES(screenshot_urls), team_name = VALUES(team_name),
         track_code = VALUES(track_code), github_repo_url = VALUES(github_repo_url),
         demo_order = VALUES(demo_order)`,
      [
        p.id,
        HACKATHON_EVENT_ID,
        p.name,
        p.tagline,
        p.description,
        cover(p.coverSeed, 1200, 800),
        p.demoLink,
        null,
        JSON.stringify(p.screenshots.map((s) => cover(s, 1200, 800))),
        p.teamName,
        p.track,
        p.github,
        p.likes,
        p.order,
      ],
    )
  }
  console.log(`  hackathon projects   ${HACKATHON_PROJECTS.length}`)
}

/**
 * Assign a receiver to every hackathon project.
 *
 * Without this row the detail page's connect button renders disabled
 * (`receiverConfigured: false`), which hides a state the walkthrough needs to
 * show. User 1 is the seeded founder, so they can also act on the requests.
 */
async function seedHackathonContacts(db) {
  for (const p of HACKATHON_PROJECTS) {
    await db.execute(
      `INSERT INTO hackathon_project_contacts
         (event_id, hackathon_project_id, receiver_user_id, notification_email)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         receiver_user_id = VALUES(receiver_user_id),
         notification_email = VALUES(notification_email)`,
      [HACKATHON_EVENT_ID, p.id, '1', 'team@example.com'],
    )
  }
  console.log(`  hackathon contacts   ${HACKATHON_PROJECTS.length}`)
}

async function mintTokens(secret, userIds) {
  const key = new TextEncoder().encode(secret)
  const tokens = {}
  for (const userId of userIds) {
    tokens[userId] = await new SignJWT({
      user_id: Number(userId),
      email: `user${userId}@example.com`,
      role: 'user',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('shenicest.com')
      .setAudience('shenicest.com')
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(key)
  }
  return tokens
}

async function apiRequest(baseUrl, method, pathname, token, body) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { cookie: `shenicest_token=${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON error page */
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function seedConnections(apiUrl, tokens) {
  const auth = (userId) => tokens[userId]

  // Confirm the API is reachable before touching it: the failure mode otherwise
  // is a wall of fetch errors that looks like a seeding bug.
  try {
    const res = await fetch(`${apiUrl}/projects?limit=1`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    throw new Error(
      `cannot reach the API at ${apiUrl} (${err.message}).\n` +
        'Start it first: bun run dev',
    )
  }

  // Existing pairs per sender, so reruns don't duplicate. The API's own
  // duplicate protection only covers Pending/Accepted (the unique index is on
  // pair_key, which an Ignored row clears), so an ignored request would
  // otherwise be recreated on every run.
  const seen = new Map()
  for (const sender of new Set(CONNECTIONS.map((c) => c.sender))) {
    const res = await apiRequest(apiUrl, 'GET', '/connections', auth(sender))
    if (!res.ok) throw new Error(`GET /connections failed for ${sender}: ${res.status}`)
    seen.set(sender, new Set((res.json?.data ?? []).map((row) => row.receiverUserId)))
  }

  for (const c of CONNECTIONS) {
    const label = `${c.sender} -> ${c.receiver}`
    if (seen.get(c.sender)?.has(c.receiver)) {
      console.log(`  connection ${label.padEnd(10)} exists, skipped`)
      continue
    }

    const sent = await apiRequest(apiUrl, 'POST', '/talents/connections', auth(c.sender), {
      receiverUserId: c.receiver,
      purpose: c.purpose,
      message: c.message,
      ...(c.wechat ? { wechat: c.wechat } : {}),
      ...(c.email ? { email: c.email } : {}),
    })

    if (!sent.ok) {
      const code = sent.json?.error?.code ?? sent.text.slice(0, 120)
      if (code === 'PENDING_EXISTS' || code === 'ALREADY_CONNECTED') {
        console.log(`  connection ${label.padEnd(10)} exists, skipped`)
        continue
      }
      throw new Error(`connection ${label} failed: ${sent.status} ${code}`)
    }

    const id = sent.json?.id
    if (c.accept) {
      const res = await apiRequest(apiUrl, 'POST', `/talents/connections/${id}/accept`, auth(c.receiver), c.accept)
      if (!res.ok) throw new Error(`accept ${label} failed: ${res.status} ${res.text.slice(0, 120)}`)
      console.log(`  connection ${label.padEnd(10)} accepted (id ${id})`)
    } else if (c.ignore) {
      const res = await apiRequest(apiUrl, 'POST', `/talents/connections/${id}/ignore`, auth(c.receiver), {})
      if (!res.ok) throw new Error(`ignore ${label} failed: ${res.status} ${res.text.slice(0, 120)}`)
      console.log(`  connection ${label.padEnd(10)} ignored (id ${id})`)
    } else {
      console.log(`  connection ${label.padEnd(10)} pending (id ${id})`)
    }
  }
}

// ------------------------------------------------------------------- main ---

async function main() {
  const env = await readEnvFile(path.join(ROOT, 'apps/api/.env'))
  const secret = env.SHENICEST_JWT_SECRET ?? process.env.SHENICEST_JWT_SECRET
  const databaseUrl = env.DATABASE_URL ?? process.env.DATABASE_URL
  const eventDatabaseUrl = env.EVENT_MANAGEMENT_DATABASE_URL ?? process.env.EVENT_MANAGEMENT_DATABASE_URL
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  if (!secret) throw new Error('SHENICEST_JWT_SECRET missing (apps/api/.env)')
  if (!databaseUrl) throw new Error('DATABASE_URL missing (apps/api/.env)')
  if (!eventDatabaseUrl) throw new Error('EVENT_MANAGEMENT_DATABASE_URL missing (apps/api/.env)')

  console.log('seeding snapshot fixtures')

  const platformDb = await mysql.createConnection(databaseUrl)
  const eventDb = await mysql.createConnection(eventDatabaseUrl)
  try {
    await seedTalentProfiles(platformDb)
    await seedSharedUsers(eventDb)
    await seedHackathonProjects(eventDb)
    await seedHackathonContacts(platformDb)
  } finally {
    await platformDb.end()
    await eventDb.end()
  }

  // Tokens cover every user a fixture page needs: the seeded founder, the
  // founder that owns project 28, and each talent that sends or receives a
  // connection.
  const userIds = ['1', '4652', ...TALENTS.map((t) => t.userId)]
  const tokens = await mintTokens(secret, [...new Set(userIds)])
  console.log(`  auth tokens          ${Object.keys(tokens).length}`)

  await seedConnections(apiUrl, tokens)

  await fs.mkdir(OUT_DIR, { recursive: true })
  const tokensFile = path.join(OUT_DIR, 'tokens.json')
  await fs.writeFile(tokensFile, JSON.stringify(tokens, null, 2), 'utf8')

  console.log(`\nwrote ${path.relative(ROOT, tokensFile)}`)
  console.log('next: node scripts/snapshot-all.mjs')
}

main().catch((err) => {
  console.error(`\nerror: ${err?.message ?? err}`)
  process.exit(1)
})
