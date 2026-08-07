'use client'

import { useRef, useState } from 'react'
import { presignAndUploadVideo, UploadError } from '@/lib/upload'

interface VideoUploaderProps {
  id: string
  value: string
  onChange: (value: string) => void
  hint?: string
}

export function VideoUploader({ id, value, onChange, hint }: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const publicUrl = await presignAndUploadVideo(file)
      onChange(publicUrl)
    } catch (e) {
      setError(e instanceof UploadError ? e.message : '上传失败，请重试')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative border border-border bg-muted">
          <video src={value} controls className="aspect-video w-full object-contain" />
          <button
            type="button"
            aria-label="删除视频"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1.5 border border-border bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-destructive backdrop-blur transition-colors hover:bg-background"
          >
            删除
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border bg-background/40 px-4 py-8 text-center transition-colors hover:border-primary/60"
        >
          <span className="font-mono text-xs tracking-[0.08em] text-primary">
            {busy ? 'UPLOADING...' : '+ 上传演示视频'}
          </span>
          <span className="text-xs text-muted-foreground">单个视频，不超过 200MB</span>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="video/*"
            disabled={busy}
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      )}
      {hint ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-1 font-mono text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
