import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface BoomlandContact {
  wechat?: string
  phone?: string
}

interface EncryptedContact {
  v: 1
  iv: string
  tag: string
  data: string
}

const rawKey = process.env.BOOMLAND_CONTACT_KEY
if (!rawKey) {
  throw new Error('BOOMLAND_CONTACT_KEY environment variable is required')
}
const key = Buffer.from(rawKey, 'base64')
if (key.length !== 32) {
  throw new Error('BOOMLAND_CONTACT_KEY must be a base64-encoded 32-byte key')
}

const AAD = Buffer.from('boomland-contact:v1')

export function encryptBoomlandContact(value: BoomlandContact): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(AAD)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  const payload: EncryptedContact = {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  }
  return JSON.stringify(payload)
}

export function decryptBoomlandContact(value: string): BoomlandContact {
  const payload = JSON.parse(value) as EncryptedContact
  if (payload.v !== 1) {
    throw new Error(`Unsupported BoomLand contact payload version: ${String(payload.v)}`)
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'))
  decipher.setAAD(AAD)
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(plain.toString('utf8')) as BoomlandContact
}
