'use client'

import { useState } from 'react'

export function HackathonCover({ url, name, projectId, track, className = '' }: {
  url: string | null
  name: string
  projectId: number
  track: string | null
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const showFallback = !url || failed

  return (
    <div className={`hackathon-cover ${showFallback ? 'hackathon-cover-fallback' : ''} ${className}`}>
      {showFallback ? (
        <div className="hackathon-cover-placeholder" aria-label={`${name} 默认封面`}>
          <span className="hackathon-cover-name">{name || '未命名项目'}</span>
          <div><strong>NO COVER</strong><span>G001 / {String(projectId).padStart(4, '0')}</span></div>
        </div>
      ) : (
        // Remote event assets are not limited to a known image host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} onError={() => setFailed(true)} />
      )}
      <span className={`track-label ${track ?? 'software'}`}>{(track || 'software').toUpperCase()}</span>
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
    <img className={className} src={url} alt={name} onError={() => setFailed(true)} />
  )
}
