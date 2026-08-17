import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const secret = process.env.SHENICEST_CONTACT_ENCRYPTION_KEY
if (!secret || secret.length < 32) {
  throw new Error('SHENICEST_CONTACT_ENCRYPTION_KEY must be at least 32 characters')
}
const key = createHash('sha256').update(secret).digest()

export function encryptContact(value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptContact<T>(value: string): T {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as T
}
