'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function HackathonCover({ url, name, projectId, className = '', priority = false }: {
  url: string | null
  name: string
  projectId: number
  className?: string
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const showFallback = !url || failed

  return (
    <div className={cn('card-cover', className)}>
      {showFallback ? (
        <div className="card-cover--placeholder p-4" aria-label={`${name} 默认封面`}>
          <span className="max-w-full break-words text-center text-lg font-black leading-tight text-brand-text">
            {name || '未命名项目'}
          </span>
          <span className="mono">
            NO COVER · G001 / {String(projectId).padStart(4, '0')}
          </span>
        </div>
      ) : (
        // Remote event assets are not limited to a known image host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

export function HackathonDetailCover({ url, name, className = '' }: {
  url: string | null
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return null

  return (
    // Remote event assets are not limited to a known image host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={url}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
