# 01 — 项目表单 v2：数据契约与后端

> **Status: DONE.** Schema rebuilt per ADR-0012 (migration 0023 drop-old + 0024 add-new, run together = full reset on fresh DB; validated by empty-DB test setup); shared ProjectStage 5-tier; seed rewritten; model/service/proposal/operator/founder aligned; contact-privacy wired (public list always strips, detail strips without owner/operator view); validation teardown (length rules + email/phone regex deleted, at-least-one contact, http(s) URL checks kept); api tests 359/359, web lint/build/tests green (tsc clean both sides). Web pages intentionally degraded to compile-only.


**What to build:** 仅靠 API 即可用新结构走完「创建草稿 → 编辑 → 提交审核」全流程。projects 表按 ADR-0012 重构为新内容模型（破坏性，整库重置）；ProjectStage 5 档全库切换；提交校验新规则；联系方式改为隐私字段；提案白名单换新。本票纯后端与共享包，不含任何 Web 页面改版（旧表单页面允许暂时退化，03/02 票接管）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `@shenicest/shared` 的 `ProjectStage` 改为 5 档 `{ Idea: 0, Prototype: 1, Mvp: 2, Launched: 3, Revenue: 4 }`；所有引用点对齐新枚举（api model/service/seed、operator 模块、web filter/表单/徽章/测试），编译全绿
- [ ] projects 表 schema：删除 `description`、`messageToUsers`；`targetUsers`+`userProblem` 合并为 `problemStatement`（text 可空）；`progress`/`nextSteps` 保持 text 可空；新增 `differentiation`、`businessModel`、`userCount`、`monthlyRevenue`、`retentionRate`（三选填整数）、`seekingSkills`（json）；`demoVideoUrl` 语义改为 http(s) 链接（列不变）
- [ ] 生成 drizzle 迁移并验证空库可建（整库重置策略，不写数据搬迁）
- [ ] 提交校验（submit 端点）：必填为 name、tagline、categories、stage、problemStatement、nextSteps、coverUrl、contactName；contactPhone/contactEmail/contactWechat 至少其一非空；Beta 勾选时 betaDescription 必填（不变）；422 仍返回 field 级错误
- [ ] 联系方式隐私：公开列表/详情响应中非 owner、非 Operator 请求不返回 contactPhone/contactEmail/contactWechat/contactName；本人与 Operator 视野完整
- [ ] 提案白名单改为 `problemStatement`、`nextSteps`、`demoLink`、`betaDescription`；提案模块及测试同步
- [ ] `seed.ts` 项目部分按新结构重写（stage 使用新 5 档）
- [ ] `test/fixtures/project.ts` 的 `validProjectBody` 更新；`bun run test:api` 与 typecheck 全绿

**Implementation notes:**
- 决策依据：CONTEXT.md（ProblemStatement/Traction/Project contact info/Project Stage）、ADR-0012
- 长度约束维持现状分层：长度校验在前端，后端只做必填/至少一个/枚举校验
- project `model.ts` 内重复定义的 `ProjectStage` 常量与 shared 对齐（遵循 AGENTS「领域枚举一律从 shared 引入」）
- `EDITABLE_PROJECT_FIELDS` 按新列集更新；`SUBMISSION_REQUIRED_FIELDS` 按上述清单更新
