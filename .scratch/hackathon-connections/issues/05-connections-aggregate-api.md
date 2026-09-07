# 05 — `GET /connections` 统一聚合接口

**What to build:** 新增 `connections` 模块，`GET /connections` 返回 Talent + Hackathon 两来源的统一连接 DTO（含来源、目标、状态、双方身份、必要时联系方式），支持 `source` / `direction` 过滤与 `pendingReceived` 汇总。Talent 既有端点不动。

**Blocked by:** 03（hackathon 侧 list 函数；04 可并行）

**Status:** done

- [ ] `apps/api/src/modules/connections/`（无前缀 Elysia 实例，`app.ts` 追加注册）
- [ ] 统一 DTO：
  ```
  {
    id, source: 'talent' | 'hackathon', status,
    senderUserId, receiverUserId,
    sender: { userId, nickname, avatarUrl, hasPublishedTalentProfile },
    receiver: { userId, nickname, avatarUrl, hasPublishedTalentProfile },
    target: { type: 'talent_user' | 'hackathon_project', projectId?, eventId?, name?, url? },
    purpose, message, createdAt, acceptedAt?, handledAt?,
    contacts?: { mine, other }   // 仅 Accepted 且访问者为双方之一
  }
  ```
- [ ] Talent 部分：委托 `TalentService.connections(userId)`，映射时裁剪 `talentProfile` 重负载字段；`target.type = 'talent_user'`（对方 userId）
- [ ] Hackathon 部分：`HackathonConnectionService.listForUser(userId)` 输出同形状 DTO；`target` 填项目 id/eventId/name/url（项目摘要走 D5 缝隙的 `getProjectSummary`，项目不可用时 `unavailable: true`，参照 Talent 对 delisted 项目的处理）
- [ ] 合并排序：Pending（本人为接收方）优先，其次 `createdAt desc`
- [ ] 过滤：`source=all|talent|hackathon`、`direction=all|sent|received`
- [ ] `pendingReceived` = 两源 Pending（接收方视角）之和；保持与 `GET /talents/connections` 数字一致性
- [ ] 鉴权 `auth: true`；响应不含任何密文
- [ ] 测试（`test/modules/connections/` 或 `test/app/`）：两源合并与排序；direction/source 过滤；contacts 仅 Accepted+双方；pendingReceived 正确；无任何联系方式明文/密文；Talent 端点回归不受影响

**Implementation notes:**
- 聚合层只做只读组合与裁剪，不复制状态机逻辑；hackathon 联系方式解密复用 `HackathonConnectionService` 内部方法
- Talent 部分沿袭 `connectionView` 的逐行查询（N+1），P0 量级可接受（评审文档风险表）；统一 DTO 比 `/talents/connections` 更瘦（无 talentProfile 挂载）
- 项目 URL 由前端按 `/hackathon/projects/:id` 拼接或后端给 `url`——定案后端给 `url`，避免前端拼两处
- `connection-nav.tsx` 的数据源切换在 07 完成，本票只保证 `pendingReceived` 语义
