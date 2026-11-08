# BoomLand Context

BoomLand 是赛季制的共创平台：企业或组织发布真实命题，用户报名成为选手，主办方在开赛前配置赛程、规则、命题、预算与积分池，开赛后选手组队交付作品，评委分配积分，最终按积分兑换奖励。

本文件只定义 **BoomLand** 的领域语言。平台级的 User、Product Showcase 的 Founder/Project 不在此重复；参见 [CONTEXT-MAP.md](../../CONTEXT-MAP.md)。

## Language

### 平台与主办方

**Platform Admin（平台管理员）**：
复用现有 `operator` 身份的用户，可以管理所有赛季、审核赛季发布、置顶赛季、管理主办方组织与成员。
_Avoid_：`platform_admin` 角色、超级管理员、运营。

**Organizer Org（主办方组织）**：
一个可以主办赛季的实体，拥有名称与成员列表。一个组织可以主办多个赛季。
_Avoid_：企业账号、租户、主办方用户。

**Organizer（主办方成员）**：
属于某个 Organizer Org 的用户。只有在某赛季被关联到该组织后，才获得该赛季的编辑权限。
_Avoid_：主办方角色（不是全局角色）、赛季管理员（易与 Platform Admin 混淆）。

**Season Organizer（赛季主办方）**：
`Season` 与 `Organizer Org` 的关联。一个赛季可有多个 Organizer Org；其成员共同拥有该赛季的编辑权限，不区分负责人。
_Avoid_：赛季负责人、主主办方。

### 赛季

**Season（赛季）**：
一次有明确赛程、主题、规则与参与者的活动。`type` 为 `season`（常规赛季）或 `hackathon`（黑客松）。
_Avoid_：活动、比赛、项目。

**Season Code（赛季编号）**：
全局唯一、1–32 字符、创建后不可修改的标识，用于对外引用。
_Avoid_：slug、ID。

**Season Status（赛季状态）**：
`draft` → `upcoming` → `active` 的主线，旁路 `suspended`（可恢复）与 `cancelled`（仅开赛前）。本批次不实现 `settling` / `ended` / `archived`。
_Avoid_：已结束、结算中（不在本批范围）。

**Pending Approval（待批）**：
`upcoming` 且 `approvedAt` 为空的状态。主办方提交后进入；Platform Admin 批准后仍是 `upcoming`，但 `approvedAt` 非空。
_Avoid_：把 pending 做成独立 status；它由 `upcoming + approvedAt` 表达。

**Approval（发布审核）**：
Platform Admin 对待批赛季的批准或驳回。批准写入 `approvedAt` / `approvedBy`；驳回写回 `draft` 并记录原因。
_Avoid_：上架、发布（发布 readiness 是另一概念）。

**Season Schedule（赛程）**：
八个时间点全部必填：`applyOpen` < `applyClose` < `startAt` < `teamDeadline` < `scoreDeadline` < `settleDate` 严格递增，且 `workDeadline <= scoreDeadline`、`challengeFreezeAt <= teamDeadline`。
_Avoid_：时间表、日程。

**Season Theme（赛季主题）**：
赛季对外展示的方向列表，存储在 `seasons.themes`（JSON 字符串数组）。报名者从中选择自己的方向。
_Avoid_：赛道（本批次不引入独立赛道实体）、分类。

**Season Rules（赛季规则）**：
类型化配置：每个项目最多命题数、每人最多项目数、团队核心人数上限、单次评分上限、积分兑换比例、复核阈值、每日限额开关。
_Avoid_：规则卡（规则卡是展示层）、条款。

**Rule Card（规则卡）**：
赛季公开页展示的规则条目列表，纯文本 `label + value`。部分条目为必要项，必须存在且不可隐藏；可选条目可增删排序。
_Avoid_：Season Rules（规则卡不是类型化配置）。

**Rule Card Item（规则卡条目）**：
规则卡中的一行。`key` 在赛季内唯一，`required` / `visible` / `sortOrder` 控制强制性与展示。
_Avoid_：规则字段。

**Rules Version（规则版本）**：
整数，赛季创建时为 1。赛程或规则变更时 +1，用于告知报名者规则已变化。
_Avoid_：内容版本、乐观锁版本。

**Pinned Season（置顶赛季）**：
全平台唯一置顶的赛季。只有已批准且未取消的赛季可置顶，只有 Platform Admin 可操作。
_Avoid_：推荐、精选（可以并存但不属于本概念）。

**Season Announcement（赛季公告）**：
面向报名者的赛程/规则/一般通知。赛程与规则变更可附带自定义公告；缺省时生成自动摘要。
_Avoid_：通知（通知红点不在本批范围）、消息。

**Season Suspension（赛季暂停）**：
`upcoming` 或 `active` 赛季的临时旁路状态，记录暂停前状态；恢复后回到该状态。
_Avoid_：下线、冻结（冻结命题是另一概念且不在本批）。

**Season Cancellation（赛季取消）**：
仅允许在开赛前（`draft` / `upcoming`）执行，写入原因并关闭积分池。开赛后取消不在本批范围。
_Avoid_：删除、归档。

**Season Clone（赛季复制）**：
复制赛季配置（名称/编号重填、赛程清空、回到 `draft`），不复制报名、选手、预算、积分池分配、命题。
_Avoid_：模板、分支。

**Awarding Entity（授奖主体）**：
赛季奖励的授予方名称，发布门槛之一。
_Avoid_：主办方（授奖主体可以与主办方不同）、赞助商。

### 报名与选手

**Season Application（赛季报名）**：
登录用户对某赛季提交的报名记录。一个用户在一个赛季最多一条。
_Avoid_：申请、注册、报名表。

**Application Status（报名状态）**：
`submitted` / `accepted` / `pending` / `waitlisted` / `rejected` / `withdrawn`。非 `accepted` 之间可自由流转；`accepted` 为终态。审核前（`submitted`）本人可撤回为 `withdrawn`，窗口内可重新报名。
_Avoid_：通过/拒绝（是操作，不是状态名）。

**Application Review（报名审核）**：
主办方或 Platform Admin 修改报名状态的动作，必须审计。拒绝时必须填写原因。
_Avoid_：审批流（没有多级审批）。

**Application Visibility（报名可见性）**：
`public`（可对外展示报名者）或 `organizer_only`（仅主办方/管理员可见）。联系方式永远仅本人、主办方与管理员可见。
_Avoid_：公开联系方式。

**Season Participant（赛季选手）**：
报名被接受后创建的赛季级身份。`(seasonId, userId)` 唯一。选手在组队截止前可自行退出（二次确认）；截止后由主办方/管理员处理。退出只改变选手状态，不删除作品、积分与 Track Record。
_Avoid_：用户（选手是赛季范围的）、成员、报名者（报名者尚未成为选手）。

**Participant Capacity（选手名额）**：
赛季可选的选手上限。名额已满时，组队截止前的接受操作进入 `waitlisted`；截止后接受返回 `CAPACITY_FULL`。空值表示不限。
_Avoid_：报名上限、团队人数上限（是另一规则）。

**WeChat Status（微信状态）**：
选手的微信群邀请状态：`not_invited` → `invited` → `joined`；`invited` → `failed`；`failed` → `invited`。`joined` 为终态。由主办方/管理员操作并审计。
_Avoid_：入群、好友状态。

**Season Badge（赛季徽章）**：
选手在公开页的赛季身份标识。本批次不提供公开选手目录，仅保留数据模型。
_Avoid_：成就、等级。

### 开赛前配置

**Challenge（命题）**：
企业提出的真实问题，包含五件套：真实问题、目标客户、最小交付物、资源承诺、结果证据规则。一个赛季至少一条已发布命题才能发布。
_Avoid_：题目、项目（项目是参赛作品，不在本批）。

**Five-piece（命题五件套）**：
发布命题前必须全部填写的五个字段：`realProblem` / `targetCustomer` / `minimumDeliverable` / `resourceCommitment` / `resultEvidenceRules`。
_Avoid_：必填项（易混淆）、命题详情。

**Challenge Card（命题卡）**：
命题详情页「命题卡」tab 展示的正文：背景、真实问题、目标客户 / 产业对象、范围、不做什么、
一个月最小成果、建议技能、团队容量、负责人、响应时限。
_Avoid_：命题详情（详情页是页面，命题卡是其中的内容段）、命题介绍。

**Challenge Detail Page（命题详情页）**：
公开页 `/challenges/<命题 id>`。Header + 六个 tab（命题卡 / 资源承诺 / 结果与证据 /
评分与奖励 / 公开与权益 / 命题报告）+ 右栏（入座、选择本命题的项目、版本记录）。
_Avoid_：命题页、题目页。

**Challenge Version Record（命题版本记录）**：
命题版本号变化时留下的一行「第几版、谁、为什么改、什么时候」。**不是快照** ——
正文只有 `challenges` 里那一份，历史内容查 Audit Log。
_Avoid_：版本快照、历史版本（会让人以为能回滚）。

**Challenge Follow（命题关注）**：
用户对某条命题的关注关系。与 Follow（关注 Founder）无关，挂在命题上。
_Avoid_：收藏、订阅。

**Scoring Weight（五维评分权重）**：
命题上可选的五个维度权重（真实商业结果 / 交付质量与客户价值 / 原创方法与产业洞察 /
行动、证据与有效迭代 / 共建、开源和复用价值），合计 100。**非发布必填**，未配置按等权。
_Avoid_：评分规则（规则是赛季级配置）、评分标准。

**Challenge Rights（公开与权益）**：
命题详情页「公开与权益」tab 的七项条款：公开范围、保密、知识产权、企业使用权、
采购或后续合作、特殊条件、独家或排他。七项**分别记录、分别展示**。
_Avoid_：权益条款包（合成一段文本会让某一项消失）、合同。

**Challenge Status（命题状态）**：
`draft` / `reference` / `published` / `closed` / `archived`。发布后编辑会使 `version` +1，不做版本快照。
_Avoid_：上线/下线（用 publish/close）。

**Budget（赛季预算）**：
按版本管理的奖励预算。每次追加生成新版本，旧版本标记 `superseded`；只保留一个 `active` 版本。发布门槛要求 active 预算 > 0。
_Avoid_：积分池（预算是钱，积分池是积分）。

**Point Pool（积分池）**：
赛季可分配积分总量、已分配量、已使用量。发布门槛要求总量 > 0。
_Avoid_：预算、奖池。

**Point Allocation（评委积分分配）**：
从积分池分配给某位评委的积分额度。同一赛季同一评委只有一条记录，可回收后重新分配。发布门槛要求至少一条 active 分配。
_Avoid_：评分、结算。

**Scorer Grant（评委授权）**：
通过 Point Allocation 体现的评委资格；本批不单独建表。
_Avoid_：评委角色（不是全局角色）。

**Verifier Grant（核验员授权）**：
授予某用户在本赛季核验结果的资格。可撤销；发布门槛要求至少一条 active 授权。
_Avoid_：审核员、管理员。

**Publish Readiness（发布就绪）**：
九项硬性检查的集合。主办方提交与管理员批准都必须全部通过；任何一项失败都不能进入待批/批准。
_Avoid_：健康检查、预检（可以，但 readiness 是领域术语）。

### 审计

**Audit Log（审计日志）**：
BoomLand 的通用操作记录：操作者、动作、目标类型/ID、关联赛季、变更详情、时间。与 Product Showcase 的 `audit_records` 无关。
_Avoid_：操作日志（可以，但统一用 audit log）、历史记录。

## Example dialogue

> **Platform Admin**：这个赛季可以批准吗？
> **主办方**：赛程和规则卡都填了，命题也发布了。
> **Platform Admin**：发布就绪还差预算、积分池、评委分配和核验员。九项全过才能批准。
> **主办方**：那先把预算追加到 5 万，积分池充 1000 分，给两位评委各分 100 分，再加一个核验员。
> **Platform Admin**：现在批准了。开赛由你们自己点，系统不校验开赛时间。
> **报名者**：我提交报名后状态是 `submitted`，你们接受后我才会成为 **Season Participant**。
> **主办方**：接受后记得把微信状态从 `not_invited` 改成 `invited`，入群后再改成 `joined`。

## Flagged ambiguities

- “发布”在 PRD 中同时指**赛季发布审核**与**命题发布**。本上下文用 **Approval** 指后者以外的赛季审核，用 **Challenge Publish** 指命题发布；文档中避免裸用“发布”。
- “主办方”可指 Organizer Org（组织）或 Organizer（成员）。需要精确时写全称。
- “选手”与“用户”不同：选手是赛季级身份，用户是平台级身份。
