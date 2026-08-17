import { describe, expect, test } from 'bun:test'
import { decryptContact, encryptContact } from '../../../src/lib/contact-encryption'

describe('connection contact encryption', () => {
  test('round trips contact data without storing plaintext', () => {
    const contact = { wechat: 'wx-example', email: 'person@example.com' }
    const encrypted = encryptContact(contact)
    expect(encrypted).not.toContain('wx-example')
    expect(encrypted).not.toContain('person@example.com')
    expect(decryptContact<typeof contact>(encrypted)).toEqual(contact)
  })
})
