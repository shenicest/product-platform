# 08 — 上线清单与灰度验收

**What to build:** 功能收尾：按 PRD 20 验收标准跑通最小闭环，完成预置数据、环境变量与灰度配置，输出验收记录。

**Blocked by:** 01–07

**Status:** todo

- [ ] 全量测试：根目录 `bun run test`（api + web）、`bun run lint`、`bun run typecheck`、`bun run build`
- [ ] 环境变量配置到部署环境（评审文档第 5 节）；确认 `NOTIFICATION_WORKER=on` 且 worker 日志可见
- [ ] 腾讯云 SES：确认现有发信地址可编程调用（发一封测试邮件验证凭据、Region、发信地址）
- [ ] 预置数据：运行 `seed-hackathon-contacts` 导入首批项目接收主体（含 `receiver_user_id` 平台账号存在性检查 + `notification_email` 归属确认）
- [ ] 灰度：仅对已配置接收主体的项目生效（未配置项目按钮不渲染，后端 409 兜底）；先内部账号走通全流程
- [ ] 验收走查（PRD 20，逐条记录结果）：
  1. 配置接收主体 → 2. 用户详情页发起申请 → 3. DB Pending + 密文 → 4. 项目方收到邮件（无申请方联系方式）→ 5. 登录 `/connections` 处理 → 6. 接受后双方解锁 → 7. 未接受时不可见 → 8. 重复操作幂等 → 9. 异常场景（隐藏/无配置/邮件失败）状态可追踪
- [ ] 邮件失败演练：临时配置错误凭据，确认重试 3 次后 `Failed` 且申请记录不受影响
- [ ] 埋点/漏斗基线确认（PRD 15 的关键事件有日志或分析出口；无埋点系统则记录到结构化日志）

**Implementation notes:**
- 本票不改业务代码；验收记录写入 `.scratch/hackathon-connections/acceptance.md`
- 隐私政策/服务条款的建联说明补充（PRD 阶段 0 最后一项）由产品跟进，本票只提醒
- 灰度期间每日检查投递失败率；`Failed` 行数 > 0 时人工排查 `last_error_code`
