import { eq, inArray, sql } from 'drizzle-orm'
import { db } from './index'
import { projects, talentProfiles } from './schema'
import { UserIdentityService } from '../modules/user-identity/service'
import { Role } from '../modules/user-identity/model'
import { SHARED_USERS_TABLE } from '../modules/user/service'
import {
  CATEGORIES,
  COLLABORATION_DURATIONS,
  ProjectStatus,
  ProjectStage,
  TALENT_AVAILABILITY_LABELS,
  TalentAvailability,
  TalentProfileStatus,
  type TalentSkill,
} from '@shenicest/shared'

// Narrow demo values to the shared catalog unions so a typo (or a catalog
// rename/reorder) fails typecheck instead of silently seeding a stale value.
const domains = (...values: (typeof CATEGORIES)[number][]) => values
const durations = (...values: (typeof COLLABORATION_DURATIONS)[number][]) => values
const skillKeys = (...values: TalentSkill[]) => values

// Integer-string ids to match the external auth system's user ids, which the
// shared users table keys by integer.
const OPERATOR_USER_ID = process.env.OPERATOR_USER_ID ?? '2'
const FOUNDER_USER_ID = process.env.FOUNDER_USER_ID ?? '1'
// Talent Plaza demo profiles use dedicated integer-string user ids so each one
// resolves to a shared users row (nickname/avatar) for the public founder card.
// TalentProfile is independent of the Founder role (CONTEXT.md), so these
// users are not granted founder — they only get a shared users profile row.
const TALENT_USER_IDS = ['11', '12', '13', '14', '15']
const service = new UserIdentityService(db)

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`

const demoProjects: typeof projects.$inferInsert[] = [
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '月事轻记',
    tagline: '极简的经期与身体症状记录工具',
    coverUrl: cover('luna'),
    demoImages: [cover('luna-1'), cover('luna-2')],
    demoVideoUrl: 'https://www.youtube.com/watch?v=example-luna',
    demoLink: 'https://example.com/luna',
    stage: ProjectStage.Revenue,
    categories: ['女性健康', '生活方式'],
    problemStatement: '为重视数据隐私的成年女性解决经期记录应用广告多、订阅重、数据上云的问题，把身体数据的所有权交还给她。',
    progress: '已完成核心记录与预测功能，正在内测图表导出。',
    nextSteps: '上线本地备份与跨设备同步（端到端加密）。',
    differentiation: '全量数据本地存储，无广告无订阅，隐私可控。',
    businessModel: '一次性买断高级图表与导出功能。',
    userCount: 3200,
    monthlyRevenue: 8600,
    retentionRate: 46,
    seekingSkills: ['frontend', 'ui'],
    isOpenForBeta: true,
    betaDescription: '正在招募重视隐私的用户参与新版图表与导出的内测。',
    contactName: '林晓',
    contactEmail: 'hello@example.com',
    teamName: '轻记工作室',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '专注森林',
    tagline: '用种树的方式帮你放下手机',
    coverUrl: cover('forest'),
    demoLink: 'https://example.com/forest',
    stage: ProjectStage.Launched,
    categories: ['效率工具'],
    problemStatement: '为学生与知识工作者解决手机通知频繁打断专注、缺少正向反馈的问题，用游戏化机制建立深度工作习惯。',
    progress: 'MVP 已上线，核心种树与统计功能可用。',
    nextSteps: '增加好友共种与专注房间。',
    differentiation: '把专注时长具象成一棵树，放弃即枯萎。',
    businessModel: '免费使用，树木皮肤与主题内购。',
    userCount: 12000,
    retentionRate: 38,
    seekingSkills: ['growthStrategy', 'socialMedia'],
    isOpenForBeta: false,
    contactName: '陈默',
    contactPhone: '13800138000',
    teamName: '森林小队',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '词卡星球',
    tagline: '用间隔重复高效背单词',
    coverUrl: cover('planet'),
    demoImages: [cover('planet-1')],
    demoVideoUrl: 'https://www.bilibili.com/video/example-planet',
    demoLink: 'https://example.com/planet',
    stage: ProjectStage.Mvp,
    categories: ['教育学习'],
    problemStatement: '为备考学生与自学者解决传统背单词效率低、复习安排不科学、容易遗忘放弃的问题。',
    progress: '已完成间隔重复引擎与词书导入。',
    nextSteps: '上线 AI 例句与词根词缀解析。',
    differentiation: '间隔重复算法 + 游戏化连击双驱动。',
    seekingSkills: ['ai', 'contentPlanning'],
    isOpenForBeta: true,
    betaDescription: '招募备考用户试用 AI 例句功能。',
    contactName: '王航',
    contactWechat: 'wanghang-planet',
    teamName: '星球教育',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '接口哨兵',
    tagline: '五分钟接入的 API 监控与告警',
    coverUrl: cover('sentinel'),
    demoLink: 'https://example.com/sentinel',
    stage: ProjectStage.Prototype,
    categories: ['开发者工具'],
    problemStatement: '为独立开发者与小团队解决自建监控成本高、第三方方案配置繁琐价格不透明的问题。',
    progress: '已支持 HTTP 监控与邮件告警。',
    nextSteps: '增加 Webhook、Slack 与飞书告警渠道。',
    seekingSkills: ['backend'],
    isOpenForBeta: false,
    contactName: '赵一',
    contactWechat: 'zhao-sentinel',
    contactEmail: 'zhao@example.com',
    teamName: '哨兵实验室',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '一顿饭',
    tagline: '十分钟搞定一顿健康晚餐',
    coverUrl: cover('meal'),
    demoImages: [cover('meal-1'), cover('meal-2'), cover('meal-3')],
    demoLink: 'https://example.com/meal',
    stage: ProjectStage.Idea,
    categories: ['生活方式'],
    problemStatement: '为工作繁忙、想吃得健康但没时间研究的上班族解决外卖不健康、做饭太耗时的问题。',
    nextSteps: '完成食谱库原型并邀请 20 位上班族试用。',
    businessModel: '食材电商导流佣金。',
    isOpenForBeta: true,
    betaDescription: '招募想改善晚餐质量的用户试用一周餐计划。',
    contactName: '孙琪',
    contactPhone: '13900139000',
    contactEmail: 'sun@example.com',
    teamName: '一顿饭团队',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Draft,
    name: '草稿示例（未提交）',
    tagline: '这是一个草稿，不应出现在公开列表',
    stage: ProjectStage.Idea,
    categories: ['其他'],
    contactName: '草稿用户',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.PendingReview,
    name: '待审核示例',
    tagline: '已提交待审核，不应出现在公开列表',
    stage: ProjectStage.Mvp,
    categories: ['其他'],
    contactName: '待审核用户',
  },
]

function generatedProjects(count: number): typeof projects.$inferInsert[] {
  const rows: typeof projects.$inferInsert[] = []
  const stages = Object.values(ProjectStage)
  for (let index = 1; index <= count; index += 1) {
    const category = CATEGORIES[index % CATEGORIES.length]
    const stage = stages[index % stages.length]
    const withTraction = index % 3 !== 1
    rows.push({
      userId: FOUNDER_USER_ID,
      status: ProjectStatus.Live,
      name: `示例项目 ${String(index).padStart(2, '0')}`,
      tagline: `用于演示列表、筛选与分页的示例项目 ${index}`,
      coverUrl: cover(`gen-${index}`),
      demoLink: `https://example.com/gen-${index}`,
      stage,
      categories: [category],
      problemStatement: `为示例用户解决第 ${index} 类高频痛点，验证列表、筛选与分页的展示效果。`,
      progress: '演示数据。',
      nextSteps: `第 ${index} 个示例项目的下一步计划。`,
      differentiation: '演示数据。',
      businessModel: index % 2 === 0 ? '演示商业模式。' : null,
      userCount: withTraction ? index * 100 : null,
      monthlyRevenue: withTraction && index % 2 === 0 ? index * 500 : null,
      retentionRate: withTraction ? 30 + (index % 50) : null,
      seekingSkills: index % 4 === 0 ? ['productStrategy', 'frontend'] : null,
      isOpenForBeta: index % 3 === 0,
      betaDescription: index % 3 === 0 ? '演示 beta 招募。' : null,
      contactName: `示例联系人 ${index}`,
      contactEmail: index % 2 === 0 ? `contact${index}@example.com` : null,
      contactPhone: index % 2 === 1 ? `138000${String(index).padStart(5, '0')}` : null,
      teamName: '示例团队',
    })
  }
  return rows
}

// The shared users table is owned by the external auth system; the seed only
// touches it so dev data can demonstrate the public founder profile. Best
// effort — the platform works without it (founder simply isn't shown).
async function seedSharedUserProfiles() {
  const profiles = [
    { id: FOUNDER_USER_ID, nickname: '示例创始人', avatar: cover('founder-avatar') },
    { id: '11', nickname: '林一', avatar: cover('talent-11') },
    { id: '12', nickname: '陈二', avatar: cover('talent-12') },
    { id: '13', nickname: '王三', avatar: cover('talent-13') },
    { id: '14', nickname: '赵四', avatar: cover('talent-14') },
    { id: '15', nickname: '孙五', avatar: cover('talent-15') },
  ].filter((profile) => /^\d+$/.test(profile.id))
  for (const profile of profiles) {
    await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname, avatar_url)
      VALUES (${profile.id}, ${profile.nickname}, ${profile.avatar})
      ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_url = VALUES(avatar_url)`)
  }
  return profiles.length
}

// Talent Plaza demo profiles. Coverage target (ADR-0013 + Iss.06):
// - availability 三态: ActivelySeeking / OpenToChat / ConsultOnly each represented
// - bio/links 二选一: at least one bio-only (no links) and one links-only (no bio)
// - 双状态技能: both 双边 (skills + seekingSkills) and 单边 (skills only) represented
// - 多城市含「远程」: real cities plus the literal 「远程」 for remote collaboration
const demoTalentProfiles: typeof talentProfiles.$inferInsert[] = [
  {
    userId: '11',
    status: TalentProfileStatus.Published,
    headline: '擅长从 0 到 1 的 AI 产品经理',
    bio: '我做了 4 年开发者工具产品，擅长从用户研究到商业化落地，最近在探索 AI 辅助产品工作流。希望和扎实的技术合伙人一起把想法落地。',
    links: [],
    city: '深圳',
    availability: TalentAvailability.ActivelySeeking,
    skills: skillKeys('productStrategy', 'needsAnalysis', 'userResearch', 'projectManagement'),
    seekingSkills: skillKeys('frontend', 'ai'),
    domains: domains('开发者工具', '效率工具'),
    durations: durations('长期合作', '短期项目'),
  },
  {
    userId: '12',
    status: TalentProfileStatus.Published,
    headline: '全栈工程师，喜欢做能跑的东西',
    bio: null,
    links: ['https://github.com/example-fullstack', 'https://example.com/portfolio-12'],
    city: '远程',
    availability: TalentAvailability.OpenToChat,
    skills: skillKeys('frontend', 'backend', 'fullstack', 'mobile'),
    seekingSkills: [],
    domains: domains('开发者工具'),
    durations: durations('短期项目', '一次咨询'),
  },
  {
    userId: '13',
    status: TalentProfileStatus.Published,
    headline: '增长操盘手，擅长内容与社媒冷启动',
    bio: '我做了 5 年内容增长，从 0 到 10w 用户的冷启动做过 3 次，擅长把复杂产品讲清楚。最近在研究 AI 内容工作流。',
    links: ['https://example.com/growth-notes-13'],
    city: '上海',
    availability: TalentAvailability.ConsultOnly,
    skills: skillKeys('growthStrategy', 'contentPlanning', 'contentCreation', 'socialMedia', 'seo'),
    seekingSkills: skillKeys('productStrategy', 'businessStrategy'),
    domains: domains('效率工具', '生活方式'),
    durations: durations('一次咨询', '短期项目'),
  },
  {
    userId: '14',
    status: TalentProfileStatus.Published,
    headline: 'UI/UX 设计师，专注产品体验细节',
    bio: '独立设计师 6 年，服务过 20+ 早期团队，从品牌系统到界面落地都做。喜欢把模糊的想法变成清晰的界面。',
    links: [],
    city: '北京',
    availability: TalentAvailability.ActivelySeeking,
    skills: skillKeys('ui', 'ux', 'visual', 'branding'),
    seekingSkills: [],
    domains: domains('女性健康', '生活方式'),
    durations: durations('长期合作'),
  },
  {
    userId: '15',
    status: TalentProfileStatus.Published,
    headline: '数据分析师，关注留存与商业化',
    bio: null,
    links: ['https://example.com/data-portfolio-15'],
    city: '远程',
    availability: TalentAvailability.OpenToChat,
    skills: skillKeys('data', 'dataAnalysis', 'businessAnalysis'),
    seekingSkills: skillKeys('backend', 'ai'),
    domains: domains('开发者工具'),
    durations: durations('一次咨询', '短期项目'),
  },
]

async function seed() {
  await service.grantRole(OPERATOR_USER_ID, Role.Operator)
  console.log(`Seeded operator role for user: ${OPERATOR_USER_ID}`)

  try {
    const count = await seedSharedUserProfiles()
    console.log(`Seeded ${count} shared users profile(s) (founder + talent)`)
  } catch (err) {
    console.warn(`Skipped shared users profile (${SHARED_USERS_TABLE} not reachable): ${err}`)
  }

  await service.grantRole(FOUNDER_USER_ID, Role.Founder)
  await db.delete(projects).where(eq(projects.userId, FOUNDER_USER_ID))
  const rows = [...demoProjects, ...generatedProjects(20)]
  await db.insert(projects).values(rows)
  const liveCount = rows.filter((row) => row.status === ProjectStatus.Live).length
  console.log(`Seeded ${rows.length} demo projects (${liveCount} Live)`)

  await db.delete(talentProfiles).where(inArray(talentProfiles.userId, TALENT_USER_IDS))
  await db.insert(talentProfiles).values(demoTalentProfiles)
  const availabilityBreakdown = demoTalentProfiles
    .map((profile) => TALENT_AVAILABILITY_LABELS[profile.availability as TalentAvailability])
    .join(' / ')
  console.log(`Seeded ${demoTalentProfiles.length} talent profiles (${availabilityBreakdown})`)

  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
