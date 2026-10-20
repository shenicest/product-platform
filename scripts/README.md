# HTML 单文件快照（UI 走查用）

把本地 dev server 上的一个页面，转成**双击即可打开**的单个 HTML 文件。用于 UI 走查、设计评审、发给外部同学看效果，不需要后端、不需要 Node、不需要网络。

## 快速开始

```bash
# 1. 启动 dev server（另开一个终端）
bun run dev:web

# 2. 生成单文件快照
node scripts/html-snapshot.mjs \
  --url http://localhost:3000/ \
  --out .scratch/snapshot/home.html
```

输出会打印一份自检报告：

```
written .scratch/snapshot/home.html
  size            2546.3 KB
  stylesheets     1 -> inlined
  images          20 inlined
  fonts           5 subset
  external refs   0        <- 必须是 0
  scripts left    0        <- 必须是 0
  unstyled class  0        <- 必须是 0
```

三个 `0` 都成立，文件才算真的自包含。

## 截图验证

结构检查过不了"看起来对不对"这一关，交付前扫一眼：

```bash
python scripts/snapshot-shot.py \
  .scratch/snapshot/home.html \
  .scratch/snapshot/home-1440.png 1440 1200
```

`broken: 0` 表示所有图片都解码成功。截图会落在指定路径。

## 它做了什么

| 步骤 | 处理 |
| --- | --- |
| 抓取 | GET 页面，拿到服务端渲染好的 HTML |
| 样式 | 下载 `<link rel=stylesheet>`，展开 `@import` 链，把 `url()` 里的字体和背景图一起抓下来 |
| 字体 | **按页面实际用到的字形做子集化**（4MB CJK 字体 → 约 44KB） |
| 图片 | 抓 `<img>` 源，重编码成 WebP（取更小的那个），转 base64 内联 |
| 脚本 | 移除所有 Next.js/Vite 运行时脚本（RSC payload、hydration、HMR） |
| 元数据 | 保留 title/description，去掉指向 `file://` 打不开的 og:image |
| 自检 | 校验外部引用、残留脚本、markup 中无对应 CSS 规则的 class |

## 关键设计

**为什么字体要子集化。** 这个项目 Harmony 字体三个字重共 13MB，base64 之后约 17MB，单文件就没法用了。走查页面实际只显示 382 个不同字形，子集化后 135KB，视觉上完全一致。`--no-subset-fonts` 可以关掉（文件会大到无法使用，只在你怀疑子集化漏字时才需要）。

**为什么按内容类型决定扩展名。** picsum 这类 CDN 的图片路径没有扩展名（`/seed/forest/800/600`）。没有扩展名 → data URI 没有 MIME → 浏览器拒绝渲染。脚本从响应的 `Content-Type` 反推扩展名。

**为什么本地文件名要用整条路径。** 同样因为 `/seed/<name>/800/600`：只看 basename 的话，20 张图会全部叫 `600`，互相覆盖，最后所有卡片显示同一张图。

**为什么不再保留 head 的内联脚本。** 站点只有一套「生长」皮肤，颜色由 CSS 的 `:root` 直接给出，`<html>` 上没有 `data-skin`，也就不存在需要在首屏前求值的主题引导脚本 —— 没有脚本要留。

**为什么用正则而不是 DOM parser。** 输入是构建工具产出的服务端渲染 HTML，正则够用，而且脚本能在任何 checkout 里直接跑，不需要先 `install`。

## 交互补偿

去掉 JS 运行时后，React 事件处理器会失效。对于走查必须保留的交互，用 `--inject-js` 注入一小段原生 JS 补回来。

注入的脚本在 `<body>` 末尾执行，不影响首屏。

## 参数

```
--url <url>              要快照的页面                (默认 http://localhost:3000/)
--out <file>             输出的单文件               (默认 .scratch/snapshot/page.html)
--workdir <dir>          下载缓存目录               (默认 --out 所在目录)
--max-inline-bytes <n>   超过这个大小的资源不内联    (默认 3145728)
--no-inline-images       图片保留外链
--no-subset-fonts        字体整包内联（文件极大）
--no-optimize-images     跳过 WebP 重编码
--keep-scripts           保留所有脚本（通常只会报错）
--keep-og-images         保留 og:image（file:// 下打不开）
--inject-css <file>      追加 CSS（可重复）
--inject-js <file>       追加 JS（可重复）
--timeout <ms>           单请求超时                 (默认 30000)
--cookie <value>         每个请求都带上该 Cookie 头（鉴权页面必需）
--proxy <url>            资源请求走代理               (如 http://127.0.0.1:7890)
--verbose                打印各阶段与单个资源的耗时
```

## 鉴权页面

`/submit`、`/founder/*`、`/connections`、`/talents/me/edit` 这些页面在服务端就要求登录态，未登录会 307 到 `/login`。快照只抓服务端渲染的 HTML，所以必须把 Cookie 传进去：

```bash
node scripts/html-snapshot.mjs \
  --url http://localhost:3000/founder/dashboard \
  --cookie "shenicest_token=<从浏览器复制>" \
  --out .scratch/snapshot/founder.html
```

**注意：Cookie 失效时页面会返回 200 的登录页**，快照看起来正常但内容是错的。`snapshot-all.mjs` 会检测这种情况并报警。

## 代理

图片和字体在外网，受限网络下会一直卡到超时。`--proxy` 把资源请求转发到代理，localhost 始终直连。

两个实现细节（都已处理，改动时注意）：

- Node 24 的全局 `fetch` 配 `undici` 的 `ProxyAgent` 会报 `invalid onRequestStart method`，所以走代理时改用 `undici` 自带的 `fetch`。
- `ProxyAgent` 必须显式设 `connect.timeout`，默认值会在 TLS 握手阶段就超时。

## 资源缓存

下载的资源按 URL 哈希缓存在 `--workdir/cache/`，重跑时直接复用。

这对 picsum 这类外部占位图很重要：它们不稳定，有时连不上。**第一次成功下载后，后续重建不再依赖外网。** 如果某次跑出 `could not fetch image`，等网络恢复再跑一次即可；已缓存的不会重下。

字体另有两层缓存（`cache/fonts/`、`cache/fonts-ttf/`），见下节。

## 性能：字体子集化是唯一的瓶颈

一个页面原本要 130–150 秒，其中 **95% 花在字体子集化**。实测拆解（Harmony 4MB CJK 字体）：

| 步骤 | 耗时 |
| --- | --- |
| 从 `.woff2` 直接子集化 | 49.9s |
| 其中 woff2 → ttf 解压 | 40.7s |
| 其中真正的子集化 | 0.6s |

瓶颈是 **WOFF2 解压**，不是子集化。fontTools 必须先完整 inflate 整个流才能取到任意字形，29k 字形的 CJK 字体就是 40 秒/字重。改 `--layout-features`、丢 GPOS/GSUB 都无效——实测所有变体都是 42–48 秒。

因此做了两层缓存：

1. **子集结果**（`cache/fonts/`）：key = 字体内容哈希 + 字形集合哈希。共用导航栏/页脚的页面直接命中。
2. **解压后的 TTF**（`cache/fonts-ttf/`）：key = 字体内容哈希。字形集合不同也能跳过 40 秒解压，直接 0.6 秒出结果。

效果：

| | 冷启动 | 热缓存 |
| --- | --- | --- |
| 单页 | 130–150s | 2–5s |
| 全部 11 页 | ~25 min | **28s** |

首次运行仍要付一次解压成本（约 2 分钟，5 个字重）。`cache/` 已进 `.gitignore`。

## 批量生成

```bash
# 一条命令：环境检查 + 种子数据 + 11 页 + 截图验证
powershell -File scripts/snapshot-all.ps1

# 只跑一页，带耗时日志
node scripts/snapshot-all.mjs --only 06-hackathon --verbose
```

`snapshot-all.mjs` 的页面清单在 `PAGES` 常量里，包含 `expect`（页面必须出现的文本）——用于发现空态和登录页这两种"看起来正常但内容错了"的失败。

## 依赖

| 依赖 | 用途 | 缺失时 |
| --- | --- | --- |
| Node ≥ 18 | 主流程（原生 `fetch`） | 必须 |
| Python + fonttools | 字体子集化 | 降级为整包内联，文件变大 |
| Python + Pillow | 图片 WebP 重编码 | 降级为原始编码 |
| Chrome / Edge | 截图验证 | 跳过验证 |

脚本通过 `PYTHON` 环境变量找 Python 解释器，默认 `python`。本机用 bundled runtime：

```bash
export PYTHON="C:/Users/<you>/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe"
```

## 注意

- **只对服务端渲染出来的内容生效。** 页面里依赖 `useEffect` 在客户端拉取的数据不会出现在快照里。
- **链接仍然指向 `/xxx`。** 单文件里点导航会 404，这是预期的——它是走查稿，不是可交互 demo。需要多页就把目标页面分别快照。
- **`.scratch/` 已在 `.gitignore` 里。** 快照产物不进版本库；`scripts/` 下的脚本进。
