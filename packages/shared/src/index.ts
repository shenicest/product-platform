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
