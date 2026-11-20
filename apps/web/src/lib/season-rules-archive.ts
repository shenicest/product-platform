/**
 * 赛季规则归档的演示数据。
 *
 * 每次赛程或规则变更都会生成一个不可变版本；归档页展示版本号、时间、
 * 操作人、变更原因与当时的完整规则快照。后续接后端时把这里换成
 * `GET /seasons/:id/rule-versions` 即可。
 */

export type SeasonRuleSnapshot = {
  maxChallengesPerProject: number
  maxProjectsPerParticipant: number
  maxCoreMembers: number
  singleWorkCap: number
  exchangeRatio: number
  reviewThreshold: number
  dailyQuota: boolean
  workDeadline: string
  scoreDeadline: string
}

export type SeasonRuleVersion = {
  version: number
  createdAt: string
  operator: string
  reason: string
  announcement: string | null
  rules: SeasonRuleSnapshot
  changes: string[]
}

export const SEASON_RULE_VERSIONS: SeasonRuleVersion[] = [
  {
    version: 3,
    createdAt: '2026.11.18 14:20',
    operator: '主办方 · 组委会小王',
    reason: '延长作品提交窗口，补充 M3 证据要求。',
    announcement: '作品截止调整为 12.10，评分截止调整为 12.15。',
    rules: {
      maxChallengesPerProject: 3,
      maxProjectsPerParticipant: 2,
      maxCoreMembers: 3,
      singleWorkCap: 300,
      exchangeRatio: 1,
      reviewThreshold: 30,
      dailyQuota: false,
      workDeadline: '2026.12.10',
      scoreDeadline: '2026.12.15',
    },
    changes: ['作品截止 12.03 → 12.10', '评分截止 12.08 → 12.15', 'M3 需关联外部试用证据'],
  },
  {
    version: 2,
    createdAt: '2026.11.10 10:00',
    operator: '主办方 · 组委会小王',
    reason: '补充 M3 外部试用与客户反馈要求。',
    announcement: 'M3 起需要提交客户试用或真实交付证据。',
    rules: {
      maxChallengesPerProject: 3,
      maxProjectsPerParticipant: 2,
      maxCoreMembers: 3,
      singleWorkCap: 300,
      exchangeRatio: 1,
      reviewThreshold: 30,
      dailyQuota: false,
      workDeadline: '2026.12.03',
      scoreDeadline: '2026.12.08',
    },
    changes: ['新增 M3 外部试用证据要求', '客户反馈计入作品类型'],
  },
  {
    version: 1,
    createdAt: '2026.10.28 09:30',
    operator: '平台管理员',
    reason: '赛季创建，初始化规则卡与赛程。',
    announcement: null,
    rules: {
      maxChallengesPerProject: 3,
      maxProjectsPerParticipant: 2,
      maxCoreMembers: 3,
      singleWorkCap: 300,
      exchangeRatio: 1,
      reviewThreshold: 30,
      dailyQuota: false,
      workDeadline: '2026.12.03',
      scoreDeadline: '2026.12.08',
    },
    changes: ['初始规则卡', '积分兑换 1:1', '单次评分上限 300'],
  },
]

export const CURRENT_RULE_VERSION = SEASON_RULE_VERSIONS[0]
