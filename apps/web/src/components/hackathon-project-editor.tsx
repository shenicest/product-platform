'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOptionalAuth } from '@/components/auth-provider'
import { ImageUploader } from '@/components/submit/image-uploader'
import { updateHackathonProject } from '@/lib/client-api'

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

  return <section className="mt-8 border border-primary/50 bg-card p-5">
    <div className="flex items-center justify-between gap-4">
      <div><p className="font-mono text-xs tracking-[0.12em] text-primary">EDITOR ACCESS</p><p className="mt-1 text-sm text-muted-foreground">你可以维护项目介绍与展示图片</p></div>
      <button type="button" className="detail-link detail-link-primary" onClick={() => setOpen((value) => !value)}>{open ? '收起编辑' : '编辑项目'}</button>
    </div>
    {open ? <div className="mt-5 space-y-5">
      <label className="block space-y-2"><span className="text-sm font-bold">项目介绍</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={8} maxLength={20000} className="w-full border border-border bg-background p-3 text-sm leading-7 outline-none focus:border-primary" /></label>
      <div className="space-y-2"><span className="text-sm font-bold">封面图片</span><ImageUploader id="hackathon-cover" value={coverUrl ? [coverUrl] : []} onChange={(value) => { setCoverUrl(value[0] ?? '') }} hint="删除当前图片后可上传新封面" /></div>
      <label className="block space-y-2"><span className="text-sm font-bold">Demo 地址</span><input type="url" value={demoLink} onChange={(event) => setDemoLink(event.target.value)} placeholder="https://example.com" maxLength={2048} className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary" /></label>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-3"><button type="button" className="detail-link" onClick={() => setOpen(false)}>取消</button><button type="button" className="detail-link detail-link-primary" disabled={busy} onClick={save}>{busy ? '保存中...' : '保存修改'}</button></div>
    </div> : null}
  </section>
}
