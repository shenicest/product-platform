import { t } from 'elysia'

export const OrgIdParams = t.Object({
  id: t.Numeric({ description: 'Organizer org ID' }),
})

export const OrgMemberParams = t.Object({
  id: t.Numeric({ description: 'Organizer org ID' }),
  userId: t.String({ description: 'User ID' }),
})

export const CreateOrgBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
})

export const AddMemberBody = t.Object({
  userId: t.String({ minLength: 1, maxLength: 255 }),
})
