# BoomLand 平台后台契约（`/operator/boomland`）

平台管理员治理 BoomLand 的后台：审批主办方提交的赛季、维护主办方组织与成员。
设计稿里这个页面叫 `/admin`（见 PRD V2.6 §5）；本站把后台统一收在 `/operator`
下，所以实际路由是 `/operator/boomland`，不再单开一个 `/admin` 顶级入口。

## 路由与准入

| 路由 | 内容 | 准入 |
|---|---|---|
| `/operator/boomland` | 重定向到赛季治理 | 同下 |
| `/operator/boomland/seasons` | 赛季治理（待批准 + 全部赛季） | 管理员 / 主办方组织成员 |
| `/operator/boomland/seasons/:id` | 赛季预览（公开页渲染 + 批准 / 驳回） | 管理员 / 该赛季所属组织的成员 |
| `/operator/boomland/orgs` | 主办方组织与成员 | 管理员 / 主办方组织成员 |
| `/operator/boomland/<其余 tab>` | 职责说明占位 | 同上 |

- **能看 ≠ 能写**：主办方组织成员可以进入平台后台（需要查自己赛季的审批进度），
  但批准 / 驳回、新建组织、加减成员都只有 `Role.Operator` 能做；后端对应接口是
  `operatorOnly`，前端对成员隐藏写按钮并发出一条只读提示。
- 准入规则集中在 `apps/web/src/lib/platform-console.ts`
  （`canAccessPlatformConsole` / `shouldShowPlatformEntry`）。
  菜单入口（`user-menu` / `auth-nav`）与 layout 守卫共用同一套函数。
- 展示平台的运营后台整体放在 `app/operator/(showcase)` 路由组里，只对
  `Role.Operator` 开放；两条准入方向不同，所以各自保留自己的 layout，
  URL 不变。

## 赛季治理

- **待批准** = `upcoming` 且 `approvedAt` 为空（不新增 status，见
  `isPendingApproval`）。批准前该赛季不出现在 `/seasons`、大厅与搜索结果里 ——
  公开列表本来就用 `approvedAt IS NOT NULL` 过滤。
- **发布门槛**列显示 `通过项 / 总项`。总项来自后端 `readiness.checks.length`
  （不计分赛季会免除预算 / 积分池 / 评委分配三项），不写死 9。
- **预览**：待批赛季的公开接口会 404，所以预览读 `GET /seasons/:id/manage`
  （管理视图），再用公开页组件（`SeasonDetailPage`）渲染。审批人看到的就是
  批准后会公开的那一屏。
- **批准**：`POST /seasons/:id/approve`（管理员）。门槛未全过、或不是待批状态时
  按钮禁用并说明原因。
- **驳回**：`POST /seasons/:id/reject`，原因必填（≥2 字）。驳回把赛季退回
  `draft` 并记录原因，主办方据此修改后重新提交。

## 主办方组织与成员

- 数据：`GET /organizer-orgs` + 逐组织 `GET /organizer-orgs/:id/members`；
  每个组织主办的赛季从同一份赛季列表按 `season.organizerOrgs` 匹配得出，
  不额外请求。
- **新建组织**：`POST /admin/organizer-orgs`（名称 2—100 字，不可重名）。
- **新增成员**：`POST /admin/organizer-orgs/:id/members`。入参是用户 ID：
  站内目前没有“按昵称搜人”的开放接口，所以由管理员填 ID，用户不存在（404）
  或已是成员（409）时原样展示后端文案。
- **移除成员**：`DELETE /admin/organizer-orgs/:id/members/:userId`（204）。
  组织仍关联赛季时，后端拒绝移除最后一名成员（409）。
- **权限边界**：组织成员只在“该组织被指定的赛季”内拥有主办方权限，
  跨赛季一律 403。赛季列表的过滤在后端（`listManage`）完成，前端不二次筛选。

## 数据来源与取舍

- 平台后台读 `GET /admin/seasons`（= `listManage`，逐行计算 readiness）而不是
  主办方选择器用的 `GET /admin/seasons/all`：治理表要显示门槛计数，
  选择器只要能快点打开。两者的性能取舍相反，所以不复用同一个函数。
- 写操作走 `apps/web/src/lib/platform-console-api.ts`（浏览器 `fetch` + httpOnly
  cookie）；读走 `apps/web/src/server/platform-console.ts`（Server Component，
  `cache()` 去重）。
- 列表读失败降级成「空列表 + `failed` 标记」，页面显示“读取失败”而不是假装
  “没有数据”；单个赛季的预览读失败则给出明确的无权限 / 读取失败卡片。

## 测试

- 纯函数与准入矩阵：`apps/web/test/lib/platform-console.test.ts`
- 批准 / 驳回交互：`apps/web/test/components/platform-season-review-actions.test.tsx`
- 后端门槛计数与发奖主体字段：
  `apps/api/test/modules/boomland/season-moderation-list.test.ts`
