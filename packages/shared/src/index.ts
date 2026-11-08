export const ProjectStatus = {
  Draft: 0,
  PendingReview: 1,
  RevisionRequired: 2,
  Live: 3,
  Delisted: 4,
  Rejected: 5,
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

export const ProposalStatus = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
  RevisionRequired: 3,
} as const
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus]

export const ProjectStage = {
  Idea: 0,
  Prototype: 1,
  Mvp: 2,
  Launched: 3,
  Revenue: 4,
} as const
export type ProjectStage = (typeof ProjectStage)[keyof typeof ProjectStage]

export const Role = {
  Founder: 0,
  Operator: 1,
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const CATEGORIES = ['女性健康', '效率工具', '教育学习', '开发者工具', '生活方式', '其他'] as const
export type Category = (typeof CATEGORIES)[number]

export const HACKATHON_TRACK_TAGS = {
  software: {
    label: '软件',
    dimensions: {
      experience: ['上手简单', '交互流畅', '界面清爽', '信息层级清晰', '反馈及时', '令人困惑', '学习曲线陡峭'],
      technology: ['性能优异', '架构清晰', '稳定性高', '兼容性好', '响应迅速', '存在Bug', '加载缓慢'],
      creativity: ['交互新颖', '设计精致', '概念超前', '细节打磨', '风格独特', '审美疲劳'],
      utility: ['解决痛点', '工具性强', '可复用性高', '生态开放', '难以推广'],
      improvement: ['需优化性能', '增加核心功能', '改善用户体验', '完善文档说明', '降低使用门槛', '扩展平台支持'],
    },
  },
  hardware: {
    label: '硬件',
    dimensions: {
      experience: ['手感出色', '质感高级', '佩戴/握持舒适', '操作直观', '重量适中', '人体工学差', '有廉价感'],
      technology: ['做工精良', '性能强劲', '功耗合理', '连接稳定', '散热优秀', '续航出色', '信号差', '发热严重'],
      creativity: ['外观设计惊艳', '结构巧妙', '材质创新', '交互方式新颖', '辨识度强', '工艺粗糙'],
      utility: ['解决真实场景', '耐用可靠', '生态兼容', '性价比合理', '维修困难', '配件不足'],
      improvement: ['改善人体工学', '降低成本/售价', '提升续航', '增强兼容性', '优化散热', '丰富配件生态', '完善包装/开箱体验'],
    },
  },
  game: {
    label: '游戏',
    dimensions: {
      experience: ['沉浸感强', '操作手感好', '节奏舒适', '上手简单', '心流体验', '挫败感强', '引导混乱'],
      technology: ['运行流畅', '优化出色', '无严重Bug', '网络稳定', '加载快', '掉帧卡顿', '闪退崩溃'],
      creativity: ['玩法新颖', '美术风格独特', '叙事动人', '音乐音效出色', '世界观吸引人', '角色塑造立体', '玩法同质化'],
      utility: ['重玩性高', '适合直播/分享', '社交性强', '有教育意义', '内容量不足', '付费体验差'],
      improvement: ['平衡性需调整', '增加内容量', '优化新手引导', '调整难度曲线', '增加多人/联机模式', '改善本地化', '加强反作弊'],
    },
  },
  aigc: {
    label: 'AIGC 影像',
    dimensions: {
      experience: ['沉浸感强', '节奏舒适', '情感共鸣', '视听震撼', '引人入胜', '节奏拖沓', '情感疏离', '出戏感强'],
      technology: ['画面质量高', '动态流畅自然', '人物/场景一致性好', 'AI痕迹不明显', '音效与画面匹配', '分辨率清晰', '画面闪烁/抖动', '人物变形/崩坏', '物理规律违和', '口型/动作不自然'],
      creativity: ['视觉风格独特', '叙事有新意', '想象力突破常规', '美学表达成熟', 'AI美学辨识度高', '概念空洞', '叙事逻辑混乱', '风格拼凑感强'],
      utility: ['传播性强', '艺术价值高', '启发创作思路', '适合二次创作', '社会议题表达', '难以共鸣', '受众过窄'],
      improvement: ['改善叙事逻辑', '提升画面稳定性', '增强情感铺垫', '优化人物一致性', '调整时长节奏', '减少AI违和感', '丰富视听层次', '明确表达主题'],
    },
  },
} as const

export type HackathonTrack = keyof typeof HACKATHON_TRACK_TAGS
export type HackathonDimension = keyof (typeof HACKATHON_TRACK_TAGS)['software']['dimensions']

export const TalentProfileStatus = {
  Published: 0,
  Paused: 1,
  Suspended: 2,
} as const
export type TalentProfileStatus = (typeof TalentProfileStatus)[keyof typeof TalentProfileStatus]

// Current-collaboration-availability signal (Public CTA on TalentProfile).
// Stored as a tinyint column; labels are display-only.
export const TalentAvailability = {
  ActivelySeeking: 0,
  OpenToChat: 1,
  ConsultOnly: 2,
} as const
export type TalentAvailability = (typeof TalentAvailability)[keyof typeof TalentAvailability]

export const TALENT_AVAILABILITY_LABELS: Record<TalentAvailability, string> = {
  [TalentAvailability.ActivelySeeking]: '积极寻找合作',
  [TalentAvailability.OpenToChat]: '开放聊聊',
  [TalentAvailability.ConsultOnly]: '仅接受一次咨询',
}

export const ConnectionRequestStatus = {
  Pending: 0,
  Accepted: 1,
  Ignored: 2,
  Cancelled: 3,
} as const
export type ConnectionRequestStatus = (typeof ConnectionRequestStatus)[keyof typeof ConnectionRequestStatus]

// Skills are stored as enum keys (skills / seeking_skills JSON columns); the
// labels below are display-only so renames never touch stored data.
export const TALENT_SKILL_LABELS = {
  productStrategy: '产品策略', needsAnalysis: '需求分析', userResearch: '用户研究', projectManagement: '项目管理',
  ui: 'UI', ux: 'UX', visual: '视觉', branding: '品牌', motion: '动效',
  growthStrategy: '增长策略', contentPlanning: '内容策划', contentCreation: '内容创作', socialMedia: '社媒运营', seo: 'SEO', brandCommunication: '品牌传播',
  userOperations: '用户运营', communityOperations: '社区运营', eventOperations: '活动运营', customerSuccess: '客户成功',
  frontend: '前端', backend: '后端', fullstack: '全栈', mobile: '移动端', ai: 'AI', robotics: '机器人', data: '数据', hardware: '硬件',
  dataAnalysis: '数据分析', businessAnalysis: '商业分析',
  businessStrategy: '商业策略', fundraising: '融资', legal: '法务', finance: '财务', industryResearch: '行业研究',
} as const
export type TalentSkill = keyof typeof TALENT_SKILL_LABELS
export type TalentSkillLabel = (typeof TALENT_SKILL_LABELS)[TalentSkill]

// Catalog keys, in display order (mirrors TALENT_SKILL_GROUPS below — keep
// both in sync when adding a skill).
export const TALENT_SKILLS = Object.keys(TALENT_SKILL_LABELS) as TalentSkill[]

// Display a raw stored value: keys map to their label; anything else (legacy
// label data, freeform values) renders as-is instead of breaking the UI.
export function skillLabel(value: string): TalentSkillLabel | string {
  return TALENT_SKILL_LABELS[value as TalentSkill] ?? value
}

// Reverse lookup for free-text search inputs that accept label text.
export function skillKey(value: string): TalentSkill | string {
  if (value in TALENT_SKILL_LABELS) return value as TalentSkill
  const byLabel = (Object.keys(TALENT_SKILL_LABELS) as TalentSkill[]).find((key) => TALENT_SKILL_LABELS[key] === value)
  return byLabel ?? value
}

// Caps on how many skills each wall state may carry (shared by the API rules
// and the editor UI). Kept next to the vocabulary they bound.
export const MAX_TALENT_SKILLS = 10
export const MAX_SEEKING_SKILLS = 5

export type TalentSkillGroup = { direction: string; skills: readonly TalentSkill[] }

// Skill wall grouped by top-level direction, in display order.
export const TALENT_SKILL_GROUPS: readonly TalentSkillGroup[] = [
  { direction: '产品', skills: ['productStrategy', 'needsAnalysis', 'userResearch', 'projectManagement'] },
  { direction: '设计', skills: ['ui', 'ux', 'visual', 'branding', 'motion'] },
  { direction: '增长', skills: ['growthStrategy', 'contentPlanning', 'contentCreation', 'socialMedia', 'seo', 'brandCommunication'] },
  { direction: '运营', skills: ['userOperations', 'communityOperations', 'eventOperations', 'customerSuccess'] },
  { direction: '开发', skills: ['frontend', 'backend', 'fullstack', 'mobile', 'ai', 'robotics', 'data', 'hardware'] },
  { direction: '数据', skills: ['dataAnalysis', 'businessAnalysis'] },
  { direction: '商务/职能', skills: ['businessStrategy', 'fundraising', 'legal', 'finance', 'industryResearch'] },
]

export const COLLABORATION_DURATIONS = ['一次咨询', '短期项目', '长期合作'] as const
export type CollaborationDuration = (typeof COLLABORATION_DURATIONS)[number]

export const CONNECTION_PURPOSES = ['共同创业', '加入项目', '短期协作', '专业咨询', '认识交流', '其他'] as const
export type ConnectionPurpose = (typeof CONNECTION_PURPOSES)[number]

export const HACKATHON_CONNECTION_PURPOSES = [
  '试用产品', '合作交流', '加入项目', '提供专业帮助', '寻求反馈', '其他',
] as const
export type HackathonConnectionPurpose = (typeof HACKATHON_CONNECTION_PURPOSES)[number]

// Platform-Project connections reuse the hackathon contact-intent vocabulary:
// both surfaces answer "why do you want to reach this project team?".
export const PROJECT_CONNECTION_PURPOSES = [
  '试用产品', '合作交流', '加入项目', '提供专业帮助', '寻求反馈', '其他',
] as const
export type ProjectConnectionPurpose = (typeof PROJECT_CONNECTION_PURPOSES)[number]

// ---------------------------------------------------------------------------
// BoomLand
// ---------------------------------------------------------------------------

export const SeasonType = {
  Season: 'season',
  Hackathon: 'hackathon',
} as const
export type SeasonType = (typeof SeasonType)[keyof typeof SeasonType]

export const SeasonStatus = {
  Draft: 'draft',
  Upcoming: 'upcoming',
  Active: 'active',
  Suspended: 'suspended',
  Cancelled: 'cancelled',
} as const
export type SeasonStatus = (typeof SeasonStatus)[keyof typeof SeasonStatus]

export const SeasonApplicationStatus = {
  Submitted: 'submitted',
  Accepted: 'accepted',
  Pending: 'pending',
  Waitlisted: 'waitlisted',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
} as const
export type SeasonApplicationStatus =
  (typeof SeasonApplicationStatus)[keyof typeof SeasonApplicationStatus]

export const SeasonParticipantStatus = {
  Active: 'active',
  Withdrawn: 'withdrawn',
} as const
export type SeasonParticipantStatus =
  (typeof SeasonParticipantStatus)[keyof typeof SeasonParticipantStatus]

export const ApplicationVisibility = {
  Public: 'public',
  OrganizerOnly: 'organizer_only',
} as const
export type ApplicationVisibility =
  (typeof ApplicationVisibility)[keyof typeof ApplicationVisibility]

export const WechatStatus = {
  NotInvited: 'not_invited',
  Invited: 'invited',
  Joined: 'joined',
  Failed: 'failed',
} as const
export type WechatStatus = (typeof WechatStatus)[keyof typeof WechatStatus]

export const ChallengeStatus = {
  Draft: 'draft',
  Reference: 'reference',
  Published: 'published',
  Closed: 'closed',
  Archived: 'archived',
} as const
export type ChallengeStatus = (typeof ChallengeStatus)[keyof typeof ChallengeStatus]

/**
 * 四类命题（产品文档 CHG-002「四类命题」）。
 *
 * `type` 只描述**这条命题要验证什么**，不参与发布门槛 —— 五件套齐了才能发布，
 * 类型本身不是必填项之外的额外条件。旧数据 / 未分类的命题允许 `type` 为空。
 */
export const ChallengeType = {
  /** 商单验证型：找到客户并形成付费。 */
  CommercialValidation: 'commercial_validation',
  /** 上下游合作型：形成新的合作业态。 */
  UpstreamDownstream: 'upstream_downstream',
  /** 解决方案 / POC 型：验证技术或服务可行性。 */
  SolutionPoc: 'solution_poc',
  /** 数据 / 研究验证型：形成可信产业判断或工具。 */
  DataResearch: 'data_research',
} as const
export type ChallengeType = (typeof ChallengeType)[keyof typeof ChallengeType]

export const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  [ChallengeType.CommercialValidation]: '商单验证型',
  [ChallengeType.UpstreamDownstream]: '上下游合作型',
  [ChallengeType.SolutionPoc]: '解决方案 / POC 型',
  [ChallengeType.DataResearch]: '数据 / 研究验证型',
}

/** 类型的验证目标与典型结果（用于表单里的说明文案，见 CHG-002 表格）。 */
export const CHALLENGE_TYPE_HINTS: Record<
  ChallengeType,
  { goal: string; results: string }
> = {
  [ChallengeType.CommercialValidation]: { goal: '找到客户并形成付费', results: '订单、交付、回款、复购' },
  [ChallengeType.UpstreamDownstream]: { goal: '形成新的合作业态', results: '联合方案、试点、渠道、供应或采购合作' },
  [ChallengeType.SolutionPoc]: { goal: '验证技术或服务可行性', results: '原型、测试、客户验收、付费 POC' },
  [ChallengeType.DataResearch]: { goal: '形成可信产业判断或工具', results: '数据库、报告、模型、实验、可复用方法' },
}

/** 命题类型下拉的选项（顺序 = 产品文档里的顺序）。 */
export const CHALLENGE_TYPES: readonly ChallengeType[] = [
  ChallengeType.CommercialValidation,
  ChallengeType.UpstreamDownstream,
  ChallengeType.SolutionPoc,
  ChallengeType.DataResearch,
]

export function challengeTypeLabel(type: string | null | undefined): string {
  if (!type) return '未分类'
  return CHALLENGE_TYPE_LABELS[type as ChallengeType] ?? type
}

/**
 * 命题容量（`capacity`）：该命题下最多能有几个参赛项目。
 *
 * 表格里的「已选 / 容量」分母就是它；`null` 表示不限。上限取 999 —— 再大就该
 * 用「不限」表达，而不是写一个没人会去核对的数字。
 */
export const CHALLENGE_CAPACITY_LIMITS = { min: 1, max: 999 } as const

/**
 * 资源承诺的六个类别（产品文档 CHG-001「资源承诺表」）。
 *
 * 与命题五件套里的 `resourceCommitment` 文本不同：那是给选手看的承诺摘要，
 * 这里的 `challenge_resources` 是主办方逐条跟踪兑现状态的清单。
 */
export const ChallengeResourceKind = {
  Funding: 'funding',
  RealDemand: 'real_demand',
  Database: 'database',
  ExpertChannel: 'expert_channel',
  Partnership: 'partnership',
  ToolVenue: 'tool_venue',
} as const
export type ChallengeResourceKind =
  (typeof ChallengeResourceKind)[keyof typeof ChallengeResourceKind]

export const CHALLENGE_RESOURCE_KIND_LABELS: Record<ChallengeResourceKind, string> = {
  [ChallengeResourceKind.Funding]: '资金',
  [ChallengeResourceKind.RealDemand]: '真实需求',
  [ChallengeResourceKind.Database]: '数据库',
  [ChallengeResourceKind.ExpertChannel]: '专家渠道',
  [ChallengeResourceKind.Partnership]: '合作机会',
  [ChallengeResourceKind.ToolVenue]: '工具场地',
}

export const CHALLENGE_RESOURCE_KINDS: readonly ChallengeResourceKind[] = [
  ChallengeResourceKind.Funding,
  ChallengeResourceKind.RealDemand,
  ChallengeResourceKind.Database,
  ChallengeResourceKind.ExpertChannel,
  ChallengeResourceKind.Partnership,
  ChallengeResourceKind.ToolVenue,
]

export function challengeResourceKindLabel(kind: string): string {
  return CHALLENGE_RESOURCE_KIND_LABELS[kind as ChallengeResourceKind] ?? kind
}

/**
 * 资源兑现状态（产品文档 CHG-004「资源状态」）。
 *
 * 硬性口径：**未兑现的资源不得在公开页展示为确定权益** —— 所以只有
 * `provided` / `used` 算「已兑现」，其余状态在公开页一律按「待确认」处理。
 * 状态本身不做自动流转，由主办方逐条更新并写审计。
 */
export const ChallengeResourceStatus = {
  /** 已承诺 */
  Committed: 'committed',
  /** 可申请 */
  Applicable: 'applicable',
  /** 已提供 */
  Provided: 'provided',
  /** 已使用 */
  Used: 'used',
  /** 已耗尽 */
  Exhausted: 'exhausted',
  /** 未兑现 */
  Unfulfilled: 'unfulfilled',
} as const
export type ChallengeResourceStatus =
  (typeof ChallengeResourceStatus)[keyof typeof ChallengeResourceStatus]

export const CHALLENGE_RESOURCE_STATUS_LABELS: Record<ChallengeResourceStatus, string> = {
  [ChallengeResourceStatus.Committed]: '已承诺',
  [ChallengeResourceStatus.Applicable]: '可申请',
  [ChallengeResourceStatus.Provided]: '已提供',
  [ChallengeResourceStatus.Used]: '已使用',
  [ChallengeResourceStatus.Exhausted]: '已耗尽',
  [ChallengeResourceStatus.Unfulfilled]: '未兑现',
}

export const CHALLENGE_RESOURCE_STATUSES: readonly ChallengeResourceStatus[] = [
  ChallengeResourceStatus.Committed,
  ChallengeResourceStatus.Applicable,
  ChallengeResourceStatus.Provided,
  ChallengeResourceStatus.Used,
  ChallengeResourceStatus.Exhausted,
  ChallengeResourceStatus.Unfulfilled,
]

export function challengeResourceStatusLabel(status: string): string {
  return CHALLENGE_RESOURCE_STATUS_LABELS[status as ChallengeResourceStatus] ?? status
}

/** 「已兑现」判定：只有已提供 / 已使用算数（CHG-004）。 */
export function isChallengeResourceFulfilled(status: string): boolean {
  return status === ChallengeResourceStatus.Provided || status === ChallengeResourceStatus.Used
}

/** 未兑现 / 未确认的资源，公开页不得展示为确定权益。 */
export function isChallengeResourceUnconfirmed(status: string): boolean {
  return !isChallengeResourceFulfilled(status)
}

/** 单个命题的资源条数上限：资源兑现是一张清单，不是无限长的列表。 */
export const MAX_CHALLENGE_RESOURCES = 30

/**
 * 企业合作档位（产品文档 CHG-006「企业合作配置」）。
 *
 * 表格里的「档位」列：联合出品 / 合作 / 意向。档位只是商务口径，
 * 不影响命题的发布状态。
 */
export const EnterpriseCooperationTier = {
  /** 联合出品：出资 + 联合署名。 */
  CoCreation: 'co_creation',
  /** 合作：出资参与。 */
  Cooperation: 'cooperation',
  /** 资源合作：不出资，提供数据 / 场地 / 渠道等资源。 */
  ResourcePartner: 'resource_partner',
  /** 意向：尚未签约。 */
  Intent: 'intent',
} as const
export type EnterpriseCooperationTier =
  (typeof EnterpriseCooperationTier)[keyof typeof EnterpriseCooperationTier]

export const ENTERPRISE_COOPERATION_TIER_LABELS: Record<EnterpriseCooperationTier, string> = {
  [EnterpriseCooperationTier.CoCreation]: '联合出品',
  [EnterpriseCooperationTier.Cooperation]: '合作',
  [EnterpriseCooperationTier.ResourcePartner]: '资源合作',
  [EnterpriseCooperationTier.Intent]: '意向',
}

export const ENTERPRISE_COOPERATION_TIERS: readonly EnterpriseCooperationTier[] = [
  EnterpriseCooperationTier.CoCreation,
  EnterpriseCooperationTier.Cooperation,
  EnterpriseCooperationTier.ResourcePartner,
  EnterpriseCooperationTier.Intent,
]

/**
 * 档位的完整展示名：`档位 · 等级`（等级可空，如「资源合作」没有金银标）。
 *
 * 档位（合作形态）与等级（金银标，商务口径）分开存，展示时拼起来 ——
 * 这样「哪些是联合出品」可以按 `tier` 稳定聚合，不用解析展示字符串。
 */
export function enterpriseCooperationTierLabel(
  tier: string,
  grade?: string | null,
): string {
  const base = ENTERPRISE_COOPERATION_TIER_LABELS[tier as EnterpriseCooperationTier] ?? tier
  const trimmed = grade?.trim()
  return trimmed ? `${base}·${trimmed}` : base
}

/**
 * 企业合作配置的签约状态：`signed`（已签约）/ `intent`（洽谈中）。
 *
 * 与「档位」正交：档位说的是合作形态，状态说的是这一版配置有没有落定。
 */
export const EnterpriseCooperationStatus = {
  Signed: 'signed',
  Intent: 'intent',
} as const
export type EnterpriseCooperationStatus =
  (typeof EnterpriseCooperationStatus)[keyof typeof EnterpriseCooperationStatus]

export const ENTERPRISE_COOPERATION_STATUS_LABELS: Record<EnterpriseCooperationStatus, string> = {
  [EnterpriseCooperationStatus.Signed]: '已签约',
  [EnterpriseCooperationStatus.Intent]: '洽谈中',
}

export function enterpriseCooperationStatusLabel(status: string): string {
  return ENTERPRISE_COOPERATION_STATUS_LABELS[status as EnterpriseCooperationStatus] ?? status
}

/**
 * 公开授权范围：企业名称与命题能否公开出现。
 *
 * `public` = 可公开企业名称与命题；`anonymous` = 暂不公开（对外只显示
 * 「某企业」）。这条直接决定公开页怎么写，所以和费用分开存、分开展示。
 */
export const EnterprisePublicScope = {
  Public: 'public',
  Anonymous: 'anonymous',
} as const
export type EnterprisePublicScope = (typeof EnterprisePublicScope)[keyof typeof EnterprisePublicScope]

export const ENTERPRISE_PUBLIC_SCOPE_LABELS: Record<EnterprisePublicScope, string> = {
  [EnterprisePublicScope.Public]: '可公开企业名称与命题',
  [EnterprisePublicScope.Anonymous]: '暂不公开',
}

export function enterprisePublicScopeLabel(scope: string): string {
  return ENTERPRISE_PUBLIC_SCOPE_LABELS[scope as EnterprisePublicScope] ?? scope
}

/**
 * 企业合作配置的三项金额（单位：元）。
 *
 * 产品文档 CHG-006 第 4 条：**管理费、平台服务费与奖金池出资分别记录；
 * 管理费不进入选手奖励账本。** 所以这是三个独立字段，不做「总费用 - 管理费」
 * 这类派生计算 —— 三者口径不同，任何加减都会算错账。
 */
export const ENTERPRISE_COOPERATION_AMOUNT_LIMITS = { min: 0, max: 100_000_000 } as const

export const BudgetStatus = {
  Active: 'active',
  Superseded: 'superseded',
} as const
export type BudgetStatus = (typeof BudgetStatus)[keyof typeof BudgetStatus]

export const PointPoolStatus = {
  Active: 'active',
  Closed: 'closed',
} as const
export type PointPoolStatus = (typeof PointPoolStatus)[keyof typeof PointPoolStatus]

export const PointAllocationStatus = {
  Active: 'active',
  Reclaimed: 'reclaimed',
} as const
export type PointAllocationStatus =
  (typeof PointAllocationStatus)[keyof typeof PointAllocationStatus]

export const VerifierGrantStatus = {
  Active: 'active',
  Revoked: 'revoked',
} as const
export type VerifierGrantStatus =
  (typeof VerifierGrantStatus)[keyof typeof VerifierGrantStatus]

export const AnnouncementCategory = {
  General: 'general',
  Schedule: 'schedule',
  Rules: 'rules',
} as const
export type AnnouncementCategory =
  (typeof AnnouncementCategory)[keyof typeof AnnouncementCategory]

export interface SeasonSchedule {
  applyOpen: string
  applyClose: string
  startAt: string
  teamDeadline: string
  challengeFreezeAt: string
  workDeadline: string
  scoreDeadline: string
  settleDate: string
}

export interface SeasonRules {
  maxChallengesPerProject: number
  maxProjectsPerParticipant: number
  maxCoreMembers: number
  /**
   * 计分口径三项：`null` 或 `0` 都表示「本季不计分」。
   *
   * 不另开 `scoringEnabled` 布尔开关：主办方在「修改规则」里把这三项留空
   * 或填 0 就够了，少一个要和三项数值保持一致的字段，就少一处能对不上的状态。
   */
  singleWorkCap: number | null
  exchangeRatio: number | null
  reviewThreshold: number | null
  dailyQuotaEnabled: boolean
}

export const SEASON_RULE_DEFAULTS: SeasonRules = {
  maxChallengesPerProject: 3,
  maxProjectsPerParticipant: 1,
  maxCoreMembers: 3,
  singleWorkCap: 100,
  exchangeRatio: 1,
  reviewThreshold: 50,
  dailyQuotaEnabled: false,
}

export const SEASON_RULE_LIMITS = {
  maxChallengesPerProject: { min: 1, max: 3 },
  maxProjectsPerParticipant: { min: 1, max: 20 },
  maxCoreMembers: { min: 1, max: 3 },
  // 计分口径三项允许 0 / 留空 = 本季不计分，所以下限是 0 而不是 1。
  singleWorkCap: { min: 0, max: 1_000_000 },
  exchangeRatio: { min: 0, max: 1_000_000 },
  reviewThreshold: { min: 0, max: 1_000_000 },
} as const

/**
 * 必要规则卡条目：由赛季配置生成，主办方不能新增、删除或隐藏，也不能改名称。
 *
 * 顺序即默认展示顺序，与产品文档 6.5「SEA-05 可配置规则卡」的八项一一对应。
 * 改名是破坏性变更：历史行按 key 判定必要项，改 key 会让旧数据变成「可选条目」。
 */
export const SEASON_REQUIRED_RULE_CARD_KEYS = [
  'max_project_challenges',
  'max_projects_per_participant',
  'max_core_members',
  'single_work_cap',
  'exchange_ratio',
  'review_threshold',
  'work_and_score_deadline',
  'point_pool_and_awards',
] as const
export type SeasonRequiredRuleCardKey = (typeof SEASON_REQUIRED_RULE_CARD_KEYS)[number]

export const SEASON_REQUIRED_RULE_CARD_LABELS: Record<SeasonRequiredRuleCardKey, string> = {
  max_project_challenges: '项目命题',
  max_projects_per_participant: '每人项目数',
  max_core_members: '团队人数',
  single_work_cap: '单次评分上限',
  exchange_ratio: '兑换比例',
  review_threshold: '大额复核',
  work_and_score_deadline: '作品与评分截止',
  point_pool_and_awards: '积分池与奖励口径',
}

/** 必要规则卡条目「说明」的固定前缀：这些条目不可编辑，文案由赛季配置生成。 */
export const SEASON_RULE_CARD_LOCKED_HINT = '由赛季配置生成，不可编辑'

// ---------------------------------------------------------------------------
// 必要规则卡条目的文案生成
// ---------------------------------------------------------------------------

/**
 * 计分口径三项为空 / 0 时的统一文案。
 *
 * 「不计分」是这三项共同的口径，写成常量避免后端生成、前端预览各写一份后漂移。
 */
export const SEASON_RULE_CARD_SCORELESS = '本季不计分'

/** 计分口径三项（单次评分上限 / 兑换比例 / 大额复核）是否未配置 = 本季不计分。 */
export function isScorelessValue(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value) || value === 0
}

function scorelessOr(value: number | null | undefined, format: (value: number) => string): string {
  return isScorelessValue(value) ? SEASON_RULE_CARD_SCORELESS : format(value as number)
}

/** 规则卡里展示的截止时间；未排期时给「待定」。 */
function deadlineText(value: string | null | undefined, timeZone: string): string {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待定'
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  const hour = pick('hour')
  const minute = pick('minute')
  if (!year || !month || !day) return '待定'
  return `${year}年${month}月${day}日 ${hour}:${minute}`
}

/**
 * 按赛季配置生成一条**必要**规则卡的展示内容。
 *
 * 这是必要条目文案的唯一真相源：后端落库、主办方后台预览、公开页都走这里，
 * 所以「规则卡里写的内容」和「预览里看到的内容」不可能对不上。
 *
 * 时间一律按北京时间渲染 —— 产品口径是「作品 / 评分截止（北京时间）」。
 */
export function seasonRequiredRuleCardValue(
  key: SeasonRequiredRuleCardKey,
  input: { rules: SeasonRules; schedule: SeasonSchedule | null },
): string {
  const { rules, schedule } = input
  switch (key) {
    case 'max_project_challenges': {
      const cap = rules.maxChallengesPerProject
      return `每个项目可选择 1—${cap} 个命题（平行，无主次）；积分归项目，不按命题分账`
    }
    case 'max_projects_per_participant':
      return `每人在本赛季原则上参与 ${rules.maxProjectsPerParticipant} 个项目`
    case 'max_core_members':
      return `核心团队 1—${rules.maxCoreMembers} 人，允许单人项目；外部共建者不计入`
    case 'single_work_cap':
      return scorelessOr(rules.singleWorkCap, (value) => `单次评分最高 ${value} 分`)
    case 'exchange_ratio':
      return scorelessOr(
        rules.exchangeRatio,
        (value) => `1 积分可兑换 ${value} 元`,
      )
    case 'review_threshold':
      return scorelessOr(rules.reviewThreshold, (value) => `单次评分超过 ${value} 分需大额复核`)
    case 'work_and_score_deadline': {
      const work = deadlineText(schedule?.workDeadline, 'Asia/Shanghai')
      const score = deadlineText(schedule?.scoreDeadline, 'Asia/Shanghai')
      return `作品 ${work} 截止；评分 ${score} 截止（北京时间）`
    }
    case 'point_pool_and_awards': {
      const scoreless =
        isScorelessValue(rules.singleWorkCap)
        && isScorelessValue(rules.exchangeRatio)
        && isScorelessValue(rules.reviewThreshold)
      return scoreless ? '本季不设积分池与评委' : '积分池与奖励口径以赛季公告为准'
    }
  }
}

/**
 * 按赛季配置生成全部**必要**规则卡条目（顺序 = `SEASON_REQUIRED_RULE_CARD_KEYS`）。
 *
 * 后端在读取与写入时都用它重建必要条目：这样「必要条目由赛季配置生成、
 * 不能编辑也不能隐藏」才是真的约束，而不只是 UI 上的禁用态。
 */
export function seasonRequiredRuleCardItems(input: {
  rules: SeasonRules
  schedule: SeasonSchedule | null
}): Array<{
  key: SeasonRequiredRuleCardKey
  label: string
  value: string
  required: true
  visible: true
}> {
  return SEASON_REQUIRED_RULE_CARD_KEYS.map((key) => ({
    key,
    label: SEASON_REQUIRED_RULE_CARD_LABELS[key],
    value: seasonRequiredRuleCardValue(key, input),
    required: true as const,
    visible: true as const,
  }))
}

// ---------------------------------------------------------------------------
// 赛季项目与组队招募（个人中心「组队」tab）
// ---------------------------------------------------------------------------

/**
 * 赛季项目状态（PRD 5.3）。
 *
 * `draft` → `published` → `archived`。本批只落 `published`（发起即发布）与
 * `archived`（退出赛季/项目归档时写），`draft` 先留着给「先存后发」的编辑流。
 */
export const SeasonProjectStatus = {
  Draft: 'draft',
  Published: 'published',
  Archived: 'archived',
} as const
export type SeasonProjectStatus =
  (typeof SeasonProjectStatus)[keyof typeof SeasonProjectStatus]

/**
 * 赛季项目的形成方式（PRD LIB-003）。
 *
 * `created` = 赛季内新建；`brought_in` = 把本人已有的长期项目带入赛季。
 * 两者在赛季层的规则完全相同，只有来源标记与「项目内容是否已存在」不同。
 */
export const SeasonProjectSource = {
  Created: 'created',
  BroughtIn: 'brought_in',
} as const
export type SeasonProjectSource =
  (typeof SeasonProjectSource)[keyof typeof SeasonProjectSource]

export const SEASON_PROJECT_SOURCE_LABELS: Record<SeasonProjectSource, string> = {
  [SeasonProjectSource.Created]: '赛季内新建',
  [SeasonProjectSource.BroughtIn]: '带入已有项目',
}

export function seasonProjectSourceLabel(source: string): string {
  return SEASON_PROJECT_SOURCE_LABELS[source as SeasonProjectSource] ?? source
}

/** 赛季项目核心成员的角色与状态。本批只写 owner；邀请留给 P1。 */
export const SeasonProjectMemberRole = {
  Owner: 'owner',
  Core: 'core',
} as const
export type SeasonProjectMemberRole =
  (typeof SeasonProjectMemberRole)[keyof typeof SeasonProjectMemberRole]

export const SeasonProjectMemberStatus = {
  Invited: 'invited',
  Accepted: 'accepted',
  Removed: 'removed',
} as const
export type SeasonProjectMemberStatus =
  (typeof SeasonProjectMemberStatus)[keyof typeof SeasonProjectMemberStatus]

/** 招募卡状态（PRD 5.8）：`open` → `closed`。 */
export const RecruitmentCardStatus = {
  Open: 'open',
  Closed: 'closed',
} as const
export type RecruitmentCardStatus =
  (typeof RecruitmentCardStatus)[keyof typeof RecruitmentCardStatus]

/** 招募申请状态（PRD 5.8）：`pending` → `accepted` / `declined`。 */
export const RecruitmentApplicationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Declined: 'declined',
} as const
export type RecruitmentApplicationStatus =
  (typeof RecruitmentApplicationStatus)[keyof typeof RecruitmentApplicationStatus]

export const RECRUITMENT_APPLICATION_STATUS_LABELS: Record<
  RecruitmentApplicationStatus,
  string
> = {
  [RecruitmentApplicationStatus.Pending]: '待处理',
  [RecruitmentApplicationStatus.Accepted]: '已接受',
  [RecruitmentApplicationStatus.Declined]: '已拒绝',
}

export function recruitmentApplicationStatusLabel(status: string): string {
  return (
    RECRUITMENT_APPLICATION_STATUS_LABELS[
      status as RecruitmentApplicationStatus
    ] ?? status
  )
}

/**
 * 发起项目 / 发布招募卡的长度与数量上限。
 *
 * 与后端 TypeBox 校验、前端表单校验共用同一份 —— 两处各写一遍必然漂移，
 * 而「表单说可以、后端 422」是最难解释的一类错误。
 */
export const SEASON_PROJECT_LIMITS = {
  name: { min: 1, max: 100 },
  tagline: { max: 200 },
  /** 每个项目可选的赛季方向数（PRD：平行、无主次）。 */
  themes: { max: 5 },
  /** 角色条目：1—10 条，每条 ≤ 50 字。 */
  roles: { min: 1, max: 10, itemMax: 50 },
  /** 技能关键词：可空，≤ 10 条。 */
  skills: { max: 10, itemMax: 50 },
  description: { min: 1, max: 2000 },
} as const

/**
 * 赛季项目阶段（PRD 6.4 PRJ-02）。
 *
 * `seed → sprout → grow → bloom → fruit → boom`，**只前进不回退**；
 * `boom` 由赛季结算确认（本批只做展示，不做阶段流转接口）。
 */
export const SeasonProjectStage = {
  Seed: 'seed',
  Sprout: 'sprout',
  Grow: 'grow',
  Bloom: 'bloom',
  Fruit: 'fruit',
  Boom: 'boom',
} as const
export type SeasonProjectStage =
  (typeof SeasonProjectStage)[keyof typeof SeasonProjectStage]

/** 阶段顺序即展示顺序（也是「只前进」的比较基准）。 */
export const SEASON_PROJECT_STAGES: readonly SeasonProjectStage[] = [
  SeasonProjectStage.Seed,
  SeasonProjectStage.Sprout,
  SeasonProjectStage.Grow,
  SeasonProjectStage.Bloom,
  SeasonProjectStage.Fruit,
  SeasonProjectStage.Boom,
]

export const SEASON_PROJECT_STAGE_LABELS: Record<SeasonProjectStage, string> = {
  [SeasonProjectStage.Seed]: '种子',
  [SeasonProjectStage.Sprout]: '发芽',
  [SeasonProjectStage.Grow]: '生长',
  [SeasonProjectStage.Bloom]: '开花',
  [SeasonProjectStage.Fruit]: '结果',
  [SeasonProjectStage.Boom]: '爆炸',
}

export function seasonProjectStageLabel(stage: string | null | undefined): string {
  if (!stage) return SEASON_PROJECT_STAGE_LABELS[SeasonProjectStage.Seed]
  return SEASON_PROJECT_STAGE_LABELS[stage as SeasonProjectStage] ?? stage
}

/**
 * 阶段在生长阶梯上的序号（0 = seed）。
 *
 * 展示进度点、判断「能否推进」都用它；未知阶段返回 -1，调用方据此不画进度。
 */
export function seasonProjectStageIndex(stage: string | null | undefined): number {
  if (!stage) return -1
  return SEASON_PROJECT_STAGES.indexOf(stage as SeasonProjectStage)
}

// ---------------------------------------------------------------------------
// 命题详情页（命题卡内容 / 五维评分 / 公开与权益）
// ---------------------------------------------------------------------------

/**
 * 命题卡正文各字段的长度上限。
 *
 * 与后端 TypeBox、前端表单校验共用一份：两处各写一遍必然漂移，而
 * 「表单说可以、后端 422」是最难解释的一类错误。
 */
export const CHALLENGE_CARD_LIMITS = {
  summary: { max: 200 },
  background: { max: 4000 },
  industry: { max: 100 },
  scope: { max: 4000 },
  outOfScope: { max: 4000 },
  monthlyGoal: { max: 2000 },
  ownerName: { max: 100 },
  responseSla: { max: 100 },
  /** 建议技能：可空，≤ 10 条，单条 ≤ 30 字。 */
  suggestedSkills: { max: 10, itemMax: 30 },
  /** 团队容量（该命题下最多几个项目团队）。 */
  teamCapacity: { min: 1, max: 99 },
  /** 命题单次评分上限。 */
  singleWorkCap: { min: 1, max: 10_000 },
  /** 权益条款单条上限。 */
  rights: { max: 2000 },
} as const

/**
 * 五维评分维度（PRD CHG-02「权重与版本」）。
 *
 * 五维权重**不是发布必填项**：未配置按等权。权重变更要生成新版本，
 * 评分保存规则快照 —— 所以权重落在命题上，历史版本靠 `challenge_versions` 留痕。
 */
export const ChallengeScoringDimension = {
  /** 真实商业结果 */
  CommercialResult: 'commercial_result',
  /** 交付质量与客户价值 */
  DeliveryQuality: 'delivery_quality',
  /** 原创方法与产业洞察 */
  OriginalMethod: 'original_method',
  /** 行动、证据与有效迭代 */
  ActionEvidence: 'action_evidence',
  /** 共建、开源和复用价值 */
  ReuseValue: 'reuse_value',
} as const
export type ChallengeScoringDimension =
  (typeof ChallengeScoringDimension)[keyof typeof ChallengeScoringDimension]

export const CHALLENGE_SCORING_DIMENSIONS: readonly ChallengeScoringDimension[] = [
  ChallengeScoringDimension.CommercialResult,
  ChallengeScoringDimension.DeliveryQuality,
  ChallengeScoringDimension.OriginalMethod,
  ChallengeScoringDimension.ActionEvidence,
  ChallengeScoringDimension.ReuseValue,
]

export const CHALLENGE_SCORING_DIMENSION_LABELS: Record<ChallengeScoringDimension, string> = {
  [ChallengeScoringDimension.CommercialResult]: '真实商业结果',
  [ChallengeScoringDimension.DeliveryQuality]: '交付质量与客户价值',
  [ChallengeScoringDimension.OriginalMethod]: '原创方法与产业洞察',
  [ChallengeScoringDimension.ActionEvidence]: '行动、证据与有效迭代',
  [ChallengeScoringDimension.ReuseValue]: '共建、开源和复用价值',
}

/**
 * 五维默认权重（合计 100）。
 *
 * 与产品文档的引导权重一致；未配置权重时前端按这份展示，但**不会**写进命题行 ——
 * 「未配置」和「配置成默认值」是两种状态，落库时会丢掉这个区别。
 */
export const CHALLENGE_SCORING_DEFAULT_WEIGHTS: Record<ChallengeScoringDimension, number> = {
  [ChallengeScoringDimension.CommercialResult]: 35,
  [ChallengeScoringDimension.DeliveryQuality]: 25,
  [ChallengeScoringDimension.OriginalMethod]: 15,
  [ChallengeScoringDimension.ActionEvidence]: 15,
  [ChallengeScoringDimension.ReuseValue]: 10,
}

/** 权重合计必须等于 100（分母固定，避免出现「合计 80 的百分比」）。 */
export const CHALLENGE_SCORING_WEIGHT_TOTAL = 100

/** 单个维度的权重上限（= 合计值，允许某一维独大）。 */
export const CHALLENGE_SCORING_WEIGHT_MAX = 100

/**
 * 公开与权益的字段（顺序即展示顺序）。
 *
 * 七项分别存、分别展示：产品文档 CHG-006 的口径是「先明示再签」，任何
 * 把它们合成一段自由文本的做法都会让某一项在公开页里消失。
 */
export const CHALLENGE_RIGHTS_FIELDS = [
  'rightsPublicScope',
  'rightsConfidentiality',
  'rightsIp',
  'rightsEnterpriseUsage',
  'rightsProcurement',
  'rightsSpecialTerms',
  'rightsExclusivity',
] as const
export type ChallengeRightsField = (typeof CHALLENGE_RIGHTS_FIELDS)[number]

export const CHALLENGE_RIGHTS_FIELD_LABELS: Record<ChallengeRightsField, string> = {
  rightsPublicScope: '公开范围',
  rightsConfidentiality: '保密',
  rightsIp: '知识产权',
  rightsEnterpriseUsage: '企业使用权',
  rightsProcurement: '采购或后续合作',
  rightsSpecialTerms: '特殊条件',
  rightsExclusivity: '独家或排他',
}

/** 命题详情页的 tab（顺序即展示顺序）。 */
export const CHALLENGE_DETAIL_TABS = [
  { key: 'card', label: '命题卡' },
  { key: 'resources', label: '资源承诺' },
  { key: 'evidence', label: '结果与证据' },
  { key: 'scoring', label: '评分与奖励' },
  { key: 'rights', label: '公开与权益' },
  { key: 'report', label: '命题报告' },
] as const
export type ChallengeDetailTabKey = (typeof CHALLENGE_DETAIL_TABS)[number]['key']

/**
 * 本批**未实现**的 tab：只做待开发占位。
 *
 * 写在这里而不是散在组件里：等结果与证据 / 命题报告落地时，把 key 从这里删掉，
 * 类型检查会逼着调用方把那两个 tab 的真内容接上。
 */
export const CHALLENGE_DETAIL_PENDING_TABS: readonly ChallengeDetailTabKey[] = [
  'evidence',
  'report',
]

export function isChallengeDetailTabPending(tab: string): boolean {
  return (CHALLENGE_DETAIL_PENDING_TABS as readonly string[]).includes(tab)
}

