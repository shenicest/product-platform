# EdgeOne Cloud Functions

This directory is deployed together with `apps/web`.

`api/[[default]].js` handles `/api/*` requests that are not handled by the
Next.js app and forwards them to the backend configured by the `API_URL`
environment variable.

Configure this variable in the EdgeOne Makers project environment settings:

```text
API_URL=https://test.shenicest.com/product-api/
```

For example, `/api/health` is forwarded to:

```text
https://test.shenicest.com/product-api/health
```
