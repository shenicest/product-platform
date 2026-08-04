import { t } from 'elysia'

export const ErrorResponse = t.Object({
  error: t.Object({
    code: t.String({ description: 'Machine-readable error code, e.g. PROJECT_NOT_FOUND, INVALID_TRANSITION, FORBIDDEN' }),
    message: t.String({ description: 'Human-readable error message' }),
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
