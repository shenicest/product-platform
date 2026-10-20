'use client'

import { useRef, useState } from 'react'
import { presignAndUpload, UploadError } from '@/lib/upload'
import { ChipButton } from '@/components/ui/chip'
import { useFieldGroupDescription } from './form-fields'

interface ImageUploaderProps {
  id: string
  value: string[]
  onChange: (value: string[]) => void
  multiple?: boolean
  max?: number
  hint?: string
}

/**
 * 相册上传。
 *
 * 整块区域就是一个 `<label htmlFor={id}>`，所以点击缩略区任意位置都能唤起
 * 文件选择器（原生行为，不需要 JS 转发点击）。真正的 `<input type="file">`
 * 视觉隐藏但保留在无障碍树里，其 `aria-describedby` / `aria-invalid`
 * 由外层 FormField 通过 context 下发。
 */
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
  const groupDescription = useFieldGroupDescription()

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

  const errorId = error ? `${id}-upload-error` : undefined

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((url, index) => (
            <div key={url} className="group relative overflow-hidden rounded-md border border-border bg-muted">
              {/* 用户上传的地址是任意的，next/image 的 remotePatterns 无法穷举。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-video w-full object-cover" />
              <ChipButton
                tone="danger"
                aria-label="删除图片"
                onClick={() => remove(index)}
                className="absolute right-1.5 top-1.5"
              >
                删除
              </ChipButton>
            </div>
          ))}
        </div>
      ) : null}

      <label
        htmlFor={id}
        className="ui-dropzone"
        // 满额后不能继续上传。input 本身已 disabled（浏览器不会为 disabled 的
        // 控件唤起文件选择器），这里再用 aria-disabled 让禁用样式生效。
        aria-disabled={full ? true : undefined}
      >
        {/* 文案不写死颜色：.ui-dropzone 自带 fg-muted → 品牌色的 hover/focus
            过渡，子元素只要继承即可。注意不要用 .mono / text-muted-foreground，
            它们会自带 color 从而盖掉这个状态变化。 */}
        <span className="font-mono text-meta font-bold">
          {busy ? 'UPLOADING...' : full ? '已达上限' : value.length > 0 ? '+ 添加图片' : '+ 上传图片'}
        </span>
        <span className="text-body-sm">
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
          aria-describedby={[
            hint ? `${id}-upload-hint` : null,
            errorId,
            groupDescription['aria-describedby'],
          ].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : groupDescription['aria-invalid']}
        />
      </label>
      {hint ? (
        <p id={`${id}-upload-hint`} className="ui-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ui-field-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
