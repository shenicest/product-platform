# 03 — 项目浏览面 v2：详情/列表/运营协同

**What to build:** 访客、创始人、运营在全站看到一致的新项目结构：详情页用新字段讲故事（问题陈述、下一步计划、数据指标条、差异化、商业模式、寻找的技能），不再出现已删除字段；非 owner 看不到任何联系方式；列表与运营筛选支持 5 档阶段。

**Blocked by:** 01 — 项目表单 v2：数据契约与后端（可与 02 并行）

**Status:** DONE. 详情页新字段故事（问题陈述/进展/下一步/差异化/商业模式/指标条/技巧墙/Beta/视频链接）与 owner/Operator 联系方式区块（按 API 出场渲染）完成；运营审核详情补 traction 指标条；五档徽章/筛选/hasActiveFilters 由 01 票已落地，本票回归验证无回归。traction 派生抽入 `lib/traction.ts` 共享。web 252/252、api 363/363、两端 typecheck、lint、build 全绿。

- [ ] 项目详情页：渲染 problemStatement / nextSteps / traction 指标条（仅显示非空项）/ differentiation / businessModel / seekingSkills / 视频链接 / Beta 说明；移除 description、messageToUsers、联系方式区块（owner 视野除外——本人可见自己的联系信息区）
- [ ] 阶段徽章与筛选标签五档文案：想法验证 / 原型 / MVP / 已上线有用户 / 有收入；项目卡片 stage badge 同步
- [ ] 列表页筛选栏 stage 选项扩为 5 档；URL 参数解析与 hasActiveFilters 同步
- [ ] 运营后台：项目审核详情展示新字段全集（含联系方式——Operator 视野）；运营筛选 stage 五档；审核动作流程不变
- [ ] 创始人后台（草稿列表/项目列表）在新字段结构下展示一致
- [ ] 相关 web 测试（project-filters / operator-filters / badges / 详情组件 / 运营详情组件）更新全绿

**Implementation notes:**
- traction 指标条建议纯展示：用户数 userCount、月收入 monthlyRevenue（¥/月）、30 日留存率 retentionRate（%）；三项全空则整个指标条不渲染
- 详情页「联系方式」区块对非 owner/Operator 一律不渲染；API 侧已由 01 票过滤，前端不依赖字段存在性
- Server Component 数据获取（`src/server/projects.ts`）无需大改，仅在组件层适配字段
