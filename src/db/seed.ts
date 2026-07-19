import { db } from './index'
import { UserIdentityService } from '../modules/user-identity/service'
import { Role } from '../modules/user-identity/model'

const OPERATOR_USER_ID = process.env.OPERATOR_USER_ID ?? 'operator-001'

async function seed() {
  const service = new UserIdentityService(db)
  await service.grantRole(OPERATOR_USER_ID, Role.Operator)
  console.log(`Seeded operator role for user: ${OPERATOR_USER_ID}`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
