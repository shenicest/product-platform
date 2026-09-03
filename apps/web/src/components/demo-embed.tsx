'use client'

import { useState } from 'react'

export function DemoEmbed({ src, title, className }: { src: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">该产品不支持在当前页面内嵌，请打开产品 Demo 体验。</p>
        <a href={src} target="_blank" rel="noopener noreferrer" className="btn-hard btn-primary px-4 py-2 text-xs">
          打开产品 Demo <span aria-hidden>↗</span>
        </a>
      </div>
    )
  }

  return <iframe src={src} title={title} className={className} loading="lazy" onError={() => setFailed(true)} />
}
