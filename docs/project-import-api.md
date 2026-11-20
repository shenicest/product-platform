# 项目导入 API

> 面向外部来源方：通过本接口将项目数据批量写入平台，并标注数据来源。

## 1. 概述

- **接口用途**：外部来源方按自己的来源名批量导入项目。项目归属真实用户（按邮箱识别），导入后直接上线展示，无需人工审核。
- **幂等**：同一来源内以 `external_id` 为唯一标识，重复导入会更新已有项目，不会产生重复数据。
- **安全**：每个来源独立密钥鉴权；按来源与 IP 双重限流；单次最多导入 20 条。

## 2. 调用地址

```text
POST https://<平台域名>/api/import/projects
```

- 请求与响应均为 `application/json`（`Content-Type: application/json`）。

## 3. 鉴权

- 每个来源分配一枚独立密钥，通过请求头传入：

```text
X-Api-Key: <你的密钥>
```

- 密钥由平台方发放；一个密钥只对应一个来源名。
- 请求体中的 `source_name` 必须与密钥对应的来源名一致，否则返回 `403`。
- 密钥缺失或错误返回 `401`。

## 4. 请求

### 4.1 请求体结构

```json
{
  "source_name": "hackathon-2025",
  "projects": [
    {
      "external_id": "hack-001",
      "owner_email": "founder@example.com",
      "owner_name": "张三",
      "name": "AI 笔记助手",
      "tagline": "一句话自动整理会议纪要",
      "cover_url": "https://example.com/cover.png",
      "demo_images": ["https://example.com/1.png"],
      "demo_video_url": "https://example.com/video",
      "demo_link": "https://example.com/demo",
      "stage": 1,
      "categories": ["效率工具"],
      "problem_statement": "用户会议记录分散、整理耗时。",
      "progress": "已上线 MVP。",
      "next_steps": "接入企业版。",
      "differentiation": "端侧实时转写。",
      "business_model": "订阅制。",
      "team_name": "星辰小队"
    }
  ]
}
```

### 4.2 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source_name` | string | 是 | 来源名，须与密钥对应 |
| `projects` | array | 是 | 项目数组，1–20 条 |

### 4.3 `projects[]` 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `external_id` | string | 是 | 你方项目 ID，同源内唯一，用于幂等 |
| `owner_email` | string | 是 | 项目属主邮箱 |
| `owner_name` | string | 否 | 属主显示名，首次创建用户时生效 |
| `name` | string | 是 | 项目名（≤255 字符） |
| `tagline` | string \| null | 否 | 一句话介绍（≤255 字符） |
| `cover_url` | string \| null | 否 | 封面图 URL，须 `http(s)://` |
| `demo_images` | string[] \| null | 否 | 演示截图 URL 数组 |
| `demo_video_url` | string \| null | 否 | 演示视频 URL，须 `http(s)://` |
| `demo_link` | string \| null | 否 | 在线演示链接，须 `http(s)://` |
| `stage` | int \| null | 否 | 项目阶段：0 想法 / 1 原型 / 2 MVP / 3 已上线 / 4 有收入 |
| `categories` | string[] \| null | 否 | 品类 |
| `problem_statement` | string \| null | 否 | 项目背景与问题 |
| `progress` | string \| null | 否 | 当前进展 |
| `next_steps` | string \| null | 否 | 下一步计划 |
| `differentiation` | string \| null | 否 | 差异化优势（≤255 字符） |
| `business_model` | string \| null | 否 | 商业模式（≤255 字符） |
| `team_name` | string \| null | 否 | 团队/公司名（≤255 字符） |

### 4.4 校验规则

- 必填字段缺失、数组为空或超过 20 条、字段类型/长度不符 → 返回 `422`。
- `cover_url` / `demo_video_url` / `demo_link` 若填写，必须是合法的 `http(s)://` 链接。
- `stage` 若填写，必须在 0–4。
- 单条校验失败只影响该条，其余条目正常导入。

## 5. 响应

### 5.1 成功（200）

```json
{
  "imported": 1,
  "updated": 0,
  "failed": []
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `imported` | number | 本次新建的项目数 |
| `updated` | number | 本次更新的已有项目数 |
| `failed` | array | 导入失败的条目及原因 |

`failed[]` 元素：

```json
{ "external_id": "hack-001", "error": "stage 必须在 0-4 之间" }
```

### 5.2 错误码

| 状态码 | 含义 | 处理建议 |
|---|---|---|
| `401` | 密钥缺失或错误 | 检查 `X-Api-Key` |
| `403` | `source_name` 与密钥不符 | 确认来源名拼写 |
| `422` | 请求体校验失败 | 按返回信息修正请求 |
| `429` | 触发限流 | 等待 `retry-after` 秒后重试 |
| `503` | 服务暂不可用 | 稍后重试 |

## 6. 幂等说明

- 以 `(source_name, external_id)` 为唯一标识。
- 首次导入：新建项目并直接上线。
- 重复导入相同 `external_id`：更新该项目的正文与属主，不重复建项目。
- 平台侧的人工下架/驳回操作具有更高优先级：重复导入不会使这些项目被重新上线，只会更新内容。

## 7. 限流

| 维度 | 额度 |
|---|---|
| 每个来源 | 10 次/分钟，100 次/小时，500 次/天 |
| 每个 IP | 30 次/分钟 |

超限返回 `429`，并在响应头 `retry-after` 中给出等待秒数。

## 8. 完整示例

```bash
curl -X POST "https://<平台域名>/api/import/projects" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <你的密钥>" \
  -d '{
    "source_name": "hackathon-2025",
    "projects": [
      {
        "external_id": "hack-001",
        "owner_email": "founder@example.com",
        "owner_name": "张三",
        "name": "AI 笔记助手",
        "tagline": "一句话自动整理会议纪要",
        "cover_url": "https://example.com/cover.png",
        "demo_link": "https://example.com/demo",
        "stage": 1,
        "categories": ["效率工具"],
        "problem_statement": "用户会议记录分散、整理耗时。",
        "team_name": "星辰小队"
      }
    ]
  }'
```

成功响应：

```json
{ "imported": 1, "updated": 0, "failed": [] }
```
