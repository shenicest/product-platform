# EdgeOne Cloud Functions

## API Proxy

`api-proxy/[[default]].js` handles `/api-proxy/*` and forwards requests to the
backend configured by the `API_URL` environment variable.

Configure this variable in the EdgeOne Makers project environment settings:

```text
API_URL=https://api.example.com
```

For example, a browser request to:

```text
POST /api-proxy/projects?draft=true
```

is forwarded to:

```text
POST https://api.example.com/projects?draft=true
```

The function forwards the request body and application/authentication headers,
including `Content-Type`, `Cookie`, and `Authorization`. The web app rewrites
its public `/api/*` requests to this local `/api-proxy/*` function in
`apps/web/next.config.ts`.
