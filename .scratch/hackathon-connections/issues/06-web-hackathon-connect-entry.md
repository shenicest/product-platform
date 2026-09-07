# 06 — 前端：黑客松详情页建联入口 + 申请弹窗 + 登录回流

**What to build:** `/hackathon/projects/[id]` 详情页新增"联系项目方"按钮与申请弹窗：未登录回流、表单校验、提交、状态展示（Pending/Accepted 不可重复提交）。

**Blocked by:** 03

**Status:** done

- [ ] `apps/web/src/lib/hackathon-project.ts`：目的枚举（从 `@shenicest/shared` 引入 `HACKATHON_CONNECTION_PURPOSES`）、状态文案、`validateHackathonConnectionBody`（目的必选、消息 30–500、微信/邮箱至少一项、邮箱格式）
- [ ] `apps/web/src/lib/client-api.ts` 追加：`sendHackathonConnection(projectId, body)`、`getMyHackathonConnection(projectId)`
- [ ] `apps/web/src/server/hackathon-connections.ts`：`cache()` 包装，转发 `shenicest_token` cookie 调用 `GET /hackathon/projects/:id/connections/me`；未登录返回 null（不报错）
- [ ] 详情页 `apps/web/src/app/hackathon/projects/[id]/page.tsx`：侧栏 `TRY IT OUT` 区域下渲染 `HackathonConnectButton`（Server Component 传入初始状态，保持页面为 Server Component）
- [ ] 新组件 `apps/web/src/components/hackathon-connection-dialog.tsx`（`'use client'`）：
  - 按钮态：默认可发起 / Pending（"等待项目方回应"，含查看连接记录链接）/ Accepted（"已建立连接"）/ 项目方本人或无接收主体（`NO_RECEIVER_CONFIGURED` 提交时后端兜底，前端不预判）不显示按钮
  - 未登录点击：`sessionStorage` 记 `shenicest_pending_hackathon_connect:<projectId>`，跳 `/login?returnTo=...`；登录返回后自动打开弹窗、**不自动提交**（参考 talent 的 `shenicest_pending_talent_connect` 模式）
  - 弹窗字段：目的单选、消息 textarea（30–500）、微信号、邮箱、隐私说明文案（"提交后你的联系方式不会出现在通知邮件中；项目方接受后双方联系方式才会解锁"）
  - 提交中禁用按钮；成功后关闭弹窗 + 显示 Pending 态 + `router.refresh()`
- [ ] 测试（Vitest + RTL + MSW）：
  - 表单校验各分支（目的缺失、消息过短、联系方式全空）
  - 未登录 → sessionStorage 写入 + 跳转携带 returnTo；回流后弹窗自动打开不自动提交
  - 提交成功调用 API 并进入 Pending 展示；发送中按钮禁用
  - 初始状态 Pending/Accepted 时不渲染提交按钮

**Implementation notes:**
- 详情页已有 `PublicInteractionBoundary` 包裹；建联状态走独立 server 函数，不把公开项目详情个性化（评审 12.1 原则）
- 页面当前有并行未提交改动的可能（`hackathon-project-editor` 等组件稳定），改动集中在侧栏 aside 区域
- 目的/状态枚举一律从 `@shenicest/shared` 引入，禁止硬编码（AGENTS.md 前端规范）
