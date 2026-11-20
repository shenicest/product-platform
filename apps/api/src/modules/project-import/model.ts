import { t } from 'elysia'

// External import contract (machine-to-machine). Field names are snake_case to
// match typical ETL/import payloads; the service maps them onto the camelCase
// `projects` columns. `source_name` + `external_id` form the idempotency key —
// re-importing the same pair upserts rather than duplicating.
export const ImportProjectItem = t.Object({
  external_id: t.String({ minLength: 1, maxLength: 255, description: "Importer's own id for this project (unique per source)" }),
  owner_email: t.String({ minLength: 1, maxLength: 254, description: 'Owner email; looked up or created in the shared users table' }),
  owner_name: t.Optional(t.String({ maxLength: 100, description: 'Owner display name, used when the user is first created' })),
  name: t.String({ minLength: 1, maxLength: 255, description: 'Project name' }),
  tagline: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  cover_url: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
  demo_images: t.Optional(t.Union([t.Array(t.String({ maxLength: 2048 })), t.Null()])),
  demo_video_url: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
  demo_link: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
  stage: t.Optional(t.Union([t.Integer(), t.Null()], { description: 'Product stage 0-4' })),
  categories: t.Optional(t.Union([t.Array(t.String({ maxLength: 100 })), t.Null()])),
  problem_statement: t.Optional(t.Union([t.String(), t.Null()])),
  progress: t.Optional(t.Union([t.String(), t.Null()])),
  next_steps: t.Optional(t.Union([t.String(), t.Null()])),
  differentiation: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  business_model: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  team_name: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
})
export type ImportProjectItem = typeof ImportProjectItem.static

export const MAX_IMPORT_ITEMS = 20

export const ProjectImportBody = t.Object({
  source_name: t.String({ minLength: 1, maxLength: 255, description: 'The source this import belongs to (must match the API key)' }),
  projects: t.Array(ImportProjectItem, { minItems: 1, maxItems: MAX_IMPORT_ITEMS }),
})
export type ProjectImportBody = typeof ProjectImportBody.static

export const ImportFailure = t.Object({
  external_id: t.String(),
  error: t.String(),
})
export type ImportFailure = typeof ImportFailure.static

export const ProjectImportResponse = t.Object({
  imported: t.Number({ description: 'Number of newly created projects' }),
  updated: t.Number({ description: 'Number of existing projects upserted' }),
  failed: t.Array(ImportFailure, { description: 'Items rejected with a per-item reason' }),
})
export type ProjectImportResponse = typeof ProjectImportResponse.static
