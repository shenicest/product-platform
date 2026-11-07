import { describe, expect, it } from 'bun:test'
import {
  decryptBoomlandContact,
  encryptBoomlandContact,
} from '../../../src/lib/boomland-contact-encryption'

describe('BoomLand contact encryption', () => {
  it('round-trips wechat and phone inside the documented JSON envelope', () => {
    const encrypted = encryptBoomlandContact({ wechat: 'wx-boomland', phone: '13800000000' })
    const payload = JSON.parse(encrypted) as { v: number; iv: string; tag: string; data: string }

    expect(payload.v).toBe(1)
    expect(Object.keys(payload).sort()).toEqual(['data', 'iv', 'tag', 'v'])
    expect(Buffer.from(payload.iv, 'base64')).toHaveLength(12)
    expect(Buffer.from(payload.tag, 'base64')).toHaveLength(16)
    expect(decryptBoomlandContact(encrypted)).toEqual({
      wechat: 'wx-boomland',
      phone: '13800000000',
    })
  })

  it('supports a single contact channel', () => {
    expect(decryptBoomlandContact(encryptBoomlandContact({ wechat: 'wx-only' }))).toEqual({
      wechat: 'wx-only',
    })
  })

  it('rejects tampered ciphertext', () => {
    const payload = JSON.parse(encryptBoomlandContact({ phone: '13800000000' })) as {
      data: string
    }
    payload.data = Buffer.alloc(16, 0).toString('base64')
    expect(() => decryptBoomlandContact(JSON.stringify(payload))).toThrow()
  })
})
