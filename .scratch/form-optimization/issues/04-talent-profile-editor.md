# 04 — 人才档案 v2：契约与编辑器（双状态技能墙）

**What to build:** 用户在 `/talents/me/edit` 用 4 个板块完成档案：一句话介绍/城市；关于我（句式模板）或作品链接（二选一）；一面三态技能墙（我能提供/我想寻找）；关注领域/合作方式/当前状态。同一套技能标签在页面上只渲染一次；方向不再被提问。发布、编辑、暂停后恢复全流程可用。

**Blocked by:** 01 — 项目表单 v2：数据契约与后端（迁移序列与 shared 基线需线性落地，非逻辑依赖）

**Status:** ready-for-agent

- [ ] shared 新增 `TalentAvailability = { ActivelySeeking: 0, OpenToChat: 1, ConsultOnly: 2 }` 及类型；`TALENT_SKILL_GROUPS` 以结构化词汇（组名→技能数组）迁入 shared，`TALENT_SKILLS` 仍是唯一标签真相源
- [ ] talent_profiles schema：删除 `roles`；`bio` 改可空；新增 `links`（json 字符串数组）、`availability`（tinyint）；生成迁移（整库重置策略）
- [ ] API 校验（TalentProfileBody）：headline 4-50 字符；bio 30-500 与 links（≤3 个 URL）二选一必填（至少其一）；skills 3-10、seekingSkills 0-5 且同一标签不得双边出现；domains 1-3、durations 1-3、availability 必填枚举；roles 字段从请求/响应/服务中移除；数组长度规则随本次下沉到后端（原先仅前端有）
- [ ] 列表查询移除 role 参数（API 端）
- [ ] 编辑器重构为 4 板块：① headline*(4-50)/city ② bio（提供 2-3 个句式模板作占位提示）与 links（0-3 个 URL 输入）同屏，提交前至少填一 ③ 技能墙单面渲染，标签三态循环（未选→我能提供→我想寻找→未选），两种选中态视觉可区分，提供 3-10 / 寻找 0-5 ④ domains*、durations*、availability* 单选（积极寻找合作/开放聊聊/仅接受一次咨询）
- [ ] 侧栏必填计数器重构为 6 项：headline、bio/links、skills、domains、durations、availability（锚点导航同步 4 板块）
- [ ] 发布/编辑/Paused 恢复、Suspended 终态页、localStorage 草稿、引导卡均不退化
- [ ] web 端 `CONNECTION_PURPOSES` 本地重复定义删除，统一从 shared 导入
- [ ] api 与 web 的 talent 相关测试（含 talent-editor、talent lib、client-api）更新全绿

**Implementation notes:**
- 决策依据：CONTEXT.md（TalentProfile fields/TalentAvailability）、ADR-0013
- 技能墙的「三态互斥」即：标签在 skills 与 seekingSkills 中至多出现一次；组件状态直接映射这两个数组，提交体结构不变
- `TALENT_SKILL_GROUPS` 迁入 shared 后，旧的前端硬编码 slice 分组删除；分组展示与「方向由技能推导」展示共用一份结构
- bio 句式模板只做 placeholder/hint 级提示（如「我做了 X 年 Y，擅长 Z，最近在探索 W」），不写存储结构
