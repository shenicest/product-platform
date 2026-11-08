import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from './index'
import {
  auditLogs,
  challengeFollows,
  challengeResources,
  challengeVersions,
  challenges,
  organizerOrgMembers,
  organizerOrgs,
  pointAllocations,
  projects,
  seasonAnnouncements,
  seasonApplications,
  seasonBudgets,
  seasonOrganizers,
  seasonParticipants,
  seasonPointPools,
  seasonProjectMembers,
  seasonProjects,
  seasonRuleCardItems,
  seasonEnterpriseCooperations,
  seasonVerifierGrants,
  seasons,
  talentProfiles,
} from './schema'
import { UserIdentityService } from '../modules/user-identity/service'
import { validateSchedule } from '../modules/boomland-shared'
import { encryptBoomlandContact } from '../lib/boomland-contact-encryption'
import {
  ApplicationVisibility,
  BudgetStatus,
  CHALLENGE_RIGHTS_FIELDS,
  ChallengeResourceKind,
  ChallengeResourceStatus,
  ChallengeScoringDimension,
  ChallengeStatus,
  ChallengeType,
  EnterpriseCooperationStatus,
  EnterpriseCooperationTier,
  EnterprisePublicScope,
  PointAllocationStatus,
  ProjectStatus,
  Role,
  SEASON_RULE_DEFAULTS,
  SeasonProjectMemberRole,
  SeasonProjectMemberStatus,
  SeasonProjectSource,
  SeasonProjectStage,
  SeasonProjectStatus,
  seasonRequiredRuleCardItems,
  SeasonApplicationStatus,
  SeasonParticipantStatus,
  SeasonStatus,
  SeasonType,
  VerifierGrantStatus,
  WechatStatus,
  type SeasonRules,
} from '@shenicest/shared'
import {
  BOOMLAND_ORGS,
  DAY,
  DEMO_USER_IDS,
  HOUR,
  OPERATOR_USER_ID,
  upsertSharedUsers,
  type BoomlandOrgKey,
} from './seed-shared'

// Demo BoomLand seed: everything the 火热赛季 (/seasons) surface reads.
// Idempotent — upserts by unique key (season code / org name / (season, user)
// pairs), so rerun freely.
//
// Dates are relative to "now" so the demo always looks alive. The main season
// sits in the 作品内容 stage (apply window closed, started ~10 days ago, work
// not due yet); the hackathon and the Proto Seeds season keep their apply
// window open so /seasons/:id/apply 可以走通。Every season is seeded with the
// full set of child records the public page renders: 命题五件套、规则卡、公告、
// 预算/积分池/评委分配/核验员（readiness 全绿）、报名与选手（含微信状态）、
// 赛季级审计日志。
//
// Coverage target (pre-start-season-api.md §8.2 + demo needs):
// - 赛季状态: active x2 (one pinned) + upcoming x1 (apply window open)
// - 报名状态: accepted / submitted / pending / rejected / withdrawn
// - 微信状态: not_invited / invited / joined
// - 命题状态: published (frozen) / closed / draft (draft stays off the public page)
// - 预算版本: v1 superseded + v2 active; 积分池 partially allocated to 2 scorers
// - 演示账号 id 固定，不会与真实用户报名冲突

const NOW = Date.now()
const at = (offsetMs: number) => new Date(NOW + offsetMs)

const userIdentity = new UserIdentityService(db)

function isoText(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

// ---------------------------------------------------------------------------
// 赛季定义
// ---------------------------------------------------------------------------

type SeasonStatusValue = (typeof SeasonStatus)[keyof typeof SeasonStatus]
type SeasonTypeValue = (typeof SeasonType)[keyof typeof SeasonType]
type BudgetStatusValue = (typeof BudgetStatus)[keyof typeof BudgetStatus]
type DemoAccountKey = keyof typeof DEMO_USER_IDS

/**
 * 企业合作配置的一行（产品文档 CHG-006）。
 *
 * 三项金额分开写：管理费不进选手奖励账本，所以不做「总费用 − 管理费」派生。
 */
type CooperationSeed = {
  enterpriseName: string
  tier: (typeof EnterpriseCooperationTier)[keyof typeof EnterpriseCooperationTier]
  grade: string | null
  totalAmount: number
  managementFee: number
  prizePoolAmount: number
  dataGrant: string | null
  publicScope: (typeof EnterprisePublicScope)[keyof typeof EnterprisePublicScope]
  status: (typeof EnterpriseCooperationStatus)[keyof typeof EnterpriseCooperationStatus]
}

type SeasonScheduleSeed = {
  applyOpen: Date
  applyClose: Date
  startAt: Date
  teamDeadline: Date
  challengeFreezeAt: Date
  workDeadline: Date
  scoreDeadline: Date
  settleDate: Date
}

type SeasonSeed = {
  code: string
  name: string
  type: SeasonTypeValue
  city: string | null
  intro: string
  themes: string[]
  participantCapacity: number | null
  pinned: boolean
  status: SeasonStatusValue
  schedule: SeasonScheduleSeed
  startedAt: Date | null
  awardingEntity: string
  /** 赛季主办方（org key） */
  organizers: BoomlandOrgKey[]
  /** 预算：历史版本 + 当前 active 版本（元） */
  budgets: Array<{ totalAmount: number; status: BudgetStatusValue; reason: string }>
  /** 企业合作配置（主办方后台「企业合作配置」表格的数据源） */
  cooperations: CooperationSeed[]
  pointPool: {
    totalPoints: number
    scorers: Array<{ account: DemoAccountKey; amount: number; usedAmount: number }>
  }
  verifiers: DemoAccountKey[]
  submittedAt: Date
  approvedAt: Date
  /**
   * 赛季规则的覆盖项（未写的键沿用 `SEASON_RULE_DEFAULTS`）。
   *
   * 不直接写整份 rules：默认值集中在 shared 里，seed 只声明「本季与默认不同」
   * 的那几项，默认值调整时不用回来改每个赛季。
   */
  rules?: Partial<SeasonRules>
}

const SEASONS: SeasonSeed[] = [
  {
    code: 'AI4BBS',
    name: 'AI4BBS 产业商业赛季',
    type: SeasonType.Season,
    city: null,
    intro: '把真实问题做成可购买、可交付、可核验的服务，沿三条基建主线生长。',
    themes: ['新型储能基建', '全球 AI 基建', '新生产关系的人本基建'],
    participantCapacity: 50,
    pinned: true,
    status: SeasonStatus.Active,
    // day 10 of 31：报名已截止、组队已完成，正在交付
    schedule: {
      applyOpen: at(-30 * DAY),
      applyClose: at(-22 * DAY),
      startAt: at(-10 * DAY),
      teamDeadline: at(-8 * DAY),
      challengeFreezeAt: at(-9 * DAY), // 须早于组队截止
      workDeadline: at(19 * DAY),
      scoreDeadline: at(24 * DAY),
      settleDate: at(31 * DAY),
    },
    startedAt: at(-10 * DAY),
    awardingEntity: 'BoomLand 组委会',
    organizers: ['committee', 'yaoshi', 'qinghe'],
    budgets: [
      { totalAmount: 40_000, status: BudgetStatus.Superseded, reason: '赛季发布预算 v1' },
      { totalAmount: 60_000, status: BudgetStatus.Active, reason: '追加过程奖励池（预算 v2）' },
    ],
    // 与 CHALLENGES.AI4BBS 的 enterpriseName 对齐：命题的企业归属靠这个字符串关联，
    // 两边写同一份名字，后台表格才和命题库对得上。
    cooperations: [
      {
        enterpriseName: '曜石储能',
        tier: EnterpriseCooperationTier.CoCreation,
        grade: '金标',
        totalAmount: 80_000,
        managementFee: 12_000,
        prizePoolAmount: 30_000,
        dataGrant: '3 个工商业站点的历史电表数据（脱敏，可对外展示结论）',
        publicScope: EnterprisePublicScope.Public,
        status: EnterpriseCooperationStatus.Signed,
      },
      {
        enterpriseName: '云杉算力',
        tier: EnterpriseCooperationTier.Cooperation,
        grade: '银标',
        totalAmount: 40_000,
        managementFee: 6_000,
        prizePoolAmount: 12_000,
        dataGrant: '边缘推理设备与镜像环境（仅限参赛项目使用）',
        publicScope: EnterprisePublicScope.Public,
        status: EnterpriseCooperationStatus.Signed,
      },
      {
        enterpriseName: '青禾物流',
        tier: EnterpriseCooperationTier.Cooperation,
        grade: '银标',
        totalAmount: 35_000,
        managementFee: 5_000,
        prizePoolAmount: 10_000,
        dataGrant: '1 个退货仓的现场与历史判例数据（签 NDA）',
        publicScope: EnterprisePublicScope.Public,
        status: EnterpriseCooperationStatus.Signed,
      },
      {
        enterpriseName: '北纬研究院',
        tier: EnterpriseCooperationTier.ResourcePartner,
        grade: null,
        totalAmount: 0,
        managementFee: 0,
        prizePoolAmount: 0,
        dataGrant: '方法论与部分非公开电力数据源（签 NDA）',
        publicScope: EnterprisePublicScope.Anonymous,
        status: EnterpriseCooperationStatus.Intent,
      },
      {
        enterpriseName: '合作社群',
        tier: EnterpriseCooperationTier.Intent,
        grade: null,
        totalAmount: 0,
        managementFee: 0,
        prizePoolAmount: 0,
        dataGrant: null,
        publicScope: EnterprisePublicScope.Anonymous,
        status: EnterpriseCooperationStatus.Intent,
      },
    ],
    pointPool: {
      totalPoints: 1_000,
      scorers: [
        { account: 'scorerA', amount: 200, usedAmount: 0 },
        { account: 'scorerB', amount: 150, usedAmount: 0 },
      ],
    },
    verifiers: ['verifierA', 'verifierB'],
    submittedAt: at(-35 * DAY),
    approvedAt: at(-30 * DAY),
    // 与命题详情页截图一致：单次上限 300 分、大额复核阈值 280 分、1 积分 = ¥1。
    // 命题卡上的「单次上限 300」与赛季上限取较小值 —— 两边都是 300 才对得上。
    rules: { singleWorkCap: 300, reviewThreshold: 280, exchangeRatio: 1 },
  },
  {
    code: 'H03-SH',
    name: 'H03 上海站 · 黑客松',
    type: SeasonType.Hackathon,
    city: '上海',
    intro: '48 小时现场冲刺。命题与赛季共享牌桌规则，现场交付最小可用版本。',
    themes: ['AI 应用', '机器人', '开发者工具'],
    participantCapacity: 60,
    pinned: false,
    status: SeasonStatus.Active,
    // 已批准开赛，现场冲刺前一周（报名仍开着，现场确认参赛）
    schedule: {
      applyOpen: at(-3 * DAY),
      applyClose: at(4 * DAY),
      startAt: at(7 * DAY),
      teamDeadline: at(7 * DAY + 6 * HOUR),
      challengeFreezeAt: at(6 * DAY),
      workDeadline: at(9 * DAY),
      scoreDeadline: at(10 * DAY),
      settleDate: at(12 * DAY),
    },
    startedAt: at(-1 * DAY),
    awardingEntity: 'BoomLand 组委会',
    organizers: ['committee'],
    budgets: [{ totalAmount: 30_000, status: BudgetStatus.Active, reason: '黑客松奖金池' }],
    cooperations: [
      {
        enterpriseName: 'BoomLand 组委会',
        tier: EnterpriseCooperationTier.CoCreation,
        grade: '金标',
        totalAmount: 50_000,
        managementFee: 8_000,
        prizePoolAmount: 30_000,
        dataGrant: '现场云资源额度与导师团（仅限现场使用）',
        publicScope: EnterprisePublicScope.Public,
        status: EnterpriseCooperationStatus.Signed,
      },
      {
        enterpriseName: '云杉算力',
        tier: EnterpriseCooperationTier.ResourcePartner,
        grade: null,
        totalAmount: 0,
        managementFee: 0,
        prizePoolAmount: 0,
        dataGrant: '边缘算力设备 10 台（现场借用）',
        publicScope: EnterprisePublicScope.Anonymous,
        status: EnterpriseCooperationStatus.Intent,
      },
    ],
    pointPool: {
      totalPoints: 500,
      scorers: [{ account: 'scorerA', amount: 120, usedAmount: 0 }],
    },
    verifiers: ['verifierA'],
    submittedAt: at(-12 * DAY),
    approvedAt: at(-8 * DAY),
  },
  {
    code: 'PROTO-S2',
    name: 'Proto Seeds 第二季',
    type: SeasonType.Season,
    city: null,
    intro: '面向早期团队的共创赛季。报名窗口仍然开放，可以在这里走通报名流程。',
    themes: ['AI 应用', '生活方式', '开发者工具'],
    participantCapacity: 30,
    pinned: false,
    status: SeasonStatus.Upcoming,
    schedule: {
      applyOpen: at(-2 * DAY),
      applyClose: at(12 * DAY),
      startAt: at(15 * DAY),
      teamDeadline: at(18 * DAY),
      challengeFreezeAt: at(17 * DAY), // 须早于组队截止
      workDeadline: at(40 * DAY),
      scoreDeadline: at(45 * DAY),
      settleDate: at(52 * DAY),
    },
    startedAt: null,
    awardingEntity: 'SheNicest',
    organizers: ['committee'],
    budgets: [{ totalAmount: 20_000, status: BudgetStatus.Active, reason: '第二季首发预算' }],
    cooperations: [
      {
        enterpriseName: 'SheNicest',
        tier: EnterpriseCooperationTier.CoCreation,
        grade: '金标',
        totalAmount: 20_000,
        managementFee: 3_000,
        prizePoolAmount: 12_000,
        dataGrant: '2 家真实客户对接与品牌曝光位',
        publicScope: EnterprisePublicScope.Public,
        status: EnterpriseCooperationStatus.Signed,
      },
      {
        enterpriseName: '合作社群',
        tier: EnterpriseCooperationTier.Intent,
        grade: null,
        totalAmount: 0,
        managementFee: 0,
        prizePoolAmount: 0,
        dataGrant: null,
        publicScope: EnterprisePublicScope.Anonymous,
        status: EnterpriseCooperationStatus.Intent,
      },
    ],
    pointPool: {
      totalPoints: 400,
      scorers: [{ account: 'scorerA', amount: 100, usedAmount: 0 }],
    },
    verifiers: ['verifierA'],
    submittedAt: at(-6 * DAY),
    approvedAt: at(-5 * DAY),
  },
]

// 规则卡的文案不再由 seed 手写：必要条目的 label/value 是赛季配置的派生物，
// 生成逻辑在 `@shenicest/shared` 的 `seasonRequiredRuleCardItems` 里（后端读接口
// 与写入接口都用同一份），seed 也走它，演示数据才不会和真实接口对不上。

// ---------------------------------------------------------------------------
// 命题
// ---------------------------------------------------------------------------

type ChallengeStatusValue = (typeof ChallengeStatus)[keyof typeof ChallengeStatus]
type ChallengeTypeValue = (typeof ChallengeType)[keyof typeof ChallengeType]
type ResourceKindValue = (typeof ChallengeResourceKind)[keyof typeof ChallengeResourceKind]
type ResourceStatusValue = (typeof ChallengeResourceStatus)[keyof typeof ChallengeResourceStatus]

/** 资源清单的一条（`challenge_resources`）。`sortOrder` 由数组下标决定，不手写。 */
type ChallengeResourceSeed = {
  kind: ResourceKindValue
  title: string
  quantity?: string | null
  conditions?: string | null
  owner?: string | null
  status?: ResourceStatusValue
}

type ChallengeSeed = {
  title: string
  status: ChallengeStatusValue
  /** 四类命题之一；草稿可以先不分类。 */
  type?: ChallengeTypeValue | null
  /** 必须取自本季 `themes`（见上方 SEASONS 定义）。 */
  theme?: string | null
  /** 出题企业，与 `season_enterprise_cooperations.enterprise_name` 同一字符串。 */
  enterpriseName?: string | null
  /** 命题容量：最多几个参赛项目；null = 不限。 */
  capacity?: number | null
  realProblem: string
  targetCustomer: string
  minimumDeliverable: string
  resourceCommitment: string
  resultEvidenceRules: string
  // ---- 命题详情页「命题卡」tab 的正文（契约 §1.1，都不是发布必填项） ----
  summary?: string | null
  background?: string | null
  industry?: string | null
  scope?: string | null
  outOfScope?: string | null
  monthlyGoal?: string | null
  suggestedSkills?: string[]
  teamCapacity?: number | null
  ownerName?: string | null
  responseSla?: string | null
  // ---- 评分与奖励 ----
  scoringWeights?: Record<string, number> | null
  singleWorkCap?: number | null
  // ---- 公开与权益（七项分别存） ----
  rights?: Partial<Record<ChallengeRightsField, string | null>>
  /** 版本号；有 `versions` 时取最后一条的版本号，避免两处写不一致。 */
  version?: number
  /** 版本记录（`challenge_versions`）。日期显式给出，不用相对时间。 */
  versions?: ChallengeVersionSeed[]
  /**
   * 演示用的「选择本命题的项目」：每个元素是一个阶段，按顺序对齐
   * `projects` 表里的前 N 条已上线项目。找不到足够的项目行就跳过。
   */
  projectStages?: SeasonProjectStageValue[]
  /** 资源兑现清单（CHG-004）：主办方逐条跟踪的承诺，不是五件套里的那段摘要文本。 */
  resources?: ChallengeResourceSeed[]
}

type ChallengeVersionSeed = {
  version: number
  note: string
  createdAt: Date
  changedBy?: string
}

type SeasonProjectStageValue = (typeof SeasonProjectStage)[keyof typeof SeasonProjectStage]
type ChallengeRightsField =
  (typeof CHALLENGE_RIGHTS_FIELDS)[number]

/**
 * 版本记录的演示日期（10 月 15 / 22 / 26 日）。
 *
 * 用固定月日而不是相对 `now`：版本记录是「历史留痕」，日期必须稳定可读。
 * 年份取当前年；如果那条日期还没到（例如在 3 月跑 seed），退到上一年，
 * 保证时间轴不会出现「未来发生过的版本」。
 */
function versionDate(month: number, day: number): Date {
  const now = new Date()
  const candidate = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day, 10, 0, 0))
  if (candidate.getTime() > now.getTime()) {
    return new Date(Date.UTC(now.getUTCFullYear() - 1, month - 1, day, 10, 0, 0))
  }
  return candidate
}

const CHALLENGES: Record<string, ChallengeSeed[]> = {
  AI4BBS: [
    {
      title: '工商业储能的第一张订单',
      status: ChallengeStatus.Published,
      type: ChallengeType.CommercialValidation,
      theme: '新型储能基建',
      enterpriseName: '曜石储能',
      capacity: 6,
      realProblem: '园区储能柜装完没人运维，峰谷套利策略也跑不起来，业主不敢复购。',
      targetCustomer: '长三角制造业园区与工商业业主（曜石储能现有客户池）。',
      minimumDeliverable: '一套可跑在真实电表数据上的充放电策略 + 运维告警面板，覆盖 1 个真实站点。',
      resourceCommitment: '曜石储能提供 3 个站点历史数据、现场调试窗口与 1 名电气工程师对接。',
      resultEvidenceRules: 'R3：站点连续运行 14 天并出具业主盖章的试用确认；R4：签署正式采购合同。',
      // ---- 命题卡正文（命题详情页截图里的内容） ---------------------------
      summary: '谁会为一台 100—200 kWh 的储能柜付第一笔钱？找到客户、算清账、把单签下来。',
      background:
        '曜石储能今年在长三角装了 12 台工商业储能柜，装机不缺，缺的是「第一笔真实的付费订单」。'
        + '已装的柜子里，超过一半因为没人做峰谷套利策略、没人盯运维告警，实际收益远低于销售时的测算，'
        + '业主不愿复购，也不愿做案例背书。这条命题要的不是又一份方案，而是一个能签字的客户。',
      industry: '园区里的中小制造企业、冷库、连锁商超',
      scope:
        '面向 100—200 kWh 单柜容量的工商业场景，围绕「找到一个真实业主 → 用其电费与负荷数据算清账 → '
        + '拿到试用或采购承诺」这一条完整链路做验证。可用曜石储能提供的站点数据、工程师对接与现场调试窗口。',
      outOfScope: '不做电芯研发，不做电网侧大型储能项目',
      monthlyGoal:
        '一个月内交付：1 家真实业主的电费-负荷测算报告（含峰谷套利收益测算与回本周期）、'
        + '1 份业主签字的需求确认单，以及 1 个能跑在真实电表数据上的充放电策略原型。',
      suggestedSkills: ['销售', '能源测算', '产品'],
      teamCapacity: 6,
      ownerName: '王岚',
      responseSla: '工作日 48 小时内',
      scoringWeights: {
        [ChallengeScoringDimension.CommercialResult]: 35,
        [ChallengeScoringDimension.DeliveryQuality]: 25,
        [ChallengeScoringDimension.OriginalMethod]: 15,
        [ChallengeScoringDimension.ActionEvidence]: 15,
        [ChallengeScoringDimension.ReuseValue]: 10,
      },
      singleWorkCap: 300,
      rights: {
        rightsPublicScope: '命题卡内容、五件套与评分维度对外公开；站点原始电表数据与业主身份不公开。',
        rightsConfidentiality: '业主身份、电费明细与合同条款属双方保密信息，仅限本赛季评审与核验使用。',
        rightsIp: '参赛团队在命题内产出的策略代码与方法文档归团队所有，曜石储能获得非独占的实施许可。',
        rightsEnterpriseUsage: '曜石储能可在自有站点内使用参赛产出的策略与面板，不额外付费；对外销售需另行约定。',
        rightsProcurement: '试点验收通过后，曜石储能优先采购该团队的运维服务，单站点年度服务预算 3—8 万元。',
        rightsSpecialTerms: '涉及业主数据的分析须先签署保密协议；现场调试须由业主陪同并提前 3 天报备。',
        rightsExclusivity: '不设排他：同一方向可与其他团队并行验证，曜石储能按验收结果择优合作。',
      },
      versions: [
        {
          version: 1,
          note: '初版命题卡：确立「拿到第一张真实订单」的命题目标与五件套。',
          createdAt: versionDate(10, 15),
        },
        {
          version: 2,
          note: '补充目标客户与产业对象，明确不做电芯研发与电网侧大型储能项目。',
          createdAt: versionDate(10, 22),
        },
        {
          version: 3,
          note: '补齐五维权重与七项权益条款，单次评分上限调整为 300 分。',
          createdAt: versionDate(10, 26),
        },
      ],
      // 4 个已选项目，阶段分布覆盖 seed / sprout / grow / fruit。
      projectStages: [
        SeasonProjectStage.Seed,
        SeasonProjectStage.Sprout,
        SeasonProjectStage.Grow,
        SeasonProjectStage.Fruit,
      ],
      resources: [
        {
          kind: ChallengeResourceKind.Funding,
          title: '试点采购预算',
          quantity: '¥80,000（单站点上限 ¥30,000）',
          conditions: '按验收节点分批支付，需业主签字确认验收结果',
          owner: '王岚（曜石储能）',
          status: ChallengeResourceStatus.Committed,
        },
        {
          kind: ChallengeResourceKind.RealDemand,
          title: '3 个工商业站点真实需求与业主对接',
          quantity: '3 个站点 / 每站点 1 次现场走访',
          conditions: '走访需提前 3 天预约，由曜石储能商务陪同',
          owner: '王岚（曜石储能）',
          status: ChallengeResourceStatus.Provided,
        },
        {
          kind: ChallengeResourceKind.ExpertChannel,
          title: '电气工程师与售前顾问对接',
          quantity: '2 名专家 / 每周各 4 小时',
          conditions: '工作日 48 小时内响应，需提前排期',
          owner: '李二（曜石储能）',
          status: ChallengeResourceStatus.Applicable,
        },
        {
          kind: ChallengeResourceKind.ToolVenue,
          title: '园区调试窗口与储能柜测试环境',
          quantity: '2 次现场调试 / 1 套测试柜',
          conditions: '进园需报备并由业主陪同；测试柜仅限本赛季使用',
          owner: '张一（组委会）',
          status: ChallengeResourceStatus.Provided,
        },
        {
          kind: ChallengeResourceKind.Partnership,
          title: '合作机会：赛季后运维服务商资格',
          quantity: '1 个名额',
          conditions: '需完成试点验收并提供可对外复用的案例',
          owner: '王岚（曜石储能）',
          status: ChallengeResourceStatus.Unfulfilled,
        },
      ],
    },
    {
      title: '边缘算力进园区',
      status: ChallengeStatus.Published,
      type: ChallengeType.SolutionPoc,
      theme: '全球 AI 基建',
      enterpriseName: '云杉算力',
      capacity: 4,
      realProblem: 'AI 质检模型在云上推理成本过高、延迟不稳，工厂不愿上。',
      targetCustomer: '3C 代工厂质检部门（云杉算力已谈下 2 家试点）。',
      minimumDeliverable: '在边缘盒子上跑通 1 条产线的实时质检推理，延迟 < 200ms。',
      resourceCommitment: '云杉算力提供边缘设备、镜像环境与产线测试时段。',
      resultEvidenceRules: 'R3：试点产线出具验收记录；R5：按月付费的算力订阅合同。',
      resources: [
        {
          kind: ChallengeResourceKind.ToolVenue,
          title: '边缘推理设备',
          quantity: '5 台',
          conditions: '赛季结束后归还，损坏按成本价赔偿',
          owner: '云杉算力商务',
          status: ChallengeResourceStatus.Provided,
        },
        {
          kind: ChallengeResourceKind.ExpertChannel,
          title: '产线测试时段',
          quantity: '累计 8 小时',
          conditions: '需与工厂排产错峰',
          owner: '云杉算力现场负责人',
          status: ChallengeResourceStatus.Applicable,
        },
      ],
    },
    {
      title: '仓储 AI 质检',
      status: ChallengeStatus.Published,
      type: ChallengeType.UpstreamDownstream,
      theme: '新生产关系的人本基建',
      enterpriseName: '青禾物流',
      capacity: 5,
      realProblem: '退货仓人工质检慢且标准不一，旺季积压严重。',
      targetCustomer: '青禾物流的电商退货仓（日均 2 万件）。',
      minimumDeliverable: '基于摄像头/扫码枪的质检辅助工具，覆盖 3 个核心品类。',
      resourceCommitment: '青禾物流开放 1 个退货仓的现场与历史判例数据。',
      resultEvidenceRules: 'R3：质检效率提升数据报告（双方签字）；R4：扩展到 3 个仓库。',
      resources: [
        {
          kind: ChallengeResourceKind.RealDemand,
          title: '退货仓现场与历史判例',
          quantity: '1 个仓 / 6 个月判例',
          conditions: '现场拍摄需避开用户个人信息',
          owner: '王知微（青禾物流）',
          status: ChallengeResourceStatus.Provided,
        },
        {
          kind: ChallengeResourceKind.Funding,
          title: '试点期工具采购预算',
          quantity: '¥15,000',
          conditions: '按验收节点分批支付',
          owner: '青禾物流财务',
          status: ChallengeResourceStatus.Committed,
        },
      ],
    },
    {
      title: 'AI 基建用电地图',
      status: ChallengeStatus.Published,
      type: ChallengeType.DataResearch,
      theme: '全球 AI 基建',
      enterpriseName: '北纬研究院',
      capacity: null,
      realProblem: '数据中心选址缺少公开的电力容量与绿电比例数据，尽调成本高。',
      targetCustomer: 'AI 基建投资方与 IDC 运营商。',
      minimumDeliverable: '一个覆盖 2 个试点城市的用电地图 MVP，含容量估算方法说明。',
      resourceCommitment: '北纬研究院提供方法论与部分非公开数据源（签 NDA）。',
      resultEvidenceRules: 'R2：方法论文档被 1 家机构采纳引用；R4：付费数据订阅。',
      resources: [
        {
          kind: ChallengeResourceKind.ExpertChannel,
          title: '研究院方法论对接',
          quantity: '每月 1 次评审',
          conditions: '需签 NDA 后方可接触非公开数据源',
          owner: '北纬研究院研究员',
          status: ChallengeResourceStatus.Applicable,
        },
        {
          kind: ChallengeResourceKind.Database,
          title: '部分非公开电力数据',
          quantity: '2 个试点城市',
          conditions: '签 NDA，仅限本赛季内使用',
          owner: '北纬研究院数据组',
          status: ChallengeResourceStatus.Committed,
        },
      ],
    },
    {
      title: '园区能耗账单拆解',
      status: ChallengeStatus.Closed,
      type: ChallengeType.CommercialValidation,
      theme: '新型储能基建',
      enterpriseName: '曜石储能',
      capacity: 3,
      realProblem: '园区每月电费账单科目混杂，运营方说不清钱花在哪，节能方案无从下手。',
      targetCustomer: '园区物业管理方与能源托管服务商。',
      minimumDeliverable: '把一份真实账单拆成设备/时段/功率三维度并给出 Top3 浪费项的报告模板。',
      resourceCommitment: '曜石储能提供 6 个月脱敏账单与 1 次线上讲解。',
      resultEvidenceRules: 'R1：报告被物业采用；R2：节能改造方案进入报价。',
      resources: [
        {
          kind: ChallengeResourceKind.Database,
          title: '6 个月脱敏账单',
          quantity: '1 个园区 / 6 个月',
          conditions: '已过期，仅作历史参考',
          owner: '李二（曜石储能）',
          status: ChallengeResourceStatus.Used,
        },
      ],
    },
    {
      title: '（草稿）储能运维 SOP 知识库',
      status: ChallengeStatus.Draft,
      // 草稿允许先不分类：类型与主题是发布前的整理动作，不是创建门槛。
      type: null,
      theme: null,
      enterpriseName: '曜石储能',
      capacity: null,
      realProblem: '运维现场经验散落在师傅脑子里，新人上手周期长。',
      targetCustomer: '储能运维服务商的一线运维人员。',
      minimumDeliverable: '一个可搜索的 SOP 知识库 MVP，覆盖 20 条高频故障。',
      resourceCommitment: '曜石储能提供故障工单数据（脱敏）。',
      resultEvidenceRules: 'R2：新人上手周期下降数据。',
      resources: [],
    },
  ],
  'H03-SH': [
    {
      title: '48 小时做出一个能卖的 AI 工具',
      status: ChallengeStatus.Published,
      type: ChallengeType.CommercialValidation,
      theme: 'AI 应用',
      enterpriseName: 'BoomLand 组委会',
      capacity: 20,
      realProblem: '黑客松作品常常止步于 Demo，缺少真实买家验证。',
      targetCustomer: '现场评委与受邀的 5 家企业代表。',
      minimumDeliverable: '可现场演示的 MVP + 至少 1 份付费意向书（LOI）。',
      resourceCommitment: '主办方提供云资源额度与现场导师团。',
      resultEvidenceRules: 'R2：现场演示评分；R3：赛后 14 天内签署 LOI 或试用协议。',
      resources: [
        {
          kind: ChallengeResourceKind.Funding,
          title: '云资源额度',
          quantity: '每队 ¥2,000',
          conditions: '仅限本赛季模型与算力账单',
          owner: '组委会运营',
          status: ChallengeResourceStatus.Provided,
        },
        {
          kind: ChallengeResourceKind.ExpertChannel,
          title: '现场导师团',
          quantity: '6 位导师 / 2 天',
          conditions: '现场排队，每人每次 20 分钟',
          owner: '组委会运营',
          status: ChallengeResourceStatus.Provided,
        },
      ],
    },
  ],
  'PROTO-S2': [
    {
      title: '把一次真实交付做成可复用服务',
      status: ChallengeStatus.Published,
      type: ChallengeType.UpstreamDownstream,
      theme: '开发者工具',
      enterpriseName: 'SheNicest',
      capacity: 10,
      realProblem: '早期团队的交付全靠人肉，第二次客户来了还得从零开始。',
      targetCustomer: '有稳定交付量但缺少标准化的 2–10 人小团队。',
      minimumDeliverable: '一套可复用的交付包（模板 + checklist + 演示稿），并在真实客户上跑通一次。',
      resourceCommitment: 'SheNicest 提供 2 家真实客户对接与品牌曝光位。',
      resultEvidenceRules: 'R2：客户书面反馈；R3：第二次交付复用率 > 50% 的证据。',
      resources: [
        {
          kind: ChallengeResourceKind.RealDemand,
          title: '2 家真实客户对接',
          quantity: '2 家',
          conditions: '由 SheNicest 牵线，交付范围需双方确认',
          owner: 'SheNicest 运营',
          status: ChallengeResourceStatus.Committed,
        },
        {
          kind: ChallengeResourceKind.Partnership,
          title: '赛季品牌曝光位',
          quantity: '1 个席位',
          conditions: '需在交付完成后提供对外可用的案例',
          owner: 'SheNicest 市场',
          status: ChallengeResourceStatus.Applicable,
        },
      ],
    },
    {
      title: 'AI 时代的个人知识库',
      status: ChallengeStatus.Published,
      type: ChallengeType.SolutionPoc,
      theme: 'AI 应用',
      enterpriseName: null,
      capacity: null,
      realProblem: '个人笔记越记越多，却检索不到、用不上，知识没有变成行动。',
      targetCustomer: '重度记录的知识工作者与独立开发者。',
      minimumDeliverable: '一个能把笔记自动归类并反问用户的 MVP，覆盖 200 条真实笔记。',
      resourceCommitment: '主办方提供模型额度与 20 位内测用户。',
      resultEvidenceRules: 'R2：7 日留存数据报告；R3：付费订阅。',
      resources: [
        {
          kind: ChallengeResourceKind.Funding,
          title: '模型调用额度',
          quantity: '¥5,000 等值',
          conditions: '仅限本赛季内使用',
          owner: '组委会运营',
          status: ChallengeResourceStatus.Committed,
        },
        {
          kind: ChallengeResourceKind.RealDemand,
          title: '20 位内测用户',
          quantity: '20 人',
          conditions: '需提供内测反馈问卷',
          owner: '组委会运营',
          status: ChallengeResourceStatus.Applicable,
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// 公告
// ---------------------------------------------------------------------------

type AnnouncementSeed = {
  title: string
  content: string
  category: 'general' | 'schedule' | 'rules'
  hoursAgo: number
}

const ANNOUNCEMENTS: Record<string, AnnouncementSeed[]> = {
  AI4BBS: [
    {
      title: '欢迎来到 AI4BBS 产业商业赛季',
      content: '报名已截止，组队已完成。本周进入命题交付阶段，先挑一张牌桌，和出题方对齐最小交付物。',
      category: 'general',
      hoursAgo: 46,
    },
    {
      title: '赛程变更：命题冻结提前 4 天完成',
      content: '四道企业命题已全部冻结，后续只接受对最小交付物的澄清，不再新增命题。',
      category: 'schedule',
      hoursAgo: 30,
    },
    {
      title: '规则澄清：积分归项目，不按命题分账',
      content: '一个项目可以坐多张牌桌，但积分统一归项目账户；单次评分上限 300 分，超过 280 分进入大额复核。',
      category: 'rules',
      hoursAgo: 8,
    },
    {
      title: 'M1 里程碑截止提醒',
      content: `M1（问题验证）请于 ${isoText(at(3 * DAY))} 前提交，逾期本阶段不计分。`,
      category: 'schedule',
      hoursAgo: 2,
    },
  ],
  'H03-SH': [
    {
      title: 'H03 上海站开放报名',
      content: '限额 60 人，先到先得。现场提供食宿补贴，请自带电脑。',
      category: 'general',
      hoursAgo: 60,
    },
    {
      title: '现场命题已确认',
      content: '本次命题统一为「48 小时做出一个能卖的 AI 工具」，评审由现场评委与 5 家企业代表共同完成。',
      category: 'rules',
      hoursAgo: 12,
    },
  ],
  'PROTO-S2': [
    {
      title: '第二季报名开放中',
      content: `报名窗口 ${isoText(at(-2 * DAY))} 至 ${isoText(at(12 * DAY))}（UTC）。招募 30 支早期团队或 1–3 人小队。`,
      category: 'general',
      hoursAgo: 40,
    },
    {
      title: '赛程与评审口径说明',
      content: '本季沿用平台默认规则：每人最多 1 个项目、团队核心 3 人、单次评分上限 100 分。',
      category: 'rules',
      hoursAgo: 6,
    },
  ],
}

// ---------------------------------------------------------------------------
// 报名 / 选手（演示账号）
// ---------------------------------------------------------------------------

type ApplicationStatusValue =
  (typeof SeasonApplicationStatus)[keyof typeof SeasonApplicationStatus]
type WechatStatusValue = (typeof WechatStatus)[keyof typeof WechatStatus]
type VisibilityValue = (typeof ApplicationVisibility)[keyof typeof ApplicationVisibility]

type ApplicationSeed = {
  /** 演示账号 id（数字字符串） */
  userId: string
  nickname: string
  status: ApplicationStatusValue
  skills: string
  experience: string
  themes: string[]
  teamIntent: string
  acceptsSolo: boolean
  availability: string
  cityMode: string
  contact: { wechat?: string; phone?: string }
  visibility: VisibilityValue
  /** 主办方/管理员审核动作；写入 reviewedBy/reviewedAt 与审计 */
  review?: { reason?: string }
  /** 成为选手后的微信群状态；不填表示未成为选手 */
  wechat?: WechatStatusValue
  createdAt: Date
}

const DEMO_APPLICATIONS: Record<string, ApplicationSeed[]> = {
  AI4BBS: [
    {
      userId: DEMO_USER_IDS.organizer,
      nickname: '张一',
      status: SeasonApplicationStatus.Accepted,
      skills: '产品策略、里程碑设计、企业对接',
      experience: '做过 3 个 B 端产品从 0 到 1，负责过两个园区的储能运维数字化项目。',
      themes: ['新型储能基建'],
      teamIntent: '想找一位懂电力数据的工程师一起做储能运维方向，我负责产品与客户。',
      acceptsSolo: false,
      availability: '每周 15 小时，周末可到现场',
      cityMode: '上海，可出差长三角',
      contact: { wechat: 'demo-organizer' },
      visibility: ApplicationVisibility.Public,
      review: {},
      wechat: WechatStatus.Joined,
      createdAt: at(-28 * DAY),
    },
    {
      userId: DEMO_USER_IDS.yaoshi,
      nickname: '李二',
      status: SeasonApplicationStatus.Accepted,
      skills: '储能系统、电气工程、现场调试',
      experience: '8 年工商业储能项目交付，熟悉 PCS/BMS 与园区配电。',
      themes: ['新型储能基建', '全球 AI 基建'],
      teamIntent: '希望和软件同学组队，把站点数据变成能卖的服务。',
      acceptsSolo: false,
      availability: '周末 8 小时',
      cityMode: '杭州',
      contact: { phone: '13800000102' },
      visibility: ApplicationVisibility.OrganizerOnly,
      review: {},
      wechat: WechatStatus.Invited,
      createdAt: at(-27 * DAY),
    },
    {
      userId: DEMO_USER_IDS.qinghe,
      nickname: '王知微',
      status: SeasonApplicationStatus.Accepted,
      skills: '仓储运营、质检流程、供应链',
      experience: '在电商退货仓做过 3 年运营，主导过质检标准统一。',
      themes: ['新生产关系的人本基建'],
      teamIntent: '想找做视觉识别的同学一起做仓储质检。',
      acceptsSolo: true,
      availability: '工作日晚上 + 周末',
      cityMode: '上海',
      contact: { wechat: 'demo-qinghe' },
      visibility: ApplicationVisibility.Public,
      review: {},
      wechat: WechatStatus.NotInvited,
      createdAt: at(-26 * DAY),
    },
    {
      userId: '104',
      nickname: '陈知微',
      status: SeasonApplicationStatus.Submitted,
      skills: '后端开发、数据管道',
      experience: '5 年 Go/Java 后端，做过工业 IoT 数据采集平台。',
      themes: ['全球 AI 基建'],
      teamIntent: '想做边缘算力方向的调度与监控。',
      acceptsSolo: true,
      availability: '每周 20 小时',
      cityMode: '远程',
      contact: { phone: '13800000104' },
      visibility: ApplicationVisibility.OrganizerOnly,
      createdAt: at(-25 * DAY),
    },
    {
      userId: '105',
      nickname: '周行',
      status: SeasonApplicationStatus.Pending,
      skills: '算法、能耗建模',
      experience: '能源领域算法工程师，做过峰谷套利策略优化。',
      themes: ['新型储能基建'],
      teamIntent: '想加入一支已经对接真实站点的队伍。',
      acceptsSolo: false,
      availability: '每周 10 小时',
      cityMode: '北京，可远程',
      contact: { wechat: 'demo-105' },
      visibility: ApplicationVisibility.OrganizerOnly,
      review: { reason: '技术背景合适，等出题方确认站点对接后决定' },
      createdAt: at(-24 * DAY),
    },
    {
      userId: '106',
      nickname: '吴桐',
      status: SeasonApplicationStatus.Rejected,
      skills: '市场推广',
      experience: '做过社群运营。',
      themes: ['新生产关系的人本基建'],
      teamIntent: '希望参与传播。',
      acceptsSolo: true,
      availability: '每周 3 小时',
      cityMode: '远程',
      contact: { wechat: 'demo-106' },
      visibility: ApplicationVisibility.OrganizerOnly,
      review: { reason: '可投入时间不足以支撑赛季交付，建议下一季再来' },
      createdAt: at(-23 * DAY),
    },
    {
      userId: '107',
      nickname: '郑南',
      status: SeasonApplicationStatus.Withdrawn,
      skills: '前端开发',
      experience: '3 年 React 经验。',
      themes: ['全球 AI 基建'],
      teamIntent: '想找后端同学组队。',
      acceptsSolo: false,
      availability: '每周 12 小时',
      cityMode: '广州',
      contact: { phone: '13800000107' },
      visibility: ApplicationVisibility.OrganizerOnly,
      createdAt: at(-23 * DAY + 5 * HOUR),
    },
  ],
  'H03-SH': [
    {
      userId: DEMO_USER_IDS.qinghe,
      nickname: '王知微',
      status: SeasonApplicationStatus.Submitted,
      skills: '全栈、快速原型',
      experience: '参加过 4 次黑客松，拿过 2 次现场奖。',
      themes: ['AI 应用', '开发者工具'],
      teamIntent: '想组 3 人队：一个设计 + 一个算法 + 我。',
      acceptsSolo: true,
      availability: '整个周末',
      cityMode: '上海',
      contact: { wechat: 'demo-hackathon' },
      visibility: ApplicationVisibility.OrganizerOnly,
      createdAt: at(-2 * DAY),
    },
    {
      userId: '104',
      nickname: '陈知微',
      status: SeasonApplicationStatus.Accepted,
      skills: '算法、LLM 应用',
      experience: '做过两个 AI Agent 产品原型。',
      themes: ['AI 应用', '机器人'],
      teamIntent: '带一台机器人来现场，想找人一起做演示。',
      acceptsSolo: false,
      availability: '整个周末',
      cityMode: '上海',
      contact: { phone: '13800000104' },
      visibility: ApplicationVisibility.Public,
      review: {},
      wechat: WechatStatus.NotInvited,
      createdAt: at(-2 * DAY + 2 * HOUR),
    },
  ],
  'PROTO-S2': [
    {
      userId: DEMO_USER_IDS.yaoshi,
      nickname: '李二',
      status: SeasonApplicationStatus.Submitted,
      skills: '产品、交付标准化',
      experience: '交付过 20+ 小客户项目。',
      themes: ['开发者工具'],
      teamIntent: '想找一名设计师一起把交付模板做成产品。',
      acceptsSolo: false,
      availability: '每周 12 小时',
      cityMode: '杭州',
      contact: { wechat: 'demo-protoseeds' },
      visibility: ApplicationVisibility.Public,
      createdAt: at(-1 * DAY),
    },
  ],
}

// ---------------------------------------------------------------------------
// 写入
// ---------------------------------------------------------------------------

async function grantRoles() {
  await userIdentity.grantRole(OPERATOR_USER_ID, Role.Operator)
  // 主办方成员也是平台用户：给 Founder 身份。组织成员资格另由
  // organizer_org_members 承载（不等于平台角色）。
  for (const userId of Object.values(DEMO_USER_IDS)) {
    await userIdentity.grantRole(userId, Role.Founder)
  }
  console.log(`✓ roles: operator=${OPERATOR_USER_ID}, demo accounts=${Object.values(DEMO_USER_IDS).join(',')}`)
}

async function seedSharedUsers() {
  const profiles = [
    // 运营本人也要有资料行：选手的 `wechat_invited_by` 记的是他，拉群页的
    // 「记录人」列要显示昵称而不是裸 userId（缺行时前端只能退回 id）。
    { id: OPERATOR_USER_ID, nickname: '李想' },
    { id: DEMO_USER_IDS.organizer, nickname: '张一' },
    { id: DEMO_USER_IDS.yaoshi, nickname: '李二' },
    { id: DEMO_USER_IDS.qinghe, nickname: '王知微' },
    { id: DEMO_USER_IDS.scorerA, nickname: '评审甲' },
    { id: DEMO_USER_IDS.scorerB, nickname: '评审乙' },
    { id: DEMO_USER_IDS.verifierA, nickname: '核验甲' },
    { id: DEMO_USER_IDS.verifierB, nickname: '核验乙' },
    { id: '104', nickname: '陈知微' },
    { id: '105', nickname: '周行' },
    { id: '106', nickname: '吴桐' },
    { id: '107', nickname: '郑南' },
  ]
  const { seeded, skipped } = await upsertSharedUsers(profiles)
  if (skipped > 0) console.warn(`! skipped ${skipped} profile(s) with non-numeric id`)
  console.log(`✓ shared users: ${seeded} demo profile(s)`)
}

async function upsertOrg(name: string): Promise<number> {
  const existing = await db.select().from(organizerOrgs).where(eq(organizerOrgs.name, name)).limit(1)
  if (existing[0]) return existing[0].id
  const result = await db.insert(organizerOrgs).values({ name })
  return Number(result[0].insertId)
}

async function addOrgMember(orgId: number, userId: string) {
  await db
    .insert(organizerOrgMembers)
    .values({ orgId, userId })
    .onDuplicateKeyUpdate({ set: { userId } })
}

async function upsertSeason(seed: SeasonSeed, orgIds: Record<BoomlandOrgKey, number>): Promise<number> {
  // 数据库连接按 UTC 存 timestamp；写之前按业务规则校验，避免 seed 出一份
  // 前端时间轴看着合理、readiness 却过不了的赛程。
  const scheduleError = validateSchedule({
    applyOpen: seed.schedule.applyOpen.toISOString(),
    applyClose: seed.schedule.applyClose.toISOString(),
    startAt: seed.schedule.startAt.toISOString(),
    teamDeadline: seed.schedule.teamDeadline.toISOString(),
    challengeFreezeAt: seed.schedule.challengeFreezeAt.toISOString(),
    workDeadline: seed.schedule.workDeadline.toISOString(),
    scoreDeadline: seed.schedule.scoreDeadline.toISOString(),
    settleDate: seed.schedule.settleDate.toISOString(),
  })
  if (scheduleError) throw new Error(`${seed.code}: ${scheduleError}`)

  // 每季规则 = 平台默认 + 本季覆盖项。规则卡文案也按这份生成，
  // 所以「赛季 rules」与「规则卡上写的数字」永远一致。
  const seasonRules: SeasonRules = { ...SEASON_RULE_DEFAULTS, ...seed.rules }

  const values = {
    name: seed.name,
    type: seed.type,
    city: seed.city,
    intro: seed.intro,
    themes: seed.themes,
    participantCapacity: seed.participantCapacity,
    ...seed.schedule,
    status: seed.status,
    pinned: seed.pinned,
    submittedAt: seed.submittedAt,
    approvedAt: seed.approvedAt,
    approvedBy: OPERATOR_USER_ID,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    startedAt: seed.startedAt,
    suspendedAt: null,
    statusBeforeSuspend: null,
    resumedAt: null,
    cancelledAt: null,
    cancelReason: null,
    awardingEntity: seed.awardingEntity,
    agreementVersion: 'v1',
    rulesVersion: 2, // 赛程变更过一次（见公告）
    rules: seasonRules,
    createdBy: OPERATOR_USER_ID,
  }

  const existing = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.code, seed.code))
    .limit(1)
  let seasonId: number
  if (existing[0]) {
    seasonId = existing[0].id
    await db.update(seasons).set(values).where(eq(seasons.id, seasonId))
    console.log(`  ↺ season ${seed.code} (#${seasonId}, ${seed.status})`)
  } else {
    const result = await db.insert(seasons).values({ code: seed.code, ...values })
    seasonId = Number(result[0].insertId)
    console.log(`  ✓ season ${seed.code} (#${seasonId}, ${seed.status})`)
  }

  // 置顶全平台唯一：置顶这个赛季时把其它赛季取消置顶
  if (seed.pinned) {
    await db
      .update(seasons)
      .set({ pinned: false })
      .where(and(eq(seasons.pinned, true), ne(seasons.id, seasonId)))
  }

  await db.delete(seasonOrganizers).where(eq(seasonOrganizers.seasonId, seasonId))
  for (const key of seed.organizers) {
    await db.insert(seasonOrganizers).values({ seasonId, orgId: orgIds[key] })
  }

  // 规则卡：必要项按赛季配置生成后全量 upsert（文案不手写，与读接口同一份来源）
  const ruleCardItems = seasonRequiredRuleCardItems({
    rules: seasonRules,
    schedule: {
      applyOpen: seed.schedule.applyOpen.toISOString(),
      applyClose: seed.schedule.applyClose.toISOString(),
      startAt: seed.schedule.startAt.toISOString(),
      teamDeadline: seed.schedule.teamDeadline.toISOString(),
      challengeFreezeAt: seed.schedule.challengeFreezeAt.toISOString(),
      workDeadline: seed.schedule.workDeadline.toISOString(),
      scoreDeadline: seed.schedule.scoreDeadline.toISOString(),
      settleDate: seed.schedule.settleDate.toISOString(),
    },
  })
  for (const [index, item] of ruleCardItems.entries()) {
    await db
      .insert(seasonRuleCardItems)
      .values({
        seasonId,
        key: item.key,
        label: item.label,
        value: item.value,
        required: true,
        visible: true,
        sortOrder: index,
      })
      .onDuplicateKeyUpdate({
        set: {
          label: item.label,
          value: item.value,
          required: true,
          visible: true,
          sortOrder: index,
        },
      })
  }
  // 清理旧的可选条目与已从必要项移除的历史 key，保证规则卡与上面定义一致
  const currentKeys = new Set<string>(ruleCardItems.map((item) => item.key))
  const existingRows = await db
    .select({ id: seasonRuleCardItems.id, key: seasonRuleCardItems.key, required: seasonRuleCardItems.required })
    .from(seasonRuleCardItems)
    .where(eq(seasonRuleCardItems.seasonId, seasonId))
  const staleIds = existingRows
    .filter((row) => !row.required || !currentKeys.has(row.key))
    .map((row) => row.id)
  if (staleIds.length > 0) {
    await db.delete(seasonRuleCardItems).where(inArray(seasonRuleCardItems.id, staleIds))
  }

  return seasonId
}

async function seedChallenges(seed: SeasonSeed, seasonId: number) {
  // 命题整表重建：`challenges` 没有 (season, title) 唯一键，没法按 key upsert，
  // 所以沿用既有做法 —— 先按赛季删干净再插。
  //
  // **三张子表都要跟着删**：`challenge_resources`、`challenge_versions`、
  // `challenge_follows` 都以 `challenge_id` 关联但没有外键，只删命题会留下
  // 一批指向已消失 id 的孤儿行（详情页按 id 查不到，后台表格却还在）。
  const existing = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.seasonId, seasonId))
  const staleChallengeIds = existing.map((row) => row.id)
  if (staleChallengeIds.length > 0) {
    await db.delete(challengeResources).where(inArray(challengeResources.challengeId, staleChallengeIds))
    await db.delete(challengeVersions).where(inArray(challengeVersions.challengeId, staleChallengeIds))
    await db.delete(challengeFollows).where(inArray(challengeFollows.challengeId, staleChallengeIds))
    await db.delete(challenges).where(eq(challenges.seasonId, seasonId))
  }

  // 「选择本命题的项目」需要 `projects` 行，而 `projects` 只由 `bun run seed` 建。
  // 读不到就跳过（打日志），不让 seed:season 因为没跑过 seed 直接崩。
  const availableProjects = await db
    .select({ id: projects.id, userId: projects.userId })
    .from(projects)
    .where(eq(projects.status, ProjectStatus.Live))
    .orderBy(projects.id)
  // 上一轮 seed 建过的赛季项目引用的是旧命题 id，先按「同一批演示项目」清掉，
  // 避免留下指向已删除命题的 season_projects（唯一键 (season, project) 也要求 upsert）。
  const demoProjectIds = availableProjects.slice(0, 8).map((row) => row.id)
  if (demoProjectIds.length > 0) {
    await db
      .delete(seasonProjects)
      .where(and(
        eq(seasonProjects.seasonId, seasonId),
        inArray(seasonProjects.projectId, demoProjectIds),
      ))
  }

  const list = CHALLENGES[seed.code] ?? []
  let versionCount = 0
  let projectCount = 0
  for (const [index, challenge] of list.entries()) {
    const {
      resources = [],
      versions = [],
      rights,
      projectStages = [],
      ...fields
    } = challenge
    // 版本号跟版本记录对齐：最后一条记录写的是第几版，命题就是第几版。
    const version = versions.at(-1)?.version ?? challenge.version ?? 1
    const [result] = await db.insert(challenges).values({
      seasonId,
      ...fields,
      type: fields.type ?? null,
      theme: fields.theme ?? null,
      enterpriseName: fields.enterpriseName ?? null,
      capacity: fields.capacity ?? null,
      summary: fields.summary ?? null,
      background: fields.background ?? null,
      industry: fields.industry ?? null,
      scope: fields.scope ?? null,
      outOfScope: fields.outOfScope ?? null,
      monthlyGoal: fields.monthlyGoal ?? null,
      suggestedSkills: fields.suggestedSkills ?? [],
      teamCapacity: fields.teamCapacity ?? null,
      ownerName: fields.ownerName ?? null,
      responseSla: fields.responseSla ?? null,
      scoringWeights: fields.scoringWeights ?? null,
      singleWorkCap: fields.singleWorkCap ?? null,
      rightsPublicScope: rights?.rightsPublicScope ?? null,
      rightsConfidentiality: rights?.rightsConfidentiality ?? null,
      rightsIp: rights?.rightsIp ?? null,
      rightsEnterpriseUsage: rights?.rightsEnterpriseUsage ?? null,
      rightsProcurement: rights?.rightsProcurement ?? null,
      rightsSpecialTerms: rights?.rightsSpecialTerms ?? null,
      rightsExclusivity: rights?.rightsExclusivity ?? null,
      version,
      createdBy: OPERATOR_USER_ID,
      createdAt: at(-34 * DAY + index * HOUR),
    })
    const challengeId = Number(result.insertId)

    if (resources.length > 0) {
      await db.insert(challengeResources).values(
        resources.map((resource, resourceIndex) => ({
          challengeId,
          kind: resource.kind,
          title: resource.title,
          quantity: resource.quantity ?? null,
          conditions: resource.conditions ?? null,
          owner: resource.owner ?? null,
          status: resource.status ?? ChallengeResourceStatus.Committed,
          sortOrder: resourceIndex,
        })),
      )
    }

    if (versions.length > 0) {
      await db.insert(challengeVersions).values(
        versions.map((entry) => ({
          challengeId,
          version: entry.version,
          note: entry.note,
          changedBy: entry.changedBy ?? OPERATOR_USER_ID,
          // 显式 createdAt：版本记录是历史留痕，不能用插入时刻。
          createdAt: entry.createdAt,
        })),
      )
      versionCount += versions.length
    }

    if (projectStages.length > 0) {
      const chosen = availableProjects.slice(0, projectStages.length)
      if (chosen.length < projectStages.length) {
        console.warn(
          `    ! 项目行不足：需要 ${projectStages.length} 个、只找到 ${chosen.length} 个；`
          + '先跑 `bun run seed` 建 projects，再跑 seed:season',
        )
      }
      for (const [projectIndex, project] of chosen.entries()) {
        const stage = projectStages[projectIndex] ?? SeasonProjectStage.Seed
        const [link] = await db.insert(seasonProjects).values({
          seasonId,
          projectId: project.id,
          ownerUserId: project.userId || OPERATOR_USER_ID,
          source: SeasonProjectSource.Created,
          themes: [challenge.theme ?? (seed.themes[0] ?? '')].filter(Boolean),
          challengeIds: [challengeId],
          status: SeasonProjectStatus.Published,
          stage,
        })
        await db
          .insert(seasonProjectMembers)
          .values({
            seasonProjectId: Number(link.insertId),
            userId: project.userId || OPERATOR_USER_ID,
            role: SeasonProjectMemberRole.Owner,
            status: SeasonProjectMemberStatus.Accepted,
          })
          .onDuplicateKeyUpdate({ set: { role: SeasonProjectMemberRole.Owner } })
        projectCount += 1
      }
    }
  }
  const byStatus = list.reduce<Record<string, number>>((acc, challenge) => {
    acc[challenge.status] = (acc[challenge.status] ?? 0) + 1
    return acc
  }, {})
  const summary = Object.entries(byStatus)
    .map(([status, count]) => `${status} x${count}`)
    .join(' / ')
  const resourceCount = list.reduce((sum, challenge) => sum + (challenge.resources?.length ?? 0), 0)
  console.log(
    `    ✓ ${list.length} challenges (${summary || 'none'}) / ${resourceCount} resource(s)`
    + ` / ${versionCount} version(s) / ${projectCount} season project(s)`,
  )
}

/**
 * 企业合作配置：整表替换。
 *
 * 企业名 + 档位没有唯一键（同一企业可以有多条档位配置），所以按赛季整体重建，
 * 与命题、预算的 seed 口径一致。
 */
async function seedCooperations(seed: SeasonSeed, seasonId: number) {
  await db.delete(seasonEnterpriseCooperations).where(eq(seasonEnterpriseCooperations.seasonId, seasonId))
  if (seed.cooperations.length > 0) {
    await db.insert(seasonEnterpriseCooperations).values(
      seed.cooperations.map((cooperation, index) => ({
        seasonId,
        enterpriseName: cooperation.enterpriseName,
        tier: cooperation.tier,
        grade: cooperation.grade,
        totalAmount: cooperation.totalAmount,
        managementFee: cooperation.managementFee,
        prizePoolAmount: cooperation.prizePoolAmount,
        dataGrant: cooperation.dataGrant,
        publicScope: cooperation.publicScope,
        status: cooperation.status,
        sortOrder: index,
      })),
    )
  }
  const signed = seed.cooperations.filter(
    (cooperation) => cooperation.status === EnterpriseCooperationStatus.Signed,
  ).length
  console.log(`    ✓ ${seed.cooperations.length} cooperation(s) (${signed} signed)`)
}

async function seedAnnouncements(seed: SeasonSeed, seasonId: number) {
  await db.delete(seasonAnnouncements).where(eq(seasonAnnouncements.seasonId, seasonId))
  const list = ANNOUNCEMENTS[seed.code] ?? []
  for (const announcement of list) {
    await db.insert(seasonAnnouncements).values({
      seasonId,
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      createdBy: OPERATOR_USER_ID,
      createdAt: at(-announcement.hoursAgo * HOUR),
    })
  }
  console.log(`    ✓ ${list.length} announcements`)
}

async function seedBudgets(seed: SeasonSeed, seasonId: number) {
  await db.delete(seasonBudgets).where(eq(seasonBudgets.seasonId, seasonId))
  for (const [index, budget] of seed.budgets.entries()) {
    await db.insert(seasonBudgets).values({
      seasonId,
      version: index + 1,
      totalAmount: budget.totalAmount,
      status: budget.status,
      reason: budget.reason,
      createdBy: OPERATOR_USER_ID,
      createdAt: at(-33 * DAY + index * 5 * DAY),
    })
  }
  const active = seed.budgets.find((budget) => budget.status === BudgetStatus.Active)
  console.log(`    ✓ budget v${seed.budgets.length} active ¥${active?.totalAmount ?? 0}`)
}

async function seedConfig(seed: SeasonSeed, seasonId: number, orgIds: Record<BoomlandOrgKey, number>) {
  const allocated = seed.pointPool.scorers.reduce((sum, scorer) => sum + scorer.amount, 0)
  const poolValues = {
    totalPoints: seed.pointPool.totalPoints,
    allocatedPoints: allocated,
    usedPoints: 0,
    version: 1,
    status: 'active',
    createdBy: OPERATOR_USER_ID,
  }
  const existing = await db
    .select({ id: seasonPointPools.id })
    .from(seasonPointPools)
    .where(eq(seasonPointPools.seasonId, seasonId))
    .limit(1)
  let poolId: number
  if (existing[0]) {
    poolId = existing[0].id
    await db.update(seasonPointPools).set(poolValues).where(eq(seasonPointPools.id, poolId))
  } else {
    const result = await db.insert(seasonPointPools).values({ seasonId, ...poolValues })
    poolId = Number(result[0].insertId)
  }

  await db.delete(pointAllocations).where(eq(pointAllocations.seasonId, seasonId))
  for (const scorer of seed.pointPool.scorers) {
    await db.insert(pointAllocations).values({
      seasonId,
      poolId,
      scorerUserId: DEMO_USER_IDS[scorer.account],
      amount: scorer.amount,
      usedAmount: scorer.usedAmount,
      status: PointAllocationStatus.Active,
      createdBy: OPERATOR_USER_ID,
    })
  }
  console.log(
    `    ✓ point pool ${seed.pointPool.totalPoints} / allocated ${allocated} / ${seed.pointPool.scorers.length} scorer(s)`,
  )

  await db.delete(seasonVerifierGrants).where(eq(seasonVerifierGrants.seasonId, seasonId))
  for (const account of seed.verifiers) {
    await db.insert(seasonVerifierGrants).values({
      seasonId,
      userId: DEMO_USER_IDS[account],
      status: VerifierGrantStatus.Active,
      grantedBy: OPERATOR_USER_ID,
      grantedAt: seed.approvedAt,
    })
  }
  console.log(`    ✓ ${seed.verifiers.length} verifier(s)`)

  // 每个主办方组织至少一名成员（readiness「主办方组织有效」依赖它）
  const orgMembers: Record<BoomlandOrgKey, string[]> = {
    committee: [OPERATOR_USER_ID, DEMO_USER_IDS.organizer],
    yaoshi: [DEMO_USER_IDS.yaoshi],
    qinghe: [DEMO_USER_IDS.qinghe],
  }
  for (const key of seed.organizers) {
    for (const member of orgMembers[key]) await addOrgMember(orgIds[key], member)
  }
}

async function seedApplications(seed: SeasonSeed, seasonId: number) {
  const list = DEMO_APPLICATIONS[seed.code] ?? []
  const userIds = list.map((application) => application.userId)
  if (userIds.length > 0) {
    // 先删选手再删报名：(season, user) / application_id 唯一约束
    await db
      .delete(seasonParticipants)
      .where(and(eq(seasonParticipants.seasonId, seasonId), inArray(seasonParticipants.userId, userIds)))
    await db
      .delete(seasonApplications)
      .where(and(eq(seasonApplications.seasonId, seasonId), inArray(seasonApplications.userId, userIds)))
  }

  let participantCount = 0
  for (const application of list) {
    const [result] = await db.insert(seasonApplications).values({
      seasonId,
      userId: application.userId,
      skills: application.skills,
      experience: application.experience,
      themes: application.themes,
      teamIntent: application.teamIntent,
      acceptsSolo: application.acceptsSolo,
      availability: application.availability,
      cityMode: application.cityMode,
      contactEncrypted: encryptBoomlandContact(application.contact),
      visibility: application.visibility,
      agreementVersion: 'v1',
      status: application.status,
      reviewedBy: application.review ? OPERATOR_USER_ID : null,
      reviewReason: application.review?.reason ?? null,
      reviewedAt: application.review ? at(-20 * DAY) : null,
      withdrawnAt: application.status === SeasonApplicationStatus.Withdrawn ? at(-21 * DAY) : null,
      createdAt: application.createdAt,
      updatedAt: application.createdAt,
    })
    const applicationId = Number(result.insertId)

    if (application.status === SeasonApplicationStatus.Accepted) {
      const wechat = application.wechat ?? WechatStatus.NotInvited
      await db.insert(seasonParticipants).values({
        seasonId,
        userId: application.userId,
        applicationId,
        wechatStatus: wechat,
        wechatInvitedBy: wechat === WechatStatus.NotInvited ? null : OPERATOR_USER_ID,
        wechatInvitedAt: wechat === WechatStatus.NotInvited ? null : at(-17 * DAY),
        joinedAt: wechat === WechatStatus.Joined ? at(-15 * DAY) : null,
        status: SeasonParticipantStatus.Active,
        createdAt: at(-20 * DAY),
      })
      participantCount += 1
    }
  }
  console.log(`    ✓ ${list.length} applications / ${participantCount} participants`)
  return list
}

async function seedAuditLogs(seed: SeasonSeed, seasonId: number, applications: ApplicationSeed[]) {
  await db.delete(auditLogs).where(eq(auditLogs.seasonId, seasonId))
  const entries: Array<typeof auditLogs.$inferInsert> = [
    {
      actorUserId: OPERATOR_USER_ID,
      action: 'season.created',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { code: seed.code, name: seed.name },
      createdAt: at(-36 * DAY),
    },
    {
      actorUserId: OPERATOR_USER_ID,
      action: 'season.submitted',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { autoApproved: true },
      createdAt: seed.submittedAt,
    },
    {
      actorUserId: OPERATOR_USER_ID,
      action: 'season.approved',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { autoApproved: true },
      createdAt: seed.approvedAt,
    },
  ]
  const lastBudget = seed.budgets.at(-1)
  if (lastBudget) {
    entries.push({
      actorUserId: OPERATOR_USER_ID,
      action: 'budget.added',
      targetType: 'season_budget',
      targetId: String(seasonId),
      seasonId,
      detail: { version: seed.budgets.length, totalAmount: lastBudget.totalAmount },
      createdAt: at(-33 * DAY),
    })
  }
  if (seed.startedAt) {
    entries.push({
      actorUserId: OPERATOR_USER_ID,
      action: 'season.started',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      createdAt: seed.startedAt,
    })
  }
  for (const application of applications) {
    entries.push({
      actorUserId: application.userId,
      action: 'application.submitted',
      targetType: 'season_application',
      targetId: application.userId,
      seasonId,
      detail: { visibility: application.visibility },
      createdAt: application.createdAt,
    })
    if (application.review) {
      entries.push({
        actorUserId: OPERATOR_USER_ID,
        action: 'application.status_changed',
        targetType: 'season_application',
        targetId: application.userId,
        seasonId,
        detail: {
          from: SeasonApplicationStatus.Submitted,
          to: application.status,
          reason: application.review.reason ?? null,
        },
        createdAt: at(-20 * DAY),
      })
    }
  }
  await db.insert(auditLogs).values(entries)
  console.log(`    ✓ ${entries.length} audit log(s)`)
}

async function main() {
  console.log('Seeding BoomLand demo data (火热赛季)...')
  const startedAt = Date.now()

  await grantRoles()

  try {
    await seedSharedUsers()
  } catch (err) {
    console.warn(`! skipped shared users profiles (SHARED_USERS_TABLE not reachable): ${err}`)
  }

  const orgIds = {} as Record<BoomlandOrgKey, number>
  for (const org of BOOMLAND_ORGS) {
    orgIds[org.key] = await upsertOrg(org.name)
    console.log(`✓ organizer org ${org.name} (#${orgIds[org.key]})`)
  }

  for (const seed of SEASONS) {
    const seasonId = await upsertSeason(seed, orgIds)
    await seedConfig(seed, seasonId, orgIds)
    await seedChallenges(seed, seasonId)
    await seedCooperations(seed, seasonId)
    await seedAnnouncements(seed, seasonId)
    await seedBudgets(seed, seasonId)
    const applications = await seedApplications(seed, seasonId)
    await seedAuditLogs(seed, seasonId, applications)
  }

  if ((await db.select({ id: talentProfiles.id }).from(talentProfiles).limit(1)).length === 0) {
    console.log('! talent_profiles is empty — run `bun run seed` for Talent Plaza demo data')
  }

  const rows = await db.select({ id: seasons.id, status: seasons.status }).from(seasons)
  const active = rows.filter((row) => row.status === SeasonStatus.Active).length
  console.log(
    `Done in ${Date.now() - startedAt}ms — ${rows.length} season(s) in DB (${active} active); /seasons shows ${SEASONS.length}.`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
