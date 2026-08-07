import { Elysia } from 'elysia'
import { authPlugin } from '../../plugins/auth'
import { ErrorResponse } from '../../common'
import { uploadService } from './service'
import { PresignUploadBody, PresignUploadResponse } from './model'

export const uploadModule = new Elysia()
  .use(authPlugin)
  .model({
    PresignUploadBody,
    PresignUploadResponse,
  })
  .prefix('model', 'Upload.')
  .post('/uploads/presign', async ({ user, body }) => {
    return uploadService.presign(user.userId, body.filename)
  }, {
    auth: true,
    detail: {
      summary: 'Get a pre-signed COS upload URL',
      description:
        'Returns a pre-signed PUT URL the browser can upload an image to directly on Tencent COS (the bucket is private-write, public-read), plus the final public URL. The object key is scoped under the authenticated user so a caller can only ever write to their own folder.',
      tags: ['Upload'],
      operationId: 'upload.presign',
    },
    body: 'Upload.PresignUploadBody',
    response: {
      200: 'Upload.PresignUploadResponse',
      401: ErrorResponse,
    },
  })