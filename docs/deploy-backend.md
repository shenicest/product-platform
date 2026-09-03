# Backend Deployment

## Environment

```
Runtime:  Bun 1.3+
Database: MySQL 8.0+
Server:   PM2 + Nginx
```

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

# Run migrations
DATABASE_URL="mysql://shenicest:<PW>@127.0.0.1:3306/shenicest_prod" \
  bunx drizzle-kit migrate
```

## PM2

```bash
cd /home/shenicest/shenicest-product-platform/apps/api

# Start (no ecosystem.config.js needed)
pm2 start "bun dist/index.js" --name shenicest-api \
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
