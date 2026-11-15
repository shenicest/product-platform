import type { Metadata } from 'next'

/**
 * 全站元数据（分享卡片 / SEO）的唯一真相源。
 *
 * 这里只回答三件事：站点叫什么、某个页面在卡片里长什么样、站点根 URL 从哪来。
 * 页面不要在各自的 `generateMetadata` 里手写 og:* —— Next 的元数据是**浅合并**：
 * 子页面一旦声明了 `openGraph`，根布局的 `openGraph` 会被整体替换（不是逐字段拼接），
 * 于是漏掉 `images` 的页面会得到一张没有封面的卡片。走 `pageMetadata()` 就不会漏。
 *
 * 分享卡片目前只做「读 meta」这一层：浏览器、Telegram、Slack 等抓取方读 `<head>`
 * 里的 og/twitter 标签；微信聊天卡片主要读 title / description / 首图，并不保证
 * 完全遵循 OG（所以每个页面都给了 description，图片也一定有兜底）。
 * 微信分享菜单若要自定义标题/封面，还需要公众号 + JS-SDK 签名，本文件不涉及。
 */

/** 站点名，用于 `og:site_name` 与标题模板。 */
export const SITE_NAME = 'Shenicest'

/** 站点默认标题（首页与无页面级标题的兜底）。 */
export const SITE_TITLE = 'Shenicest · 让好产品自然生长'

/** 站点默认描述；任何页面都必须有一句可展示的描述，否则微信卡片会退回抓正文。 */
export const SITE_DESCRIPTION = '发现、关注并支持正在被打造的早期产品。新产品，新世界。'

/** 站点语言（Open Graph 用下划线写法，不是 BCP 47 的 `zh-CN`）。 */
export const SITE_LOCALE = 'zh_CN'

/** 分享图：允许相对路径（由根布局的 `metadataBase` 补成绝对 URL）。 */
export type ShareImage = {
  url: string
  width?: number
  height?: number
  alt?: string
}

/** 站点默认分享图；页面没有自己的封面时用它。 */
export const DEFAULT_SHARE_IMAGE: ShareImage = {
  url: '/brand/og-boomland.jpg',
  width: 1200,
  height: 630,
  alt: 'Shenicest · 让好产品自然生长',
}

/**
 * 卡片描述的安全长度。微信聊天卡片的描述只显示一行左右，超长会被截断；
 * 这里统一截到 150 字并补省略号，避免出现「截在半个词上还没有省略号」。
 */
export const SHARE_DESCRIPTION_MAX_LENGTH = 150

const FALLBACK_SITE_URL = 'http://localhost:3000'

/**
 * 站点根 URL：`NEXT_PUBLIC_SITE_URL` > `SHENICEST_WEB_BASE_URL` > 本地默认值。
 *
 * 必须是线上可公网访问的正式域名（微信、Slack 等抓取方不接受 localhost），
 * 所以 `apps/web/.env.example` 里显式声明了它；漏配时分享图会变成
 * `http://localhost:3000/...`，卡片没有缩略图。
 */
export function resolveSiteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SHENICEST_WEB_BASE_URL?.trim() ||
    FALLBACK_SITE_URL
  if (!URL.canParse(raw)) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL / SHENICEST_WEB_BASE_URL is not a valid URL: ${raw}`,
    )
  }
  return new URL(raw)
}

export function truncateDescription(
  text: string,
  maxLength = SHARE_DESCRIPTION_MAX_LENGTH,
): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`
}

/** 私有页面（后台、个人中心）统一使用的「不要收录、不要生成卡片」元数据。 */
export const NO_INDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  nocache: true,
}

export type PageMetadataInput = {
  /** 页面标题，不含「 · Shenicest」后缀（由根布局的标题模板追加）。 */
  title?: string
  /** 页面描述；为空时退到站点默认描述。 */
  description?: string | null
  /** 站内绝对路径，同时用于 `canonical` 与 `og:url`，如 `/projects/12`。 */
  path: string
  /** `article` 用于详情页，列表页保持 `website`。 */
  type?: 'website' | 'article'
  /** 页面自己的封面；不传则用站点默认分享图。 */
  images?: ShareImage[]
  /** 后台/个人中心等不该被抓取、也不该出现在卡片里的页面。 */
  noIndex?: boolean
}

/**
 * 生成一个页面的完整元数据。
 *
 * 关键点：`openGraph` / `twitter` 每次都是**整体给出**（标题、描述、URL、站点名、
 * 语言、类型、图），因为 Next 只在「子页面没有声明该字段」时才继承根布局的值。
 */
export function pageMetadata({
  title,
  description,
  path,
  type = 'website',
  images,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const normalizedTitle = title?.trim()
  const shareTitle = normalizedTitle || SITE_TITLE
  const shareDescription =
    (description ? truncateDescription(description) : '') || SITE_DESCRIPTION
  const shareImages = images?.length ? images : [DEFAULT_SHARE_IMAGE]

  return {
    ...(normalizedTitle ? { title: normalizedTitle } : {}),
    description: shareDescription,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      url: path,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type,
      images: shareImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      images: shareImages.map((image) => image.url),
    },
    ...(noIndex ? { robots: NO_INDEX_ROBOTS } : {}),
  }
}
