# 07 — 前端：统一连接记录页 + 处理动作 + 未读徽标

**What to build:** `/connections` 页面切换到 `GET /connections` 聚合数据源，支持来源切换与黑客松卡片的接受/忽略/联系方式展示；`connection-nav` 与用户菜单徽标改用聚合 `pendingReceived`。

**Blocked by:** 04、05

**Status:** done

- [ ] `apps/web/src/lib/connections.ts`：统一 `ConnectionItem` 类型（对齐 05 DTO）、来源/状态标签、`connectionStatusLabel` 兼容黑客松（sent 视角 Ignored → "暂未建立连接"）
- [ ] `client-api.ts`：`getConnections(query?)` 改调 `/connections`；`acceptHackathonConnection(id, body)` / `ignoreHackathonConnection(id)` / `getHackathonContacts(id)`；Talent 原函数保留（其他页面可能引用）
- [ ] 连接记录页 `apps/web/src/app/connections/page.tsx`：改用聚合数据（Server 端 `cache()` 包装 + cookie 转发）
- [ ] 面板组件：优先扩展 `talent-ui.tsx` 的 `ConnectionsPanel` 或拆出 `components/connections/connections-panel.tsx`
  - 视图切换：收到的 / 发出的 + 来源筛选（全部 / 人才 / 黑客松）
  - 黑客松卡片：来源标签"黑客松项目"、项目名（`target.url` 链接）、对方身份、目的、消息、时间、状态
  - 接受动作：复用联系方式授权弹窗模式，调黑客松 accept 接口；接受后展示 `mine` / `other` 联系方式 + 复制按钮
  - 忽略动作：调黑客松 ignore；发送方视角 Ignored 显示"暂未建立连接"
  - Pending / Ignored / Cancelled 不渲染任何联系方式
- [ ] `components/talent/connection-nav.tsx` 与 `components/user-menu.tsx`：徽标数据源切到聚合接口（`talent-connections-refresh` 事件机制保留或统一改名）
- [ ] 测试（Vitest + RTL + MSW）：
  - 聚合数据渲染：来源标签、项目链接、排序（Pending 优先）
  - 接受流程：填联系方式 → accept → 双方联系方式渲染 + 复制
  - 忽略流程与发送方文案
  - Pending/Ignored 卡片断言不出现联系方式
  - 徽标 `pendingReceived` 正确、0 时不显示

**Implementation notes:**
- `getConnections` 签名变化是破坏性改动：全仓搜索引用点（`connection-nav`、`user-menu`、`connections/page`、`talent-ui`）一次改齐
- 联系方式只存在于组件内存 state，不写 URL / localStorage / 埋点（PRD 8.2）
- 邮件回流：`/connections?request=<id>` 仅定位滚动/高亮对应卡片，不做权限判断（服务端鉴权兜底，PRD 12.3）
