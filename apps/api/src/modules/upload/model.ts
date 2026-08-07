import { t } from 'elysia'

// Request body for presigning a direct-to-COS upload. Only `filename` is used
// server-side (its extension selects the stored object suffix); `mime` is
// advisory. The bucket is private-write, so the browser never sees credentials —
// it only receives a short-lived, key-scoped PUT URL.
export const PresignUploadBody = t.Object({
  filename: t.String({ minLength: 1, maxLength: 255, description: 'Original filename, used to derive the object extension' }),
  mime: t.Optional(t.String({ maxLength: 255, description: 'Advisory content type of the upload' })),
})
export type PresignUploadBody = typeof PresignUploadBody.static

export const PresignUploadResponse = t.Object({
  key: t.String({ description: 'COS object key (relative to the bucket root)' }),
  url: t.String({ description: 'Pre-signed PUT URL. Upload the raw file bytes here; expires in 30 minutes' }),
  publicUrl: t.String({ description: 'Public read URL of the object once the PUT completes' }),
})
export type PresignUploadResponse = typeof PresignUploadResponse.static