# 12 — Operator module 自包含审核逻辑

**What to build:** 将 8 个审核状态转换方法从 ProjectService 移到 OperatorService，使 operator module 不再依赖 projectService。这是为未来将 operator 拆为独立系统做准备。API 行为零变化。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] OperatorService 新增 8 个转换方法（approveProject, requireProjectRevision, rejectProject, delistProject, restoreProject, approveProposal, rejectProposal, requireProposalRevision）+ 辅助查询（getProject, getProposal），实现从 ProjectService 原样搬入
- [ ] operator/index.ts 删除对 projectService 的 import，所有审核路由改调 operatorService；GET /operator/projects/:id/proposals 的 404 检查改用 operatorService.getProject
- [ ] ProjectService 删除 8 个转换方法（18 → 11 methods），保留 founder 写操作 + 公开查询
- [ ] 新建 test/modules/operator/service.test.ts：覆盖 operator 转换的 valid/invalid transitions、proposal approve/reject/require-revision、diff application、audit records
- [ ] test/modules/project/service.test.ts：删除已迁移的测试，createLive helper 改用 OperatorService
- [ ] test/modules/operator/index.test.ts：setup 中 approve 产生 Live 项目改用 OperatorService
- [ ] `bun run build` 类型检查通过
- [ ] `bun test` 全部测试通过
- [ ] `grep -r "projectService\|from.*\.\./project'" src/modules/operator/` 返回空（operator 不再依赖 project service）
