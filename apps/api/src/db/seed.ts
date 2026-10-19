import { eq, sql } from 'drizzle-orm'
import { db } from './index'
import { projects } from './schema'
import { UserIdentityService } from '../modules/user-identity/service'
import { Role } from '../modules/user-identity/model'
import { SHARED_USERS_TABLE } from '../modules/user/service'
import { CATEGORIES, ProjectStatus, ProjectStage } from '@shenicest/shared'

// Integer-string ids to match the external auth system's user ids, which the
// shared users table keys by integer.
const OPERATOR_USER_ID = process.env.OPERATOR_USER_ID ?? '2'
const FOUNDER_USER_ID = process.env.FOUNDER_USER_ID ?? '1'
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
    seekingSkills: ['前端开发', 'UI 设计'],
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
    seekingSkills: ['增长策略', '社交媒体'],
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
    seekingSkills: ['AI 开发', '内容策划'],
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
    seekingSkills: ['后端开发', 'DevOps'],
    isOpenForBeta: false,
    contactName: '赵一',
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
      seekingSkills: index % 4 === 0 ? ['产品设计', '前端开发'] : null,
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
async function seedSharedUserProfile() {
  if (!/^\d+$/.test(FOUNDER_USER_ID)) return
  await db.execute(sql`INSERT INTO ${sql.raw(SHARED_USERS_TABLE)} (id, nickname, avatar_url)
    VALUES (${FOUNDER_USER_ID}, '示例创始人', ${cover('founder-avatar')})
    ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), avatar_url = VALUES(avatar_url)`)
}

async function seed() {
  await service.grantRole(OPERATOR_USER_ID, Role.Operator)
  console.log(`Seeded operator role for user: ${OPERATOR_USER_ID}`)

  try {
    await seedSharedUserProfile()
    console.log(`Seeded shared users profile for user: ${FOUNDER_USER_ID}`)
  } catch (err) {
    console.warn(`Skipped shared users profile (${SHARED_USERS_TABLE} not reachable): ${err}`)
  }

  await service.grantRole(FOUNDER_USER_ID, Role.Founder)
  await db.delete(projects).where(eq(projects.userId, FOUNDER_USER_ID))
  const rows = [...demoProjects, ...generatedProjects(20)]
  await db.insert(projects).values(rows)
  const liveCount = rows.filter((row) => row.status === ProjectStatus.Live).length
  console.log(`Seeded ${rows.length} demo projects (${liveCount} Live)`)

  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
