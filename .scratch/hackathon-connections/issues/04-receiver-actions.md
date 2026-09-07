# 04 — 接受 / 忽略 / 联系方式解锁

**What to build:** 项目方处理侧三个端点：`POST /connections/hackathon/:id/accept`（接受并授权自己的联系方式）、`POST /connections/hackathon/:id/ignore`、`GET /connections/hackathon/:id/contacts`（Accepted 双方读取）。幂等、事务、资源级鉴权。

**Blocked by:** 03

**Status:** done

- [ ] accept（单事务）：
  - 行锁读取申请（`FOR UPDATE`）；当前用户必须是创建时锁定的 `receiver_user_id`（否则 404 `REQUEST_NOT_FOUND`，不泄露存在性给非接收人）
  - 已 Accepted → 幂等返回当前记录，**不覆盖**原授权联系方式
  - 非 Pending → 409 `REQUEST_NOT_PENDING`
  - 项目已隐藏 → 先置 Cancelled 再返回 409
  - 联系方式校验/规范化/加密同 03；至少一项（400 `INVALID_CONTACT`）
  - 写 `receiver_contact` 密文 + `status=Accepted` + `accepted_at` + `handled_at`；`pair_key` 置 NULL
- [ ] ignore：仅锁定接收人；Pending → Ignored + `handled_at`；重复调用幂等；`pair_key` 置 NULL
- [ ] contacts：记录存在 + status=Accepted + 当前用户是 sender 或 receiver（否则 403 `CONTACTS_FORBIDDEN`）；返回 `{ mine: { wechat, email }, other: { wechat, email } }`，`decryptContact` 解密
- [ ] Pending / Ignored / Cancelled 状态下任何接口不返回联系方式
- [ ] 测试：
  - 非接收人 accept/ignore → 404；接收人成功
  - 幂等：重复 accept 返回原记录且联系方式不变；重复 ignore 幂等；Accepted 后 ignore → 409
  - 忽略后申请方可重新申请（与 03 冷却规则联动）
  - contacts：双方 200、第三方 403、Pending/Ignored/Cancelled 403/409、明文不出现在响应与 DB
  - 隐藏项目：accept 触发取消并 409
  - 事务一致性：accept 后 `receiver_contact`、状态、时间戳同时正确

**Implementation notes:**
- 错误处理风格复用 `TalentService.accept/ignore/contacts` 的结构（行锁 + 状态机 + TalentError 式领域错误），但实现独立，不改 talent 模块
- `mine` / `other` 结构避免前端按方向判断（与 Talent 一致）
- accept/ignore 成功响应返回统一 DTO（同 05 的形状，`contacts` 字段仅 accept 后返回），供前端就地更新
- 无结果通知邮件（产品确认第 6 条），处理动作不写投递任务
