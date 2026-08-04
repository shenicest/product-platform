import { eq } from 'drizzle-orm'
import { db } from './index'
import { projects } from './schema'
import { UserIdentityService } from '../modules/user-identity/service'
import { Role } from '../modules/user-identity/model'
import { CATEGORIES, ProjectStatus, ProjectStage } from '@shenicest/shared'

const OPERATOR_USER_ID = process.env.OPERATOR_USER_ID ?? 'operator-001'
const FOUNDER_USER_ID = process.env.FOUNDER_USER_ID ?? 'founder-001'
const service = new UserIdentityService(db)

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`

const demoProjects: typeof projects.$inferInsert[] = [
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '月事轻记',
    tagline: '极简的经期与身体症状记录工具',
    description:
      '月事轻记帮助女性用最少操作记录经期、排卵与日常身体症状，所有数据保留在本地，强调隐私与可控。提供清晰的周期预测与趋势图表，让用户更了解自己的身体节律。',
    coverUrl: cover('luna'),
    demoImages: [cover('luna-1'), cover('luna-2')],
    demoLink: 'https://example.com/luna',
    stage: ProjectStage.Growth,
    categories: ['女性健康', '生活方式'],
    targetUsers: '希望轻松记录周期、重视数据隐私的成年女性。',
    userProblem: '现有记录应用广告多、订阅重、数据上云，用户难以掌控自己的健康数据。',
    progress: '已完成核心记录与预测功能，正在内测图表导出。',
    nextSteps: '上线本地备份与跨设备同步（端到端加密）。',
    messageToUsers: '我们希望把身体数据的所有权交还给你，欢迎试用并告诉我们你的想法。',
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
    description:
      '专注森林把专注时间变成一棵棵成长的树，中途放弃手机树就会枯萎。通过游戏化机制帮助用户建立深度工作与学习的习惯，并提供每周专注报告。',
    coverUrl: cover('forest'),
    demoLink: 'https://example.com/forest',
    stage: ProjectStage.MVP,
    categories: ['效率工具'],
    targetUsers: '需要对抗手机分心的学生与知识工作者。',
    userProblem: '手机通知频繁打断专注，用户缺少坚持深度工作的正向反馈。',
    progress: 'MVP 已上线，核心种树与统计功能可用。',
    nextSteps: '增加好友共种与专注房间。',
    messageToUsers: '愿每一段专注都长成一棵树。',
    isOpenForBeta: false,
    contactName: '陈默',
    teamName: '森林小队',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '词卡星球',
    tagline: '用间隔重复高效背单词',
    description:
      '词卡星球基于间隔重复算法，帮助用户以最少复习量记住最多单词。支持自建词卡、导入词书，并通过游戏化连击保持学习动力。',
    coverUrl: cover('planet'),
    demoImages: [cover('planet-1')],
    demoVideoUrl: 'https://example.com/planet-demo.mp4',
    demoLink: 'https://example.com/planet',
    stage: ProjectStage.Growth,
    categories: ['教育学习'],
    targetUsers: '备考学生与需要扩充词汇量的自学者。',
    userProblem: '传统背单词效率低、复习安排不科学，容易遗忘和放弃。',
    progress: '已完成间隔重复引擎与词书导入。',
    nextSteps: '上线 AI 例句与词根词缀解析。',
    messageToUsers: '让每一次复习都恰到好处。',
    isOpenForBeta: true,
    betaDescription: '招募备考用户试用 AI 例句功能。',
    contactName: '王航',
    teamName: '星球教育',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '接口哨兵',
    tagline: '五分钟接入的 API 监控与告警',
    description:
      '接口哨兵帮助开发者监控 API 的可用性与响应时间，异常时通过多渠道即时告警。无需复杂配置，粘贴一个 URL 即可开始监控。',
    coverUrl: cover('sentinel'),
    demoLink: 'https://example.com/sentinel',
    stage: ProjectStage.MVP,
    categories: ['开发者工具'],
    targetUsers: '需要保障线上服务稳定性的独立开发者与小团队。',
    userProblem: '自建监控成本高，第三方方案配置繁琐、价格不透明。',
    progress: '已支持 HTTP 监控与邮件告警。',
    nextSteps: '增加 Webhook、Slack 与飞书告警渠道。',
    messageToUsers: '让你的接口 7x24 有人守望。',
    isOpenForBeta: false,
    contactName: '赵一',
    teamName: '哨兵实验室',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Live,
    name: '一顿饭',
    tagline: '十分钟搞定一顿健康晚餐',
    description:
      '一顿饭提供面向忙碌上班族的快手健康食谱，按冰箱现有食材推荐菜谱，附步骤计时与营养估算，帮助用户在家快速做出均衡的一餐。',
    coverUrl: cover('meal'),
    demoImages: [cover('meal-1'), cover('meal-2'), cover('meal-3')],
    demoLink: 'https://example.com/meal',
    stage: ProjectStage.Growth,
    categories: ['生活方式'],
    targetUsers: '工作繁忙、想吃得健康但没时间研究的上班族。',
    userProblem: '外卖不健康、做饭太耗时，缺少简单又营养的选择。',
    progress: '已上线食谱库与食材推荐。',
    nextSteps: '增加购物清单与一周餐计划。',
    messageToUsers: '好好吃饭，从一顿饭开始。',
    isOpenForBeta: true,
    betaDescription: '招募想改善晚餐质量的用户试用一周餐计划。',
    contactName: '孙琪',
    teamName: '一顿饭团队',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.Draft,
    name: '草稿示例（未提交）',
    tagline: '这是一个草稿，不应出现在公开列表',
    stage: ProjectStage.MVP,
    categories: ['其他'],
    contactName: '草稿用户',
  },
  {
    userId: FOUNDER_USER_ID,
    status: ProjectStatus.PendingReview,
    name: '待审核示例',
    tagline: '已提交待审核，不应出现在公开列表',
    stage: ProjectStage.MVP,
    categories: ['其他'],
    contactName: '待审核用户',
  },
]

function generatedProjects(count: number): typeof projects.$inferInsert[] {
  const rows: typeof projects.$inferInsert[] = []
  for (let index = 1; index <= count; index += 1) {
    const category = CATEGORIES[index % CATEGORIES.length]
    rows.push({
      userId: FOUNDER_USER_ID,
      status: ProjectStatus.Live,
      name: `示例项目 ${String(index).padStart(2, '0')}`,
      tagline: `用于演示列表、筛选与分页的示例项目 ${index}`,
      description: `这是第 ${index} 个示例项目，用于验证公开列表的分类筛选、阶段筛选、搜索、排序与分页。`,
      coverUrl: cover(`gen-${index}`),
      demoLink: `https://example.com/gen-${index}`,
      stage: index % 2 === 0 ? ProjectStage.Growth : ProjectStage.MVP,
      categories: [category],
      targetUsers: '演示数据，无真实目标用户。',
      userProblem: '演示数据。',
      progress: '演示数据。',
      nextSteps: '演示数据。',
      messageToUsers: '演示数据。',
      isOpenForBeta: index % 3 === 0,
      betaDescription: index % 3 === 0 ? '演示 beta 招募。' : null,
      contactName: `示例联系人 ${index}`,
      teamName: '示例团队',
    })
  }
  return rows
}

async function seed() {
  await service.grantRole(OPERATOR_USER_ID, Role.Operator)
  console.log(`Seeded operator role for user: ${OPERATOR_USER_ID}`)

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
