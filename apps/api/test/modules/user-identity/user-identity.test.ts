import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { eq } from 'drizzle-orm'
import { db } from '../../../src/db'
import { userIdentities } from '../../../src/db/schema'
import { userIdentityModule } from '../../../src/modules/user-identity'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { Role } from '../../../src/modules/user-identity/model'
import { authHeaders, signToken } from '../../fixtures/auth'

const OPERATOR_USER = `test-operator-${crypto.randomUUID()}`
const REGULAR_USER = `test-regular-${crypto.randomUUID()}`

function createApp() {
  return new Elysia().use(userIdentityModule)
}

describe('UserIdentity routes', () => {
  const app = createApp()
  const service = new UserIdentityService(db)

  beforeAll(async () => {
    await service.grantRole(OPERATOR_USER, Role.Operator)
    await service.grantRole(REGULAR_USER, Role.Founder)
  })

  afterAll(async () => {
    await db.delete(userIdentities).where(eq(userIdentities.userId, OPERATOR_USER))
    await db.delete(userIdentities).where(eq(userIdentities.userId, REGULAR_USER))
  })

  describe('GET /identity/roles', () => {
    it('returns 401 without token', async () => {
      const res = await app.handle(new Request('http://localhost/identity/roles'))
      expect(res.status).toBe(401)
    })

    it('returns roles for authenticated user', async () => {
      const token = await signToken({ user_id: REGULAR_USER })
      const res = await app.handle(
        new Request('http://localhost/identity/roles', { headers: authHeaders(token) }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.roles).toContain(Role.Founder)
      expect(body.roles).not.toContain(Role.Operator)
    })
  })

  describe('GET /identity/users/:userId/roles', () => {
    it('returns 401 without token', async () => {
      const res = await app.handle(
        new Request(`http://localhost/identity/users/${REGULAR_USER}/roles`),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 for non-operator', async () => {
      const token = await signToken({ user_id: REGULAR_USER })
      const res = await app.handle(
        new Request(`http://localhost/identity/users/${OPERATOR_USER}/roles`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns roles for operator querying another user', async () => {
      const token = await signToken({ user_id: OPERATOR_USER })
      const res = await app.handle(
        new Request(`http://localhost/identity/users/${REGULAR_USER}/roles`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.roles).toContain(Role.Founder)
    })
  })
})
