import { randomUUID } from 'node:crypto'
import COS from 'cos-nodejs-sdk-v5'
import type { PresignUploadResponse } from './model'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const SECRET_ID = requiredEnv('COS_SECRET_ID')
const SECRET_KEY = requiredEnv('COS_SECRET_KEY')
const COS_BUCKET = requiredEnv('COS_BUCKET')
const COS_REGION = requiredEnv('COS_REGION')
const COS_PUBLIC_BASE_URL = requiredEnv('COS_PUBLIC_BASE_URL')
const COS_UPLOAD_PREFIX = (process.env.COS_UPLOAD_PREFIX ?? 'projects/').replace(/\/+$/, '') + '/'

// 30 minutes; long enough to cover the time between the form request and the
// eventual PUT after the browser has picked the file.
const URL_EXPIRES_SECONDS = 1800

// Extract a safe, short lowercase extension from a client-provided filename so
// the object keeps a sensible suffix without accepting arbitrary input.
function extensionOf(filename: string): string {
  const segment = filename.split('.').pop()
  return segment && /^[a-zA-Z0-9]{1,10}$/.test(segment) ? `.${segment.toLowerCase()}` : ''
}

export class UploadService {
  private readonly cos: COS
  private readonly bucket: string
  private readonly region: string
  private readonly publicBaseUrl: string
  private readonly prefix: string

  constructor() {
    this.cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY })
    this.bucket = COS_BUCKET
    this.region = COS_REGION
    this.publicBaseUrl = COS_PUBLIC_BASE_URL.replace(/\/+$/, '')
    this.prefix = COS_UPLOAD_PREFIX
  }

  // Build a per-user object key so an authenticated caller can only ever write
  // under their own namespace: <prefix>/<userId>/<yyyy>/<mm>/<ts>-<uuid><ext>.
  private buildKey(userId: string, filename: string): string {
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const stamp = now.getTime()
    return `${this.prefix}${userId}/${yyyy}/${mm}/${stamp}-${randomUUID()}${extensionOf(filename)}`
  }

  async presign(userId: string, filename: string): Promise<PresignUploadResponse> {
    const key = this.buildKey(userId, filename)
    const url = await new Promise<string>((resolve, reject) => {
      this.cos.getObjectUrl(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Method: 'PUT',
          Expires: URL_EXPIRES_SECONDS,
        },
        (err, data) => (err ? reject(err) : resolve(data.Url)),
      )
    })

    return { key, url, publicUrl: `${this.publicBaseUrl}/${key}` }
  }
}

export const uploadService = new UploadService()