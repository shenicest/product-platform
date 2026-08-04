export type DemoVideo =
  | { kind: 'iframe'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'link' }

const VIDEO_FILE_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v']

function youtubeEmbedId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    return url.pathname.slice(1).split('/')[0] || null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v')
    const embedMatch = url.pathname.match(/^\/embed\/([\w-]+)/)
    if (embedMatch) return embedMatch[1]
    const shortsMatch = url.pathname.match(/^\/shorts\/([\w-]+)/)
    if (shortsMatch) return shortsMatch[1]
  }
  return null
}

function bilibiliEmbedSrc(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'bilibili.com' && host !== 'm.bilibili.com') return null
  const bvid = url.pathname.match(/\/video\/(BV[\w]+)/)?.[1]
  if (!bvid) return null
  return `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0`
}

// User-provided demo video URLs may point to embeddable platforms, direct
// video files, or arbitrary pages. Only render embedded players when we know
// the URL is embeddable; otherwise fall back to a plain link so the page
// never shows a broken player.
export function resolveDemoVideo(rawUrl: string): DemoVideo {
  if (!URL.canParse(rawUrl)) return { kind: 'link' }
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'link' }
  }

  const youtubeId = youtubeEmbedId(url)
  if (youtubeId) {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtubeId}` }
  }

  const bilibiliSrc = bilibiliEmbedSrc(url)
  if (bilibiliSrc) return { kind: 'iframe', src: bilibiliSrc }

  const path = url.pathname.toLowerCase()
  if (VIDEO_FILE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return { kind: 'video', src: rawUrl }
  }

  return { kind: 'link' }
}
