# 公告中心（Announcement Center）设计

> 目标：顶栏铃铛 + 未读角标 + 个人公告箱。支持「全局公告」与「专属公告」，已读状态用**每人一条读水位线**表示，不写「每条公告 × 每个用户」的已读记录。
>
> 相关文档：[boomland/CONTEXT.md](./boomland/CONTEXT.md)（Season Announcement 术语）、[pre-start-season-api.md](./boomland/pre-start-season-api.md)（现有 `season_announcements`）。

## 0. 一句话结论

- **内容表** `announcements`：一条公告一行，`scope` 区分 `global`（人人可见）与 `direct`（只有收件人可见）。
- **收件人表** `announcement_recipients`：只给 `direct` 公告用，是「投给谁」，**不是**「谁读了」。
- **读水位表** `user_announcement_reads`：**每个用户一行** `last_read_at`。未读 = 对我可见 且 `published_at > last_read_at`。
- 「一键已读」= 把这一行的 `last_read_at` 推到 `GREATEST(原值, NOW(3))`。
- 由此：已读数据量是 `O(用户数)`，而不是 `O(用户数 × 公告数)`。

## 1. 目标与非目标

**做**

1. `SiteHeader` 右上角铃铛，有未读时显示数字红点，`> 99` 显示 `99+`。
2. 两种受众：全局公告（人人有）、专属公告（指定用户，例如「报名已通过审核」）。
3. 一键已读，未读/已读只由「我的读水位线」推导。
4. 补齐 `/me/announcements`（当前是占位页），并让个人中心「公告」tab 显示同一份未读数。

**不做（本期）**

- 逐条「标记已读 / 标记未读」——与水位的语义冲突，详见 §3.6。
- 公告的阅读统计（谁读了、读了多少）——水位模型天然不提供，见 §11。
- WebSocket / SSE 推送。轮询 + 事件足够（§8.4）。
- 富文本 / HTML 正文。纯文本 + 站内链接，避免 XSS 面。

## 2. 为什么不用「每条公告一份未读记录」

朴素做法是 `announcement_reads(user_id, announcement_id)`，发布时给每个受众插一行「未读」，读掉就删/改。数据量：

| 方案 | 行数（5,000 用户 × 300 条公告） | 写入时机 |
| --- | --- | --- |
| 逐条已读记录 | 最多 1,500,000 行 | 每发一条公告 × 每个受众 |
| **读水位（本方案）** | **5,000 + 300 ≈ 5,300 行** | 每人每次「一键已读」一行 |

而且逐条模型还有额外代价：每发一条全局公告就要写 N 行（发布变成批量写操作），用户从不打开也照样占行。水位模型把「已读」变成**一次单人写**，公告发布只写公告本身。

代价也要说清楚：水位是**粗粒度、单向、全有全无**的语义（§3.6），它表达的是「此刻之前的我都算看过了」，而不是「我逐条点开过」。

## 3. 读模型（核心）

### 3.1 定义

对用户 `u`：

```
visible(a)   = (a.scope = 'global'  OR  exists(a.id, u) in announcement_recipients)
               AND a.revoked_at IS NULL
               AND a.published_at <= NOW()        -- 定时发布：到点前不可见
read(a, u)   = watermark(u) IS NOT NULL  AND  a.published_at <= watermark(u)
unread(u)    = { a | visible(a) ∧ ¬read(a, u) }
```

- `watermark(u)`：`user_announcement_reads.last_read_at`，没有行时见 §3.4。
- 比较基准是 **`published_at`**（对外生效时间），不是 `created_at`。以后要支持定时发布，只需要写入未来的 `published_at`，读模型不用改。
- 比较符号是**严格大于**：`watermark = T` 表示「T（含）之前都算读过」。

### 3.2 两条计数 SQL

```sql
-- 全局未读
SELECT COUNT(*) FROM announcements
WHERE scope = 'global'
  AND revoked_at IS NULL
  AND published_at > :lastReadAt;

-- 专属未读（announcement_recipients 走 (user_id, announcement_id) 索引，回表主键）
SELECT COUNT(*) FROM announcement_recipients r
JOIN announcements a ON a.id = r.announcement_id
WHERE r.user_id = :userId
  AND a.revoked_at IS NULL
  AND a.published_at > :lastReadAt;
```

总数 = 两行相加。没有水位行时去掉 `published_at > :lastReadAt` 这个条件（见 §3.4），即「全部可见都算未读」。

因为 UI 最多显示 `99+`，如果担心历史堆积，把每条改成
`SELECT COUNT(*) FROM (SELECT 1 ... LIMIT 100) t`，扫描到 100 行就停，够用即可（可选优化，先不做）。

### 3.3 一键已读

```sql
INSERT INTO user_announcement_reads (user_id, last_read_at, updated_at)
VALUES (:userId, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  last_read_at = GREATEST(last_read_at, NOW(3)),
  updated_at   = NOW(3);
```

三个细节：

1. **`GREATEST`**：水位只前进不后退。多标签页并发、客户端重试、时钟抖动都不会把水位拉回去。
2. **`NOW(3)` 而不是 `new Date()`**：公告的 `published_at` 也由 DB 时钟写入（`NOW(3)`），读写两端同一个时钟源，不受应用服务器时钟偏移影响。
3. 水位推到「请求那一刻」，不是「列表里最新一条的 `published_at`」。否则请求发出后、响应到达前新发的公告会卡在未读；反过来，同一毫秒内发布的公告会被算成已读——这个极小窗口是「一键已读」语义本身带来的，可以接受。

### 3.4 首次访问：水位从哪开始（已定：历史全算未读）

| 方案 | 行为 | 结论 |
| --- | --- | --- |
| **A. 没有水位行 = 全部可见都未读（等价于纪元）** | 上线时表为空，实际不会立刻 `99+`；上线前灌了几条历史公告，所有人就看到几条未读 | ✅ **采用** |
| B. 懒初始化（首次查询写入 `NOW(3)`） | 首次访问前的一切都算已读 | 不采用 |
| C. 上线时回填一次 | `INSERT ... SELECT` 灌水位 | 不需要，A 不需要任何回填 |

采用 A 之后，实际观感完全由「上线前灌了多少历史公告」决定：空表上线 = 所有人 0 条；灌 3 条欢迎公告 = 所有人 3 个红点。语义诚实，也没有额外脚本。

有两个直接后果，属于预期内：新注册用户也会看到既往公告的未读；上线前若灌了大量历史公告，所有人首屏就是 `99+`。想避免后者，就别在上线前回填历史公告（种子里的演示数据另说）。

实现要点：

- 没有水位行时**不要**拿纪元去和 `published_at` 比（会引入 1970 边界与时区转换的噪音），直接把这个条件**省掉**：

```ts
const conditions = [eq(announcements.scope, 'global'), isNull(announcements.revokedAt)]
if (watermark) conditions.push(gt(announcements.publishedAt, watermark))
```

- 接口里 `lastReadAt: string | null`，`null` 表示「从未点过已读」，前端文案显示「全部未读」，而不是伪造一个日期。
- `markAllRead` 的 upsert 自带建行能力，**不需要**额外的 `ensureWatermark()`，也不需要在 GET 里写库。

### 3.5 边界情况

| 情况 | 处理 |
| --- | --- |
| 公告被撤回 | `revoked_at` 非空，实时条件过滤，未读数立刻下降；已读水位不动 |
| 公告设了过期 | 本期不加 `expires_at`；要加时同 `revoked_at`，计数条件加一条 |
| 定时发布（`published_at` 在未来） | 到点前一律不可见、不计数（count/list 都带 `published_at <= NOW(3)`），到点后自动出现，不需要定时任务 |
| 已发布公告再补收件人 | **不支持回补**：受众在发布时确定。否则会出现「公告已读却突然冒出来」。真需要时把比较基准改成 `GREATEST(a.published_at, r.created_at)` |
| 同一毫秒多次发布 | 列表排序用 `(published_at DESC, id DESC)`；游标也是这个二元组，翻页不重不漏 |
| 用户从未读过、且没有行 | 未读 = 全部可见；`lastReadAt` 返回 `null`。首次「一键已读」才建行 |
| 跨端（手机/PC） | 水位在服务端，天然同步；下一次轮询即可见 |

### 3.6 为什么没有「单条已读」

水位只能前进：把某条**较早**的公告标成已读，会把比它更早的全部标记已读；把**最新**一条标成已读，等价于「全部已读」。所以「单条已读」在这个模型里要么是假动作，要么就是「一键已读」。这也是用户要的交互：**只有一键已读**。

如果哪天必须支持单条状态，唯一自洽的扩展是**分类水位**（每个分类一行水位，例如 `season` / `application`），代价是「全部已读」变成 N 行写、`last_read_at` 主键从 `user_id` 变成 `(user_id, category)`。不建议本期做。

## 4. 数据模型

### 4.1 `announcements`（公告本体）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | int PK autoinc | |
| `scope` | varchar(16) | `global` \| `direct`，二选一 |
| `type` | varchar(32) | `system` / `season` / `application` / `team` / `challenge`，只用于图标与分组，不参与权限 |
| `level` | varchar(16) | `info` / `success` / `warning`，视觉语气 |
| `title` | varchar(255) | 纯文本 |
| `content` | text | 纯文本，前端 `whitespace-pre-line` |
| `link_path` | varchar(512) null | 站内相对路径，如 `/seasons/12` |
| `season_id` | int null | 关联赛季，便于按赛季归档/筛选 |
| `published_at` | timestamp(3) | 未读比较基准，DB 时钟写入 |
| `revoked_at` | timestamp(3) null | 撤回 |
| `created_by` | varchar(255) | 操作者 userId，系统生成填 `system` |
| `source_type` / `source_id` | varchar | 来源指针，例如 `season_announcement` / `42` |
| `dedupe_key` | varchar(191) null unique | 幂等键，如 `application:123:accepted` |
| `created_at` | timestamp(3) | |

索引：

- `(scope, published_at)` — 全局未读计数（等值 + 范围）。
- `(published_at)` — 列表/归档的时间扫描。
- `unique(dedupe_key)` — 重试去重（MySQL 允许多个 NULL）。
- `(season_id, published_at)` — 按赛季查（可选，本期先建着不贵）。

### 4.2 `announcement_recipients`（投递名单）

`(id, announcement_id, user_id, created_at)`，唯一键 `(announcement_id, user_id)`，索引 `(user_id, announcement_id)`（覆盖计数时的定位，再回表取 `published_at`）。

只给 `direct` 写。它是「这条公告进了谁的收件箱」，**不是已读状态**。全局公告在这里零行。

### 4.3 `user_announcement_reads`（读水位）

`user_id varchar(255) PRIMARY KEY`，`last_read_at timestamp(3) NOT NULL`，`updated_at`。
一人一行，全表行数 ≈ 用户数。

### 4.4 drizzle schema

`apps/api/src/db/schema/announcement.ts`（迁移用 `bunx drizzle-kit generate` 生成，不手改迁移文件）：

```ts
import { index, int, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'

export const announcements = mysqlTable('announcements', {
  id: int('id').primaryKey().autoincrement(),
  scope: varchar('scope', { length: 16 }).notNull(),          // global | direct
  type: varchar('type', { length: 32 }).notNull(),            // system | season | application | team | challenge
  level: varchar('level', { length: 16 }).notNull().default('info'),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  linkPath: varchar('link_path', { length: 512 }),
  seasonId: int('season_id'),
  publishedAt: timestamp('published_at', { fsp: 3 }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { fsp: 3 }),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  sourceType: varchar('source_type', { length: 32 }),
  sourceId: varchar('source_id', { length: 64 }),
  dedupeKey: varchar('dedupe_key', { length: 191 }),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  index('idx_announcements_scope_published').on(table.scope, table.publishedAt),
  index('idx_announcements_published').on(table.publishedAt),
  uniqueIndex('uq_announcements_dedupe').on(table.dedupeKey),
  index('idx_announcements_season_published').on(table.seasonId, table.publishedAt),
])

export const announcementRecipients = mysqlTable('announcement_recipients', {
  id: int('id').primaryKey().autoincrement(),
  announcementId: int('announcement_id').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_announcement_recipients_announcement_user').on(table.announcementId, table.userId),
  index('idx_announcement_recipients_user').on(table.userId, table.announcementId),
])

export const userAnnouncementReads = mysqlTable('user_announcement_reads', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  lastReadAt: timestamp('last_read_at', { fsp: 3 }).notNull(),
  // 不要 .onUpdateNow()：drizzle 生成的是不带精度的 `ON UPDATE CURRENT_TIMESTAMP`，
  // MySQL 对 timestamp(3) 列会报 ER_INVALID_ON_UPDATE（见 §6.1）。
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow(),
})
```

写完在 `apps/api/src/db/schema/index.ts` 追加一行 `export * from './announcement'`。

> `fsp: 3` 让时间精确到毫秒。`defaultNow()` 生成的是 `DEFAULT (now())`（秒精度），所以**发布路径不要依赖它**，统一在 INSERT 里写 `sql\`NOW(3)\``；精度只影响「同一秒内发布」的排序与极窄竞争窗口。

### 4.5 与现有 `season_announcements` 的关系

现有 `season_announcements` 是**赛季页上的公开内容**（`GET /seasons/:id/announcements`，未登录也能看，只有已批准赛季能写），它没有、也不该有「收件箱」语义。

新表的定位是**用户收件箱**。两者不是二选一：

```
主办方改赛程
  ├─ season_announcements  ← 赛季页公告区（现状，不改）
  └─ announcements(direct) ← 同一内容进「该赛季选手」的收件箱（新增，同一事务）
         source_type='season_announcement', source_id=<season_announcement.id>
```

内容会有一次复制（title/content），换来的是两套生命周期解耦：赛季页是公开档案，收件箱是个人通知。不要为了「不复制」把赛季页改成读收件箱——未登录访客、草稿赛季、撤回语义全都会打架。

**已实现**（season/service.ts）：

- createAnnouncement（主办方手动发公告）与 nnounce()（改赛程 / 规则 / 规则卡 / 主题时自动生成的公告）都在**同一个事务**里先写 season_announcements，再调 anOutSeasonAnnouncement() 投递给该赛季 status=active 的选手。
- 投递内容：	ype='season'、level = general ? info : warning（赛程/规则用警示语气）、link_path=/seasons/:id、source_type='season_announcement'、source_id=<公告 id>、dedupe_key=season_announcement:<id>（重试不重复）。
- 没有选手时直接跳过，不产生无人可见的公告。
- **历史公告不回补**：受众在发布时确定（§3.5），本次上线前已有的 season_announcements 不会自动进收件箱；要补的话写一次性脚本按「当前 active 选手」补投并把 dedupe_key 设为同一个值。

## 5. 受众模型

| 场景 | scope | 收件人来源 | 生成位置 |
| --- | --- | --- | --- |
| 平台级通知（活动、维护、规则变更） | `global` | — | 种子/脚本调 `publishGlobal()`；运营接口与表单推后（§6） |
| 赛程 / 规则 / 规则卡变更 | `direct` | 该赛季 `status=active` 的选手 | ✅ `season/service.ts` 的 `createAnnouncement` / `announce()`，与赛季公告同事务 |
| 报名通过 / 拒绝 / 候补 / 复核 | `direct` | 报名人 | ✅ `season-application/service.ts` `updateStatus` 事务内 |
| 组队成立 / 解散 / 被移出 | `direct` | 队员 | 待接（`season-team` 服务） |
| 命题截止提醒（后续） | `direct` | 参赛者 / 关注者 | 定时任务 |

**关于「赛程发生变化」算不算全局**：产品语感上它是「全局公告」，但 `global` 的语义是**所有注册用户**，把 A 赛季的赛程变更推给全平台会让不参赛的人也被打扰。**已定：用 `direct` 只投给该赛季 `status=active` 的选手。** `global` 留给真正的平台级内容（维护、平台规则、全站活动）。

**扇出规模**：`direct` 的收件人行数 = 公告数 × 受众数。BoomLand 一个赛季几百到几千人，完全可控。两种写法：

```ts
// 小受众：应用侧批量插入，500 条一批（避免单条 SQL 过大）
await announcementService.publishDirect(userIds, input, tx)

// 大受众：一条 INSERT ... SELECT，不把 id 列表搬到应用层
await tx.execute(sql`
  INSERT IGNORE INTO announcement_recipients (announcement_id, user_id, created_at)
  SELECT ${announcementId}, user_id, NOW(3) FROM season_participants
  WHERE season_id = ${seasonId} AND status = 'active'
`)
```

`INSERT IGNORE` + `unique(announcement_id, user_id)` 保证重试不产生重复收件人。

**以后要加「群体受众」怎么办**：加 `announcement_audiences(announcement_id, audience_type, audience_ref)`，把「谁可见」从行变成规则。**读模型不受影响**——未读仍然只比 `published_at` 与水位，只是 `visible(a)` 多一个 UNION 分支。这是本设计刻意做的解耦：**受众怎么算，和已读怎么记，互不依赖**。

## 6. 发布入口与一致性

`apps/api/src/modules/announcement/service.ts`：

```ts
export type PublishInput = {
  type: AnnouncementType          // system | season | application | team | challenge
  level?: 'info' | 'success' | 'warning'
  title: string                   // ≤ 100 字
  content: string                 // ≤ 5000 字，纯文本
  linkPath?: string | null        // 必须是以单个 `/` 开头的站内路径
  seasonId?: number | null
  createdBy: string               // 操作者 userId，系统生成填 'system'
  sourceType?: string
  sourceId?: string
  dedupeKey?: string              // 幂等键
}

export class AnnouncementService {
  constructor(private db: Database) {}

  /** 全局公告：所有登录用户可见，收件人表零行。 */
  async publishGlobal(input: PublishInput, tx: Database = this.db): Promise<{ id: number }>

  /** 专属公告：收件人名单在发布时确定，内部按 500 一批写收件人。 */
  async publishDirect(userIds: string[], input: PublishInput, tx: Database = this.db): Promise<{ id: number }>

  async summary(userId: string): Promise<{ unreadCount: number; lastReadAt: Date | null }>
  async list(userId: string, query: { limit?: number; cursor?: string; unreadOnly?: boolean }): Promise<...>
  async markAllRead(userId: string): Promise<{ lastReadAt: Date; unreadCount: 0 }>
}
```

发布实现要点：

- **同一个事务**：公告表与业务表在同一个 MySQL schema，`publishDirect(userIds, input, tx)` 接收事务句柄，写公告的动作与「报名状态变更 / 赛程保存」同生共死。做不出「状态改了但没通知」或「通知了但状态回滚」。公告插入只碰本地表，不会因为外部 `users` 表抖动而拖垮事务（需要邮箱的场景另说，见 `user/service.ts`）。
- **幂等**：`dedupe_key` 唯一索引 + `INSERT IGNORE`。命中重复则读回已有 id，跳过收件人写入，返回已有 id。典型 key：`application:123:accepted`、`season:7:schedule:v13`、`team:9:formed`。
- **DB 时钟**：`published_at` 用 `sql\`NOW(3)\``，与水位同一时钟。

`apps/api/src/modules/announcement/index.ts` 路由（Elysia 链式、`auth: true` 宏）。本期只注册三个 `/me` 接口：

```ts
export const announcementModule = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .model({ AnnouncementListQuery, AnnouncementSummaryResponse, AnnouncementListResponse, MarkAllReadResponse })
  .prefix('model', 'Announcement.')
  .get('/me/announcements/summary', ({ user }) => service.summary(user.userId), {
    auth: true,
    response: { 200: 'Announcement.AnnouncementSummaryResponse', 401: ErrorResponse },
  })
  .get('/me/announcements', ({ user, query }) => service.list(user.userId, query), {
    auth: true, query: 'Announcement.AnnouncementListQuery',
    response: { 200: 'Announcement.AnnouncementListResponse', 401: ErrorResponse },
  })
  .post('/me/announcements/read-all', ({ user }) => service.markAllRead(user.userId), {
    auth: true, response: { 200: 'Announcement.MarkAllReadResponse', 401: ErrorResponse },
  })
```

在 `apps/api/src/app.ts` 的 `.use(seasonApplicationModule)` 之后注册。

> **推后**：运营发布接口 `POST /operator/announcements`（`operatorOnly` + `audit_logs` 审计）与发布表单本期都不做。全站公告先用种子/脚本直接调 `announcementService.publishGlobal()`。加接口时是纯增量：`roleGuardPlugin` + 一个路由 + 一条审计，服务方法已经就绪。

### 6.1 实现备注（写代码时踩到的两个坑）

1. **`timestamp(fsp: 3)` 不能用 `.onUpdateNow()`**：drizzle 生成的是不带精度的 `ON UPDATE CURRENT_TIMESTAMP`，MySQL 对 `timestamp(3)` 列直接报 `ER_INVALID_ON_UPDATE`（1294）。所以 `user_announcement_reads.updated_at` 去掉了 `.onUpdateNow()`，由唯一的写入方（一键已读的 upsert）显式写 `NOW(3)`。
2. **幂等要靠 `cause` 判断**：drizzle 0.44 把驱动错误包成 `DrizzleQueryError`，`errno/code` 挂在 `error.cause` 上。判断唯一键冲突必须递归剥 `cause`，否则 `INSERT` 重复时不会被识别成「已存在」，而是直接抛 500。

## 7. HTTP API 契约

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/me/announcements/summary` | 登录 | 铃铛角标数据 |
| `GET` | `/me/announcements` | 登录 | 列表，游标分页 |
| `POST` | `/me/announcements/read-all` | 登录 | 一键已读 |

**没有任何接口接收 `userId` 参数**，一律取 `user.userId`，从接口形状上消除越权读别人公告的可能。

```ts
// GET /me/announcements/summary
{
  unreadCount: number,        // 精确值，前端按 99+ 截断
  lastReadAt: string | null,  // ISO；null = 从未点过已读（全部历史未读）
}

// GET /me/announcements?limit=20&cursor=<publishedAtMs>_<id>&unreadOnly=true
{
  items: [{
    id: number,
    type: AnnouncementType,
    level: 'info' | 'success' | 'warning',
    title: string,
    content: string,        // 纯文本
    linkPath: string | null,
    seasonId: number | null,
    publishedAt: string,    // ISO
    isRead: boolean,        // lastReadAt != null && publishedAt <= lastReadAt
  }],
  nextCursor: string | null,
  unreadCount: number,      // 与 summary 同口径，面板打开时顺带刷新角标
}

// POST /me/announcements/read-all
{ lastReadAt: string, unreadCount: 0 }
```

- 排序与游标：`ORDER BY published_at DESC, id DESC`；`cursor` 编码 `<publishedAt 毫秒>_<id>`，条件为
  `published_at < ? OR (published_at = ? AND id < ?)`。用二元组而不是单一时间，避免同一毫秒多条公告翻页重复。
- `unreadOnly=true` 只影响返回列表，`unreadCount` 仍是全量未读数。
- 错误：401 `UNAUTHORIZED`（统一走 `authPlugin` 宏）。本期三个接口都是「读自己 / 改自己」，没有 403 分支。

## 8. 前端设计

### 8.1 文件清单

| 文件 | 动作 | 内容 |
| --- | --- | --- |
| `packages/shared/src/index.ts` | 改 | `ANNOUNCEMENT_TYPES` / `ANNOUNCEMENT_TYPE_LABELS` / `ANNOUNCEMENT_LEVELS` / `ANNOUNCEMENT_UNREAD_CAP = 99` |
| `apps/api/src/db/schema/announcement.ts` | 新增 | §4.4 |
| `apps/api/src/db/schema/index.ts` | 改 | 导出 |
| `apps/api/src/modules/announcement/{index,service,model}.ts` | 新增 | §6/§7 |
| `apps/api/src/app.ts` | 改 | 注册模块 |
| `apps/web/src/components/announcement-bell.tsx` | 新增 | Client：铃铛 + 角标 + 面板 + 一键已读 |
| `apps/web/src/components/site-header.tsx` | 改 | 在 `UserMenu` 左侧插入 `<AnnouncementBell />` |
| `apps/web/src/lib/announcements.ts` | 新增 | 角标文案、类型标签、面板相对时间 |
| `apps/web/src/lib/client-api.ts` | 改 | `getAnnouncementSummary` / `getAnnouncements` / `markAllAnnouncementsRead` |
| `apps/web/src/server/announcements.ts` | 新增 | SSR 列表（`cache()` + eden treaty） |
| `apps/web/src/app/me/announcements/page.tsx` | 改 | 真实列表页（替换 `WorkbenchPlaceholder`） |
| `apps/web/src/components/me/announcement-list.tsx` | 新增 | 列表 + 一键已读 + 空状态 |
| `apps/web/src/lib/me.ts` | 改 | `ready: true`；`workbenchTabBadges` 增加 `announcements` |
| `apps/web/src/server/me.ts` | 改 | `getWorkbenchHeader` 带回 `unreadAnnouncements` |
| `apps/web/src/app/me/layout.tsx` | 改 | 把未读数传给 `WorkbenchTabs` |

### 8.2 铃铛与角标

- 位置：`SiteHeader` 右侧操作区 `提交产品` 与 `UserMenu` 之间。
- 未登录不渲染（`useAuth().user` 为空时 `return null`），避免和「登录」按钮抢位置。
- 角标：`unreadCount > 0` 时渲染 `<span class="absolute -right-0.5 -top-0.5 ...">`，颜色用语义 token `bg-destructive text-destructive-foreground`（`globals.css` 已有 `--color-destructive: var(--danger)`），换肤自动跟随。
- 文案：`unreadCount > ANNOUNCEMENT_UNREAD_CAP ? '99+' : String(unreadCount)`。
- 无障碍：按钮 `aria-label={count > 0 ? \`公告，${count} 条未读\` : '公告'}`；角标本身 `aria-hidden`，避免读屏把「99+」当正文念两遍。

### 8.3 面板

**受控按钮 + 浮层**，而不是 `UserMenu` 那套原生 `<details>`：铃铛打开时要拉列表、Esc 要把焦点还给按钮、还要丢弃过期回包，受控状态更直接，也不依赖 `<summary>` 在测试环境里的默认行为。浮层沿用 `Card static` 的描边/圆角/语义阴影，外面点一下和 `Esc` 都能收起。

```
┌──────────────────────────────┐
│ 公告                全部已读 │  ← 未读数为 0 时按钮 disabled
├──────────────────────────────┤
│ ● [赛季] 赛程调整通知        │  ← 未读：标题加粗 + 左侧圆点
│   原定 11/20 的评审延至 11/22 │     `whitespace-pre-line`，2 行截断
│   2 小时前                    │
│ ○ [报名] 报名已通过审核       │  ← 已读：标题常规色、无圆点
├──────────────────────────────┤
│          查看全部 →           │  ← /me/announcements
└──────────────────────────────┘
```

- 打开面板才拉列表（`GET /me/announcements?limit=20`），打开时不改已读状态——**必须点「全部已读」**，这是需求 3 的核心交互。
- 「全部已读」：乐观更新（角标清零、圆点消失、按钮 disabled），失败整体回滚（角标与列表回到点击前）。
- 点条目：`next/link` 跳 `linkPath`，不标已读。
- 空状态：「暂时没有公告」。
- 窄屏：面板 `min-w-80 max-w-[calc(100vw-2rem)]`，右对齐；列表 `max-h-[60vh] overflow-y-auto`。

### 8.4 刷新策略（无推送）

```ts
useEffect(() => {
  if (!userId) return
  let active = true
  const load = async () => {
    const requestedAt = Date.now()
    const result = await getAnnouncementSummary()
    if (!active || !result.data) return
    // 请求发出后用户点了「全部已读」：这份回包描述的是旧状态，丢弃。
    if (requestedAt < lastMarkedAtRef.current) return
    setCount({ userId, value: result.data.unreadCount })
  }
  void load()
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void load()
  }, 60_000)
  const onVisible = () => { if (document.visibilityState === 'visible') void load() }
  const onRefresh = () => void load()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('announcements-refresh', onRefresh)   // 与 connections-refresh 同款
  return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('announcements-refresh', onRefresh) }
}, [userId])
```

- 60s 轮询 + 标签页重新可见时立刻刷一次，够用且很便宜（一条走索引的 COUNT）。
- 站内自己触发的动作（提交报名、切换 mock 用户）`window.dispatchEvent(new Event('announcements-refresh'))` 立即同步。
- 不做 SSE：公告是低频事件，长连接会引入连接管理与多实例广播问题，收益不匹配。
- 组件内的计数与面板数据都带 `userId`：换账号时旧数据自动失效，不需要在 effect 里同步清空状态（那会触发 `react-hooks/set-state-in-effect`，也多一轮渲染）。浮层的「打开状态」也绑定 `userId`，切换账号时自动收起，不会停在别人的列表上。
- 「一键已读」成功后记下 `lastMarkedAt`，早于它发出的 summary 回包一律丢弃——否则轮询回包会把刚清零的角标写回去。

### 8.5 `/me/announcements` 页

- Server Component 用 eden treaty 读第一页（`apps/web/src/server/announcements.ts`，`cache()` 包装），`/me` 的 `dynamic = 'force-dynamic'` 已经保证不静态化。
- 列表按日期分组，每条：类型 Chip、标题、正文、时间（复用 `lib/boomland.ts` 的 `formatDateTime`，已固定 `Asia/Shanghai`）、`linkPath` 箭头。
- 顶部右侧「全部已读」按钮（Client 子组件，成功后 `router.refresh()`）。
- 首期取最近 50 条，不做「加载更多」；接口已支持游标，加按钮时不用改后端。
- `lib/me.ts` 里把 `announcements` 改成 `ready: true`，`workbenchTabBadges` 增加 `announcements: unreadAnnouncements`——tab 上的 `99+` 角标逻辑 `WorkbenchTabs` 已实现，直接复用。

### 8.6 注意：不要把 `cookies()` 塞进根布局

`SiteHeader` 是 Server Component，而 `App Router` 的根布局一旦读 `cookies()`，**所有页面都会退化成动态渲染**。所以铃铛的初始值不 SSR，走 `useAuth()` + 客户端请求（与 `UserMenu` 的 `getConnections()` 完全同款）；服务端只在 `/me/*`（本来就 `force-dynamic`）里顺便取未读数。

## 9. 测试计划

**后端**（`apps/api/test/modules/announcement/index.test.ts`，覆盖下列场景）

1. 三个接口未登录一律 401。
2. 新用户：`unreadCount = 0`、`lastReadAt = null`（没有水位行）。
3. 全局公告：任意两个用户都 +1，收件人表零行。
4. 专属公告：只有收件人 +1 且出现在列表里，非收件人不变、列表不含。
5. 在调用方事务里发布（`db.transaction(async (tx) => publishDirect(userIds, input, tx))`）能落库。
6. 幂等：同一 `dedupeKey` 连发两次 → 一条公告、一条收件人。
7. 一键已读后归零，之后新公告才算未读；`unreadOnly=true` 只返回未读。
8. 水位不回退：把 `last_read_at` 置为未来时间后调一键已读，返回值不变。
9. 撤回（`revokedAt` 非空）不计未读，也不出现在列表。
10. 翻页：`limit=2` 的 `(publishedAt, id)` 游标不重不漏。
11. 坏链接：`//host`、`https://host`、`/\host` 一律拒绝。
12. 赛季公告桥接（`test/modules/boomland/season-flow.test.ts`）：主办方发赛季公告后，该赛季 active 选手未读 +1、非选手不变，`type=season`、`level=warning`、`linkPath=/seasons/:id`。
13. 报名结果桥接：录取 → 收件箱出现「报名已通过审核」；拒绝 → 出现「报名未通过」且带上拒绝原因。

**前端**（`apps/web/test/lib/announcements.test.ts` + `apps/web/test/components/announcement-bell.test.tsx`）

组件测试沿用仓库对 `UserMenu` 的做法：`vi.mock` 掉 `@/components/auth-provider` 与 `@/lib/client-api`，不经过 MSW；纯函数另外单测。

- 文案：`120` → `99+`，`0` 不渲染角标；按钮 `aria-label` 随未读数变化。
- 未登录不渲染、不请求。
- 打开面板才拉列表（`limit=20`），且**不**调用一键已读。
- 一键已读 → 角标消失；接口失败 → 角标与列表回滚。
- 点外部 / `Esc` 收起；`Esc` 后焦点回到铃铛；空状态文案。
- 纯函数：相对时间窗口（刚刚 / N 分钟前 / N 小时前 / N 天前 / 超过 7 天回落 `MM.DD`）、类型标签降级。

> 本机跑前端测试需要 Node 22+：jsdom 30 在 Node 20 下会在 fork 阶段报
> `webidl.util.markAsUncloneable is not a function`（jsdom → undici）。用 `fnm use 24` 后
> 再 `bun run test`，或直接用 Node 24 调 `node_modules/vitest/vitest.mjs run`。

## 9.1 本地演示数据（mock）

公告是用户维度数据，不塞进 `seed` / `seed:season`，单独一个脚本、可重复执行：

```bash
bun run seed:announcements   # 或 bun run seed:all（会顺带跑它）
```

- 7 条演示公告：2 条全局 + 5 条按 mock 用户的专属（`9001` 普通用户 / `9002` 创始人 / `9004` 运营 / `9005` 运营+创始人 / `9006` 主办方成员）。
- 每次执行先删上一批 `source_type = 'seed-demo'` 的公告与收件人，并清空 mock 用户的读水位线，再重新发布 —— 所以重复 seed 后切换用户一定能看到红点，不会因为上一轮点过「全部已读」而看起来没效果。
- 切换 mock 用户后的未读数：`guest / founder / operator / admin / organizer = 3`，`founder-no-profile / founder-demo = 2`。
- 演示公告用较近的相对时间发布（5 分钟前 / 2 小时前 / 1–3 天前），顺便验证面板里的时间格式。

## 10. 实施拆分

| PR | 内容 | 可独立验收 | 状态 |
| --- | --- | --- | --- |
| 1 | shared 常量 + schema + 迁移 + `AnnouncementService.publishGlobal/publishDirect/summary/list/markAllRead` + 三个 `/me` 接口 + 后端测试（契约即本文 §7；`docs/spec-v1-backend-api.md` 是 v1.0 项目/人才期的旧规格，新模块以本文件为准） | 接口可用（curl 可验） | ✅ 已完成 |
| 2 | 前端铃铛/角标/面板/轮询 + 组件测试 | 需求 1 完成 | ✅ 已完成 |
| 3 | `/me/announcements` 页 + tab 角标 + `ready: true` | 需求 3 的完整闭环 | 待做 |
| 4 | 业务接线：报名状态变更、赛季赛程/规则公告 → 该赛季选手、组队事件（各自的模块测试补断言） | 专属公告真实产生 | 🚧 赛季公告 + 报名结果已接，组队事件待做 |
| — | **推后**：运营 `POST /operator/announcements` + 发布表单 + 审计 | 需要全站公告时再开 | 未排期 |

## 11. 取舍与后续扩展

| 取舍 | 说明 |
| --- | --- |
| 已读全有全无 | 无法表达「我只读了其中一条」。这是本方案换数据量的代价，也正是需求要的交互 |
| 无阅读统计 | 运营看不到「多少%读过」。要的话另建 `announcement_read_stats`（只对需要的公告采样），不要把它塞进主模型 |
| 受众需在发布时确定 | 后补收件人要改比较基准（§3.5），本期不做 |
| 历史公告全算未读 | 上线时表为空，实际观感 = 你灌了多少历史公告；不灌就是 0，灌 3 条就是 3 个红点（§3.4） |
| 无定时发布 | 字段已支持 `published_at` 未来时间，但发布路径不做调度；需要时加一个 worker |
| 保留策略 | 建议 180 天后清理 `announcements`（`published_at` 索引支持批量删）；水位是时间戳，清理不影响已读判断 |

后续若要「分类未读」（例如「报名」「赛季」分开红点），扩展点是**把水位表主键改成 `(user_id, category)`**，接口多返回一个 `counts: Record<category, number>`，前端 tab/铃铛各取所需。其余结构不变。

## 12. 已定决策（2026-11-15）

1. **上线视为历史未读**：没有水位行 = 全部可见未读，`lastReadAt: null`；不做懒初始化、不做回填（§3.4）。
2. **赛程变化只推该赛季选手**：`direct` 扇出到 `season_participants` 中 `status=active` 的人；`global` 只留给平台级内容（§5）。
3. **运营发布页先不做**：本期不注册 `POST /operator/announcements`，也没有运营表单；全站公告用种子/脚本调 `publishGlobal()`（§6 的「推后」说明）。

---

实现时建议把 §3 的「读水位」决策提成 `docs/adr/0018-announcement-read-watermark.md`（与 ADR 0008「follower 数按需 COUNT」同一类取舍：宁可少存，不要冗余），本文件保留数据模型与接口细节。
