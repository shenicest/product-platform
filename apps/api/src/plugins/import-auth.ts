import { Elysia, status } from 'elysia'
import { sourceNameForKey } from '../lib/import-keys'
import { ErrorCode, ErrorMessage } from '../common'

// Machine-to-machine auth for the external project import endpoint. The caller
// presents its per-source secret in the `X-Api-Key` header; the macro resolves
// the secret back to a source name and injects it as `importSourceName`.
// Missing or unknown keys fail closed with 401 — the endpoint exposes no
// information about which sources exist.
export const importAuthPlugin = new Elysia({ name: 'import-auth' })
  .macro('apiKey', {
    resolve: ({ headers }) => {
      const key = headers['x-api-key']
      if (typeof key !== 'string' || key.length === 0) {
        return status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })
      }
      const sourceName = sourceNameForKey(key)
      if (!sourceName) {
        return status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })
      }
      return { importSourceName: sourceName }
    },
  })
