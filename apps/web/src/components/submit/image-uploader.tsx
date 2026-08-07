'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { presignAndUpload, UploadError } from '@/lib/upload'

interface ImageUploaderProps {
  id: string
  value: string[]
  onChange: (value: string[]) => void
  multiple?: boolean
  max?: number
  hint?: string
}

export function ImageUploader({
  id,
  value,
  onChange,
  multiple = false,
  max = 1,
  hint,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = Math.max(0, max - value.length)
  const full = value.length >= max

  async function handleFiles(files: FileList | null) {
    const picked = Array.from(files ?? [])
    if (!picked.length) return
    setBusy(true)
    setError(null)
    const uploaded: string[] = []
    try {
      for (const file of picked.slice(0, remaining)) {
        uploaded.push(await presignAndUpload(file))
      }
      onChange([...value, ...uploaded])
    } catch (e) {
      setError(e instanceof UploadError ? e.message : '上传失败，请重试')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((url, index) => (
            <div key={url} className="group relative border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-video w-full object-cover" />
              <button
                type="button"
                aria-label="删除图片"
                onClick={() => remove(index)}
                className="absolute right-1.5 top-1.5 border border-border bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-destructive backdrop-blur transition-colors hover:bg-background"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <label
        htmlFor={id}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border bg-background/40 px-4 py-8 text-center transition-colors hover:border-primary/60',
          full && 'pointer-events-none opacity-40',
        )}
      >
        <span className="font-mono text-xs tracking-[0.08em] text-primary">
          {busy ? 'UPLOADING...' : full ? '已达上限' : value.length > 0 ? '+ 添加图片' : '+ 上传图片'}
        </span>
        <span className="text-xs text-muted-foreground">
          {multiple ? `最多 ${max} 张，单张不超过 5MB` : '单张图片，不超过 5MB'}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          multiple={multiple}
          disabled={busy || full}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {hint ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-1 font-mono text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
