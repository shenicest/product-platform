import { afterAll, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { db } from '../../../src/db'
import { userIdentities } from '../../../src/db/schema'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { Role } from '../../../src/modules/user-identity/model'

const TEST_USER = `test-user-${crypto.randomUUID()}`

describe('UserIdentityService', () => {
  const service = new UserIdentityService(db)

  afterAll(async () => {
    await db.delete(userIdentities).where(eq(userIdentities.userId, TEST_USER))
  })

  it('grants a role and hasRole returns true', async () => {
    await service.grantRole(TEST_USER, Role.Founder)
    expect(await service.hasRole(TEST_USER, Role.Founder)).toBe(true)
  })

  it('hasRole returns false for non-granted role', async () => {
    expect(await service.hasRole(TEST_USER, Role.Operator)).toBe(false)
  })

  it('duplicate grant is idempotent — no error, no duplicate row', async () => {
    await service.grantRole(TEST_USER, Role.Founder)
    await service.grantRole(TEST_USER, Role.Founder)
    const roles = await service.getRoles(TEST_USER)
    expect(roles.filter((r) => r === Role.Founder)).toHaveLength(1)
  })

  it('getRoles returns all granted roles', async () => {
    await service.grantRole(TEST_USER, Role.Operator)
    const roles = await service.getRoles(TEST_USER)
    expect(roles).toContain(Role.Founder)
    expect(roles).toContain(Role.Operator)
    expect(roles).toHaveLength(2)
  })

  it('getRoles returns empty array for user with no roles', async () => {
    const roles = await service.getRoles(`no-roles-${crypto.randomUUID()}`)
    expect(roles).toEqual([])
  })
})
