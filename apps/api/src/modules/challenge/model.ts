import { t } from 'elysia'

export const ChallengeIdParams = t.Object({
  id: t.Numeric({ description: 'Challenge ID' }),
})

export const SeasonChallengesParams = t.Object({
  id: t.Numeric({ description: 'Season ID' }),
})

export const ListSeasonChallengesQuery = t.Object({
  includeDrafts: t.Optional(t.String({ description: '"true" to include drafts' })),
})

const ChallengeTextField = t.Optional(t.Union([t.String({ minLength: 1, maxLength: 20000 }), t.Null()]))

export const CreateChallengeBody = t.Object({
  title: t.String({ minLength: 2, maxLength: 255 }),
  realProblem: ChallengeTextField,
  targetCustomer: ChallengeTextField,
  minimumDeliverable: ChallengeTextField,
  resourceCommitment: ChallengeTextField,
  resultEvidenceRules: ChallengeTextField,
})

export const UpdateChallengeBody = t.Object({
  title: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
  realProblem: ChallengeTextField,
  targetCustomer: ChallengeTextField,
  minimumDeliverable: ChallengeTextField,
  resourceCommitment: ChallengeTextField,
  resultEvidenceRules: ChallengeTextField,
})

export type CreateChallengeBody = typeof CreateChallengeBody.static
export type UpdateChallengeBody = typeof UpdateChallengeBody.static
