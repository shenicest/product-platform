import { t } from 'elysia'
import { HACKATHON_CONNECTION_PURPOSES } from '@shenicest/shared'

export const CreateConnectionBody = t.Object({
  purpose: t.Union(HACKATHON_CONNECTION_PURPOSES.map((value) => t.Literal(value)) as [any, ...any[]]),
  message: t.String({ minLength: 30, maxLength: 500 }),
  wechat: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
  email: t.Optional(t.String({ minLength: 1, maxLength: 254 })),
})
export type CreateConnectionBody = typeof CreateConnectionBody.static

export const ConnectionProjectParams = t.Object({ id: t.Numeric() })
export type ConnectionProjectParams = typeof ConnectionProjectParams.static
