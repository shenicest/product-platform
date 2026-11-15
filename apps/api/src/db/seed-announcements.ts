import { eq, inArray, sql } from 'drizzle-orm'
import { AnnouncementLevel, AnnouncementScope, AnnouncementType } from '@shenicest/shared'
import { db } from './index'
import { announcementRecipients, announcements, userAnnouncementReads } from './schema'
import { AnnouncementService } from '../modules/announcement/service'

/**
 * 公告中心的本地演示数据（`bun run seed:announcements`）。
 *
 * 为什么单独一个脚本：公告是「用户维度」的数据，既不属于平台项目 seed，
 * 也不属于 BoomLand 赛季 seed；混进去会让那两个脚本多背一个与它们无关的数组。
 *
 * 幂等做法：演示公告统一标 `source_type = 'seed-demo'`，每次先删掉上一批
 * 演示公告（连同收件人），再删掉 mock 用户的读水位线，最后重新发一遍。
 * 于是重复执行 seed 后，切换 mock 用户一定又看得到未读角标 —— 已读状态是
 * 本地演示状态，重置它比留着一个「看不出效果」的角标更符合预期。
 *
 * 目标用户见 `src/mock/fixtures.ts`：9001-9006 是 mock 专用号段，
 * `1` 是 `founder-demo` 复用的 seed 创始人。
 */
const DEMO_SOURCE = 'seed-demo'

const MOCK_USER_IDS = ['1', '9001', '9002', '9003', '9004', '9005', '9006']

const GUEST = '9001'
const FOUNDER = '9002'
const OPERATOR = '9004'
const ADMIN = '9005'
const ORGANIZER = '9006'

interface DemoAnnouncement {
  scope: AnnouncementScope
  /** 仅 `direct` 用；空数组表示不投递（脚本会跳过）。 */
  recipients?: string[]
  minutesAgo: number
  type: AnnouncementType
  level: AnnouncementLevel
  title: string
  content: string
  linkPath?: string
}

const DEMO_ANNOUNCEMENTS: DemoAnnouncement[] = [
  {
    scope: AnnouncementScope.Global,
    minutesAgo: 3 * 24 * 60,
    type: AnnouncementType.System,
    level: AnnouncementLevel.Warning,
    title: '平台维护通知',
    content: '本周日 02:00–04:00 进行数据库维护，期间公告与报名可能短暂不可用。',
  },
  {
    scope: AnnouncementScope.Global,
    minutesAgo: 2 * 60,
    type: AnnouncementType.System,
    level: AnnouncementLevel.Info,
    title: 'BoomLand V2.6 已上线',
    content: '赛季详情页改版：赛程、规则卡与公告合并到同一屏，报名后可以直接在工作台跟进进度。',
    linkPath: '/seasons',
  },
  {
    scope: AnnouncementScope.Direct,
    recipients: [GUEST],
    minutesAgo: 24 * 60,
    type: AnnouncementType.Application,
    level: AnnouncementLevel.Success,
    title: '报名已通过审核',
    content: '你报名的「像素花园」赛季已通过审核，记得在组队截止前完成组队。',
    linkPath: '/me/applications',
  },
  {
    scope: AnnouncementScope.Direct,
    recipients: [FOUNDER],
    minutesAgo: 30,
    type: AnnouncementType.System,
    level: AnnouncementLevel.Success,
    title: '项目已通过审核',
    content: '「月事轻记」的提案已通过，可以在创始人后台查看评审意见并继续完善项目。',
    linkPath: '/founder/dashboard',
  },
  {
    scope: AnnouncementScope.Direct,
    recipients: [OPERATOR],
    minutesAgo: 5,
    type: AnnouncementType.System,
    level: AnnouncementLevel.Info,
    title: '有 3 个项目待审核',
    content: '运营后台的待审列表有新增项目，建议今天内处理完。',
    linkPath: '/operator',
  },
  {
    scope: AnnouncementScope.Direct,
    recipients: [ADMIN],
    minutesAgo: 45,
    type: AnnouncementType.Season,
    level: AnnouncementLevel.Info,
    title: '你被设为赛季核验员',
    content: '「像素花园」赛季的核验任务已分配给你，可在主办方后台查看。',
    linkPath: '/organizer/overview',
  },
  {
    scope: AnnouncementScope.Direct,
    recipients: [ORGANIZER],
    minutesAgo: 2 * 24 * 60,
    type: AnnouncementType.Season,
    level: AnnouncementLevel.Info,
    title: '你已加入主办方组织',
    content: '现在可以开始配置新赛季的赛程、规则卡与命题了。',
    linkPath: '/organizer/overview',
  },
]

function dedupeKeyOf(index: number): string {
  return `seed-demo:${index}`
}

async function clearDemoAnnouncements() {
  const rows = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(eq(announcements.sourceType, DEMO_SOURCE))
  if (rows.length > 0) {
    const ids = rows.map((row) => row.id)
    await db.delete(announcementRecipients).where(inArray(announcementRecipients.announcementId, ids))
    await db.delete(announcements).where(inArray(announcements.id, ids))
  }
  // 重置 mock 用户的读水位线：否则上一轮点过「全部已读」的账号看不到新演示角标。
  await db.delete(userAnnouncementReads).where(inArray(userAnnouncementReads.userId, MOCK_USER_IDS))
  return rows.length
}

async function seed() {
  const removed = await clearDemoAnnouncements()
  const service = new AnnouncementService(db)

  let published = 0
  for (const [index, item] of DEMO_ANNOUNCEMENTS.entries()) {
    const input = {
      type: item.type,
      level: item.level,
      title: item.title,
      content: item.content,
      linkPath: item.linkPath ?? null,
      createdBy: 'seed',
      sourceType: DEMO_SOURCE,
      dedupeKey: dedupeKeyOf(index),
    }
    const result =
      item.scope === AnnouncementScope.Global
        ? await service.publishGlobal(input)
        : await service.publishDirect(item.recipients ?? [], input)
    if (result.id === null) continue
    // publish 的 publishedAt 固定是 NOW(3)；演示数据需要「刚刚 / 2 小时前 / 3 天前」
    // 的层次，所以在同一条记录上回填一个相对时间（仍然是 DB 时钟）。
    await db
      .update(announcements)
      .set({ publishedAt: sql`DATE_SUB(NOW(3), INTERVAL ${item.minutesAgo} MINUTE)` })
      .where(eq(announcements.id, result.id))
    published += 1
  }

  const globalCount = DEMO_ANNOUNCEMENTS.filter((item) => item.scope === AnnouncementScope.Global).length
  console.log(
    `Seeded ${published} demo announcements (${globalCount} global, ${published - globalCount} targeted); ` +
      `reset read watermark for ${MOCK_USER_IDS.length} mock users (removed ${removed} previous rows)`,
  )
  console.log('Switch mock users (guest / founder / operator / admin / organizer) to see different unread badges.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
