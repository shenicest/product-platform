'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { ImageUploader } from '@/components/submit/image-uploader'
import { updateHackathonProject } from '@/lib/client-api'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

export function HackathonProjectEditor({ project }: {
  project: { id: number; description: string | null; coverUrl: string | null; demoLink: string | null }
}) {
  const auth = useOptionalAuth()
  const router = useRouter()
  const canEdit = auth?.user?.email?.toLowerCase().endsWith('@shenicest.cn')
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState(project.description ?? '')
  const [coverUrl, setCoverUrl] = useState(project.coverUrl ?? '')
  const [demoLink, setDemoLink] = useState(project.demoLink ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!canEdit) return null

  async function save() {
    setBusy(true)
    setError('')
    const result = await updateHackathonProject(project.id, { description: description.trim() || null, coverUrl: coverUrl.trim() || null, demoLink: demoLink.trim() || null })
    setBusy(false)
    if (result.error) { setError(result.error.body.error.message); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <section className="ui-panel mt-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Eyebrow tone="accent">EDITOR ACCESS</Eyebrow>
          <p className="mt-1 text-body-sm text-muted-foreground">你可以维护项目介绍与展示图片</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? '收起编辑' : '编辑项目'}
        </Button>
      </div>
      {open ? <div className="mt-5 space-y-5">
        <label className="ui-field">
          <span className="ui-label">项目介绍</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={8}
            maxLength={20000}
            className="ui-textarea"
          />
        </label>
        <div className="ui-field">
          <span className="ui-label">封面图片</span>
          <ImageUploader id="hackathon-cover" value={coverUrl ? [coverUrl] : []} onChange={(value) => { setCoverUrl(value[0] ?? '') }} hint="删除当前图片后可上传新封面" />
        </div>
        <label className="ui-field">
          <span className="ui-label">Demo 地址</span>
          <input
            type="url"
            value={demoLink}
            onChange={(event) => setDemoLink(event.target.value)}
            placeholder="https://example.com"
            maxLength={2048}
            className="ui-input"
          />
        </label>
        {error ? <p role="alert" className="ui-note ui-note--danger">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>取消</Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={save}>{busy ? '保存中...' : '保存修改'}</Button>
        </div>
      </div> : null}
    </section>
  )
}
