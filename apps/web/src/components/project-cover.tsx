'use client'

import { useState } from 'react'

/**
 * 项目封面。
 *
 * 封面 URL 来自用户上传（任意域名），可能已经失效、被防盗链或返回 451；
 * 直接 <img> 会留下浏览器的破图图标。这里在 onError 时切到统一的
 * `NO COVER` 占位，保持卡片结构不跳。
 */
export function ProjectCover({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return <span className="card-cover--placeholder">NO COVER</span>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 用户提供的封面域名无法穷举
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  )
}
