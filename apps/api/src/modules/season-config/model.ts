import { t } from 'elysia'

export const SeasonConfigParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
})

export const AllocationParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
  allocationId: t.Numeric({ description: 'Allocation ID' }),
})

export const VerifierParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
  userId: t.String({ minLength: 1 }),
})

export const AddBudgetBody = t.Object({
  totalAmount: t.Integer({ minimum: 1 }),
  reason: t.String({ minLength: 6, maxLength: 255 }),
})

export const AddPointsBody = t.Object({
  addPoints: t.Integer({ minimum: 1 }),
})

export const CreateAllocationBody = t.Object({
  scorerUserId: t.String({ minLength: 1 }),
  amount: t.Integer({ minimum: 1 }),
})

export const ReclaimBody = t.Object({
  reason: t.String({ minLength: 2, maxLength: 1000 }),
})

export const GrantVerifierBody = t.Object({
  userId: t.String({ minLength: 1 }),
})

export const RevokeVerifierBody = t.Object({
  reason: t.String({ minLength: 2, maxLength: 1000 }),
})

export type AddBudgetBody = typeof AddBudgetBody.static
export type CreateAllocationBody = typeof CreateAllocationBody.static
