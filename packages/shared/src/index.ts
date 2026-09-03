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
  MVP: 0,
  Growth: 1,
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

export const ConnectionRequestStatus = {
  Pending: 0,
  Accepted: 1,
  Ignored: 2,
  Cancelled: 3,
} as const
export type ConnectionRequestStatus = (typeof ConnectionRequestStatus)[keyof typeof ConnectionRequestStatus]

export const TALENT_SKILLS = [
  '产品策略', '需求分析', '用户研究', '产品设计', '原型设计', '项目管理',
  'UI 设计', 'UX 设计', '交互设计', '视觉设计', '品牌设计', '动效设计',
  '前端开发', '后端开发', '全栈开发', '移动端开发', 'AI 开发', '数据开发', 'DevOps', '硬件开发',
  '增长策略', '内容策划', '内容创作', '社交媒体', 'SEO', '品牌传播',
  '用户运营', '社区运营', '活动运营', '商业运营', '客户成功',
  '数据分析', '数据可视化', '实验设计', '商业分析', '商业策略', '融资', '法务', '财务', '行业研究',
] as const
export type TalentSkill = (typeof TALENT_SKILLS)[number]

export const TALENT_ROLES = ['产品', '设计', '开发', '增长/内容', '运营', '数据', '其他'] as const
export type TalentRole = (typeof TALENT_ROLES)[number]

export const COLLABORATION_DURATIONS = ['一次咨询', '短期项目', '长期合作'] as const
export type CollaborationDuration = (typeof COLLABORATION_DURATIONS)[number]

export const CONNECTION_PURPOSES = ['共同创业', '加入项目', '短期协作', '专业咨询', '认识交流', '其他'] as const
export type ConnectionPurpose = (typeof CONNECTION_PURPOSES)[number]
