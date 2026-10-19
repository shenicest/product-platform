# 06 — 种子数据与规格文档收尾

**What to build:** 全新数据库一键 seed 出可演示的新结构数据（五档阶段、数据亮点、双状态技能、三种当前状态各有样本）；两份 v1 规格文档与实际契约完全一致；全量测试与构建绿。

**Blocked by:** 02 — 提交表单 v2：Web 提交/编辑体验；03 — 项目浏览面 v2；05 — 人才广场 v2

**Status:** ready-for-agent

- [ ] seed 项目数据覆盖 stage 五档、traction 三种完整度（全空/部分/全填）、seekingSkills 多样样本、三选一联系方式不同组合、视频链接形态；运行 `bun run seed` 后列表/详情/筛选立即可演示
- [ ] seed 人才档案覆盖 availability 三态、bio-only 与 links-only 两种二选一样本、双状态技能（含单边/双边分布）、多城市含「远程」
- [ ] `docs/spec-v1-backend-api.md` 同步：项目/人才端点的字段集、必填规则、联系方式隐私过滤、提案白名单、stage 五档、availability
- [ ] `docs/spec-v1-frontend.md` 同步：提交表单 6 板块、详情页新结构、筛选五档、人才编辑器 4 板块与三态墙、广场展示变化
- [ ] AGENTS.md 复核（领域文档列表与 ADR 索引已含 0012/0013，无需再动结构）
- [ ] `bun run test`（api+web）与 `bun run build` 全绿

**Implementation notes:**
- seed 即演示数据：优先「一眼能看出新结构」的样本（如 traction 指标条三态、技能双状态），数量不必多
- 规格文档以对齐现状为准，不引入新设计；发现文档与实现冲突时以 CONTEXT.md + ADR-0012/0013 为准修正文档
