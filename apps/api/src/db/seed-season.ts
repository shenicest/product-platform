import { eq } from 'drizzle-orm'
import { db } from './index'
import {
  challenges,
  organizerOrgs,
  organizerOrgMembers,
  seasonAnnouncements,
  seasonOrganizers,
  seasonRuleCardItems,
  seasons,
} from './schema'
import {
  SEASON_REQUIRED_RULE_CARD_KEYS,
  SEASON_REQUIRED_RULE_CARD_LABELS,
  SEASON_RULE_DEFAULTS,
  type SeasonRules,
} from '@shenicest/shared'

// Demo BoomLand season + hackathon seed. Idempotent: upserts by unique code.
// Dates are relative to "now" so the demo always looks alive: the main season
// is on ~day 10 of ~31, with apply window already closed (作品内容阶段),
// and the hackathon's apply window still open so /apply 可以走通。

const OPERATOR_USER_ID = process.env.OPERATOR_USER_ID ?? '2'

const DAY = 86_400_000
const HOUR = 3_600_000
const now = Date.now()
const at = (offsetMs: number) => new Date(now + offsetMs)

const rules: SeasonRules = { ...SEASON_RULE_DEFAULTS }

type SeasonSeed = {
  code: string
  name: string
  type: 'season' | 'hackathon'
  city: string | null
  intro: string
  themes: string[]
  participantCapacity: number | null
  pinned: boolean
  status: 'active' | 'upcoming'
  schedule: Record<string, Date>
  startedAt: Date
}

const SEASONS: SeasonSeed[] = [
  {
    code: 'AI4BBS',
    name: 'AI4BBS 产业商业赛季',
    type: 'season',
    city: null,
    intro: '把真实问题做成可购买、可交付、可核验的服务，沿三条基建主线生长。',
    themes: ['新型储能基建', '全球 AI 基建', '新生产关系的人本基建'],
    participantCapacity: 50,
    pinned: true,
    status: 'active',
    // day 10 of 31
    schedule: {
      applyOpen: at(-20 * DAY),
      applyClose: at(-12 * DAY),
      startAt: at(-10 * DAY),
      teamDeadline: at(-8 * DAY),
      challengeFreezeAt: at(-4 * DAY),
      workDeadline: at(19 * DAY),
      scoreDeadline: at(24 * DAY),
      settleDate: at(31 * DAY),
    },
    startedAt: at(-10 * DAY),
  },
  {
    code: 'H03-SH',
    name: 'H03 上海站 · 黑客松',
    type: 'hackathon',
    city: '上海',
    intro: '48 小时现场冲刺。命题与赛季共享牌桌规则，现场交付最小可用版本。',
    themes: ['AI 应用', '机器人', '开发者工具'],
    participantCapacity: 60,
    pinned: false,
    status: 'active',
    schedule: {
      applyOpen: at(-3 * DAY),
      applyClose: at(4 * DAY),
      startAt: at(7 * DAY),
      teamDeadline: at(7 * DAY + 6 * HOUR),
      challengeFreezeAt: at(7 * DAY),
      workDeadline: at(9 * DAY),
      scoreDeadline: at(10 * DAY),
      settleDate: at(12 * DAY),
    },
    startedAt: at(7 * DAY),
  },
]

const RULE_CARD_VALUES: Record<string, (season: SeasonSeed) => string> = {
  max_project_challenges: () => `${rules.maxChallengesPerProject} 张牌桌（平行，无主次）`,
  max_projects_per_participant: () => `${rules.maxProjectsPerParticipant} 个项目`,
  max_core_members: () => `${rules.maxCoreMembers} 人`,
  single_work_cap: () => `${rules.singleWorkCap} 分`,
  exchange_ratio: () => '1 积分 = ¥1',
  review_threshold: () => `单作品超过 ${rules.reviewThreshold} 分需复核`,
  work_deadline: (s) => `以赛程「作品截止」为准：${s.schedule.workDeadline.toISOString().slice(0, 16).replace('T', ' ')} (UTC)`,
  score_deadline: (s) => `以赛程「评分截止」为准：${s.schedule.scoreDeadline.toISOString().slice(0, 16).replace('T', ' ')} (UTC)`,
  point_pool_and_awards: () => '本季过程奖励池 ¥60,000（预算 v2），按积分与 R 等级结算，R5+ 优先。',
  submission_requirements: () => '按阶段提交可运行作品、说明文档与验证材料；逾期不计分。',
  review_process: () => '阶段评审由评委滚动评分，赛季结束进行最终评审。',
  milestone_rewards: () => '完成 M1–M4 四个阶段里程碑，按完成情况获得对应积分。',
  scoring_rewards: () => '根据评审结果获得 20–200 积分，单次评分上限见「单次评分上限」。',
}

const CHALLENGES: Record<string, Array<{
  title: string
  realProblem: string
  targetCustomer: string
  minimumDeliverable: string
  resourceCommitment: string
  resultEvidenceRules: string
}>> = {
  AI4BBS: [
    {
      title: '工商业储能的第一张订单',
      realProblem: '园区储能柜装完没人运维，峰谷套利策略也跑不起来，业主不敢复购。',
      targetCustomer: '长三角制造业园区与工商业业主（曜石储能现有客户池）。',
      minimumDeliverable: '一套可跑在真实电表数据上的充放电策略 + 运维告警面板，覆盖 1 个真实站点。',
      resourceCommitment: '曜石储能提供 3 个站点历史数据、现场调试窗口与 1 名电气工程师对接。',
      resultEvidenceRules: 'R3：站点连续运行 14 天并出具业主盖章的试用确认；R4：签署正式采购合同。',
    },
    {
      title: '边缘算力进园区',
      realProblem: 'AI 质检模型在云上推理成本过高、延迟不稳，工厂不愿上。',
      targetCustomer: '3C 代工厂质检部门（云杉算力已谈下 2 家试点）。',
      minimumDeliverable: '在边缘盒子上跑通 1 条产线的实时质检推理，延迟 < 200ms。',
      resourceCommitment: '云杉算力提供边缘设备、镜像环境与产线测试时段。',
      resultEvidenceRules: 'R3：试点产线出具验收记录；R5：按月付费的算力订阅合同。',
    },
    {
      title: '仓储 AI 质检',
      realProblem: '退货仓人工质检慢且标准不一，旺季积压严重。',
      targetCustomer: '青禾物流的电商退货仓（日均 2 万件）。',
      minimumDeliverable: '基于摄像头/扫码枪的质检辅助工具，覆盖 3 个核心品类。',
      resourceCommitment: '青禾物流开放 1 个退货仓的现场与历史判例数据。',
      resultEvidenceRules: 'R3：质检效率提升数据报告（双方签字）；R4：扩展到 3 个仓库。',
    },
    {
      title: 'AI 基建用电地图',
      realProblem: '数据中心选址缺少公开的电力容量与绿电比例数据，尽调成本高。',
      targetCustomer: 'AI 基建投资方与 IDC 运营商。',
      minimumDeliverable: '一个覆盖 2 个试点城市的用电地图 MVP，含容量估算方法说明。',
      resourceCommitment: '北纬研究院提供方法论与部分非公开数据源（签 NDA）。',
      resultEvidenceRules: 'R2：方法论文档被 1 家机构采纳引用；R4：付费数据订阅。',
    },
  ],
  'H03-SH': [
    {
      title: '48 小时做出一个能卖的 AI 工具',
      realProblem: '黑客松作品常常止步于 Demo，缺少真实买家验证。',
      targetCustomer: '现场评委与受邀的 5 家企业代表。',
      minimumDeliverable: '可现场演示的 MVP + 至少 1 份付费意向书（LOI）。',
      resourceCommitment: '主办方提供云资源额度与现场导师团。',
      resultEvidenceRules: 'R2：现场演示评分；R3：赛后 14 天内签署 LOI 或试用协议。',
    },
  ],
}

const ANNOUNCEMENTS: Record<string, Array<{ title: string; content: string; category: 'general' | 'schedule' | 'rules' }>> = {
  AI4BBS: [
    {
      title: '欢迎来到 AI4BBS 产业商业赛季',
      content: '报名已截止，组队已完成。本周进入命题交付阶段，先挑一张牌桌，和出题方对齐最小交付物。',
      category: 'general',
    },
    {
      title: '赛程变更：命题冻结提前 4 天完成',
      content: '四道企业命题已全部冻结，后续只接受对最小交付物的澄清，不再新增命题。',
      category: 'schedule',
    },
    {
      title: '规则澄清：积分归项目，不按命题分账',
      content: '一个项目可以坐多张牌桌，但积分统一归项目账户；单次评分上限 100 分，超过 50 分进入复核。',
      category: 'rules',
    },
  ],
  'H03-SH': [
    {
      title: 'H03 上海站开放报名',
      content: '限额 60 人，先到先得。现场提供食宿补贴，请自带电脑。',
      category: 'general',
    },
  ],
}

async function upsertOrg(name: string): Promise<number> {
  const existing = await db.select().from(organizerOrgs).where(eq(organizerOrgs.name, name)).limit(1)
  if (existing[0]) return existing[0].id
  const result = await db.insert(organizerOrgs).values({ name })
  const id = Number(result[0].insertId)
  await db.insert(organizerOrgMembers).values({ orgId: id, userId: OPERATOR_USER_ID }).onDuplicateKeyUpdate({ set: { userId: OPERATOR_USER_ID } })
  return id
}

async function main() {
  console.log('Seeding BoomLand demo seasons...')

  const orgId = await upsertOrg('BoomLand 组委会')
  console.log(`  ✓ organizer org #${orgId}`)

  for (const seed of SEASONS) {
    const existing = await db.select().from(seasons).where(eq(seasons.code, seed.code)).limit(1)
    const base = {
      name: seed.name,
      type: seed.type,
      city: seed.city,
      intro: seed.intro,
      themes: seed.themes,
      participantCapacity: seed.participantCapacity,
      ...seed.schedule,
      status: seed.status,
      pinned: seed.pinned,
      approvedAt: at(-20 * DAY),
      approvedBy: OPERATOR_USER_ID,
      submittedAt: at(-25 * DAY),
      startedAt: seed.startedAt,
      awardingEntity: 'BoomLand 组委会',
      agreementVersion: 'v1',
      rulesVersion: 1,
      rules,
      createdBy: OPERATOR_USER_ID,
    }

    let seasonId: number
    if (existing[0]) {
      seasonId = existing[0].id
      await db.update(seasons).set(base).where(eq(seasons.id, seasonId))
      console.log(`  ↺ season ${seed.code} (#${seasonId})`)
    } else {
      const result = await db.insert(seasons).values({ code: seed.code, ...base })
      seasonId = Number(result[0].insertId)
      console.log(`  ✓ season ${seed.code} (#${seasonId})`)
    }

    await db.insert(seasonOrganizers).values({ seasonId, orgId }).onDuplicateKeyUpdate({ set: { orgId } })

    for (const [index, key] of SEASON_REQUIRED_RULE_CARD_KEYS.entries()) {
      const value = RULE_CARD_VALUES[key]?.(seed)
      if (!value) continue
      await db
        .insert(seasonRuleCardItems)
        .values({
          seasonId,
          key,
          label: SEASON_REQUIRED_RULE_CARD_LABELS[key],
          value,
          required: true,
          visible: true,
          sortOrder: index,
        })
        .onDuplicateKeyUpdate({ set: { value, label: SEASON_REQUIRED_RULE_CARD_LABELS[key], sortOrder: index } })
    }

    await db.delete(challenges).where(eq(challenges.seasonId, seasonId))
    for (const challenge of CHALLENGES[seed.code] ?? []) {
      await db.insert(challenges).values({
        seasonId,
        ...challenge,
        status: 'published',
        version: 1,
        createdBy: OPERATOR_USER_ID,
      })
    }
    console.log(`    ✓ ${CHALLENGES[seed.code]?.length ?? 0} challenges`)

    await db.delete(seasonAnnouncements).where(eq(seasonAnnouncements.seasonId, seasonId))
    let offset = 0
    for (const announcement of ANNOUNCEMENTS[seed.code] ?? []) {
      offset += HOUR
      await db.insert(seasonAnnouncements).values({
        seasonId,
        ...announcement,
        createdBy: OPERATOR_USER_ID,
        createdAt: at(-2 * DAY + offset),
      })
    }
    console.log(`    ✓ ${ANNOUNCEMENTS[seed.code]?.length ?? 0} announcements`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
