import { t } from 'elysia'

export const ErrorResponse = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
})
export type ErrorResponse = typeof ErrorResponse.static

export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const

export const ErrorMessage: Record<keyof typeof ErrorCode, string> = {
  UNAUTHORIZED: 'Missing or invalid authentication token',
  FORBIDDEN: 'Insufficient permissions',
}
