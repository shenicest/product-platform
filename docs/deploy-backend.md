# Backend Deployment

## Environment

```
Runtime:  Bun 1.3+
Database: MySQL 8.0+
Server:   PM2 + Nginx
```

> ⚠️ **`NODE_ENV` 必须在运行期设置，而不是只在构建期。**
>
> `bun build` 会把源码里**静态成员访问** `process.env.NODE_ENV` 替换成构建机上的值。
> 构建机上通常没有这个变量，产物里就会被固化成字面量 `false` —— 所有
> 「生产环境才这样」的分支会被整段删除（mock 登录路由、cookie 的 `Secure` 等）。
>
> 因此后端代码一律通过 `apps/api/src/lib/env.ts` 的 `env('NODE_ENV')` 读取（参数化
> 访问不会被内联），并在**运行进程**里设置 `NODE_ENV=production`（PM2 的 `--env`
> 或 `.env`）。`test/lib/env-bundle.test.ts` 会真的打包一次来守住这条规则。

## Server Setup (one-time)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Clone repo
cd /home/shenicest
git clone <repo-url> shenicest-product-platform
cd shenicest-product-platform

# Install deps & build
bun install
cd apps/api
bun run build

# Create .env on server (see .env.example for keys)
cp .env.example .env
vim .env

# NODE_ENV must be set at runtime: bun build bakes static process.env.NODE_ENV
# reads into the bundle at build time (see the Environment note above).
grep -q '^NODE_ENV=' .env || echo 'NODE_ENV=production' >> .env

# Run migrations
DATABASE_URL="mysql://shenicest:<PW>@127.0.0.1:3306/shenicest_prod" \
  bunx drizzle-kit migrate
```

## PM2

```bash
cd /home/shenicest/shenicest-product-platform/apps/api

# Start (no ecosystem.config.js needed)
pm2 start "bun dist/index.js" --name shenicest-api \
  --cwd /home/shenicest/shenicest-product-platform/apps/api \
  --max-memory-restart 512M \
  --time

# Save & auto-start on reboot
pm2 save
pm2 startup   # run the printed command
```

## Redeploy

```bash
cd /home/shenicest/shenicest-product-platform
git pull origin main

cd apps/api
bun install
bun run build

# Migrate if schema changed
DATABASE_URL="mysql://shenicest:<PW>@127.0.0.1:3306/shenicest_prod" \
  bunx drizzle-kit migrate

pm2 restart shenicest-api
pm2 logs shenicest-api --lines 10
```

## Nginx

```nginx
# /etc/nginx/sites-available/shenicest.com
server {
    listen 80;
    server_name shenicest.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name shenicest.com;

    ssl_certificate     /etc/letsencrypt/live/shenicest.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shenicest.com/privkey.pem;

    client_max_body_size 200M;

    location /platform/api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## CORS

**Elysia** — add production domains to `apps/api/src/index.ts`:
```ts
origin: [
  /\.vercel\.app$/,
  /^https?:\/\/localhost/,
  /^https?:\/\/127\.0\.0\.1/,
  /^https?:\/\/shenicest\.com$/,
  /^https?:\/\/test\.shenicest\.com$/,
]
```

**Tencent COS** — bucket `shenicest-projects-1422809617`，在控制台 安全管理 → 跨域访问 CORS 添加：

| AllowedOrigin | AllowedMethod | AllowedHeader |
|---|---|---|
| `http://localhost:3000` | PUT | `*` |
| `https://shenicest.com` | PUT | `*` |

## Verify

```bash
curl http://127.0.0.1:3000/health        # → {"status":"ok"}
curl https://shenicest.com/platform/api/health
pm2 logs shenicest-api --lines 20
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SHENICEST_JWT_SECRET required` | 确认 `.env` 存在且有该变量 |
| `COS_SECRET_ID required` | `.env` 加 COS 变量 |
| CORS error on upload | COS 控制台配置跨域规则 |
| 502 Bad Gateway | `pm2 status` 检查进程是否存活 |
| Cookie auth fails in prod | 确认 `NODE_ENV=production` |
