export class UploadError extends Error {}

interface PresignResponse {
  key: string
  url: string
  publicUrl: string
}

const IMAGE_MAX = 5 * 1024 * 1024 // 5MB

async function requestPresign(filename: string, mime: string): Promise<PresignResponse> {
  const res = await fetch('/api/uploads/presign', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename, mime }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new UploadError(body?.error?.message ?? '获取上传地址失败，请稍后重试')
  }
  return (await res.json()) as PresignResponse
}

// Presigned direct upload: the backend returns a short-lived PUT URL scoped to
// the current user; the file bytes go straight to COS. On success we hand back
// the public URL the project row should store.
async function uploadToCos(file: File): Promise<string> {
  if (file.size > IMAGE_MAX) {
    throw new UploadError('文件大小不能超过 5MB')
  }
  if (!file.type.startsWith('image/')) throw new UploadError('仅支持上传图片文件')

  const { url, publicUrl } = await requestPresign(file.name, file.type)

  const upload = await fetch(url, {
    method: 'PUT',
    headers: file.type ? { 'content-type': file.type } : undefined,
    body: file,
  })
  if (!upload.ok) throw new UploadError('上传失败，请重试')

  return publicUrl
}

export function presignAndUpload(file: File): Promise<string> {
  return uploadToCos(file)
}
