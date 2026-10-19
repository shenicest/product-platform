# 05 — 人才广场 v2：展示面

**What to build:** 访客与用户在人才广场看到与新档案结构一致的展示：列表不再有方向筛选；卡片与详情可见「当前状态」徽章、作品链接、双状态技能的分态呈现；任何页面不再出现 roles/方向数据。

**Blocked by:** 04 — 人才档案 v2：契约与编辑器（双状态技能墙）

**Status:** DONE. 列表页无方向筛选（parseTalentParams 加了 role 参数回归测试，占位文案去掉「方向」「」；分页上限改用 TALENT_PAGE_SIZE）；ProfileCard/TalentDetail/运营详情展示 availability 徽章（三态分色 chip-availability）与我能提供/我想寻找分态技能墙（orderSkillsByGroup 按技能墙组序），不再渲染 roles；创始人公开页路由不存在（唯一其它引用是 connections-panel，仅布尔信号，无需适配）；matching 理由文案不引用方向且未改动；CONNECTION_PURPOSES 未动。web 266/266、api 366/366 全绿。

- [x] 人才广场列表页移除方向（role）下拉筛选；URL 参数解析同步移除；技能文本搜索、合作方式筛选、排序、分页不退化
- [x] TalentProfile 卡片与个人详情页：展示 availability 徽章（积极寻找合作/开放聊聊/仅接受一次咨询）；links 以链接列表展示；「我能提供」与「我想寻找」技能分区/分色呈现；不再渲染 roles
- [x] 创始人公开页等其它引用 TalentProfile 的视野同步适配（无 roles 依赖）
- [x] 匹配评分与理由回归验证（基于 skills/seekingSkills 的逻辑不变，理由文案不引用方向）
- [x] 连接对话框、连接管理页不受影响（CONNECTION_PURPOSES 文案不变）
- [x] 相关 web 测试（talent list/detail 组件、parseTalentParams、server/talent）更新全绿

**Implementation notes:**
- availability 徽章建议色彩区分三态，且对非登录访客同样可见（它是公开筛选信号，服务「减少无效沟通」）
- 详情页 skills/seekingSkills 的展示顺序建议：提供在前，寻找在后；均按技能分组排序展示
- 本票不含 API 变更；若发现遗漏的 roles 引用，按「方向已删除」原则改为推导或移除，不顺手复活字段
