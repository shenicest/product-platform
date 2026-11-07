export interface BoomlandErrorOptions {
  field?: string
  detail?: unknown
}

export class BoomlandError extends Error {
  readonly code: string
  readonly httpStatus: number
  readonly field?: string
  readonly detail?: unknown

  constructor(code: string, message: string, httpStatus = 400, options: BoomlandErrorOptions = {}) {
    super(message)
    this.name = 'BoomlandError'
    this.code = code
    this.httpStatus = httpStatus
    this.field = options.field
    this.detail = options.detail
  }
}

export function boomlandError(
  code: string,
  message: string,
  httpStatus = 400,
  options: BoomlandErrorOptions = {},
): BoomlandError {
  return new BoomlandError(code, message, httpStatus, options)
}

export function onBoomlandError({ error, set, code }: any) {
  if (error instanceof BoomlandError) {
    set.status = error.httpStatus
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
        ...(error.detail !== undefined ? { detail: error.detail } : {}),
      },
    }
  }
  if (code === 'VALIDATION') {
    set.status = 400
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: '请求参数不合法',
      },
    }
  }
}
