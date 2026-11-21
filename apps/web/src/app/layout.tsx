import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import { DemoUserSwitcher } from '@/components/dev/demo-user-switcher'
import { MockUserSwitcher } from '@/components/dev/mock-user-switcher'
import { LayoutChrome } from '@/components/layout-chrome'
import {
  DEFAULT_SHARE_IMAGE,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TITLE,
  resolveSiteUrl,
} from '@/lib/site-metadata'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { DEMO_MODE } from '@/lib/demo-mode'

const harmony = localFont({
  src: [
    { path: '../fonts/HarmonySN-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/HarmonySN-700.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/HarmonySN-900.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-harmony',
  display: 'swap',
  fallback: ['PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
  adjustFontFallback: false,
})

const monocraft = localFont({
  src: '../fonts/Monocraft-400.woff2',
  variable: '--font-monocraft',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  adjustFontFallback: false,
})

const dseg7 = localFont({
  src: '../fonts/DSEG7-400.woff2',
  variable: '--font-dseg7',
  display: 'swap',
  preload: false,
  fallback: ['monospace'],
  adjustFontFallback: false,
})

/**
 * 首屏 tagline 的衬线字（设计稿用的是思源宋体 / Noto Serif SC Regular）。
 *
 * 这是按 tagline 实际用到的 16 个字符裁出来的子集（2.7KB），不是完整字库 ——
 * 完整思源宋体有数 MB，而这一行是固定的营销文案。改文案时必须按新字符重新
 * 生成子集（Google Fonts 的 `text=` 接口即可），否则新字会掉到系统宋体兜底。
 * 兜底栈保留 Songti SC / SimSun，保证子集缺字时仍是宋体而不是无衬线。
 */
const coverSerif = localFont({
  src: '../fonts/NotoSerifSC-400.woff2',
  weight: '400',
  variable: '--font-cover-serif',
  display: 'swap',
  preload: false,
  fallback: ['unset','Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'SimSun', 'serif'],
  adjustFontFallback: false,
})

/**
 * 站点级元数据只负责「默认值 + 模板」：标题模板、语言、默认描述、默认分享图。
 *
 * 页面级的 `openGraph` / `twitter` 一律由 `lib/site-metadata.ts` 的 `pageMetadata()`
 * 整体给出 —— Next 的合并是浅合并，子页面声明了 `openGraph` 就会整体替换这里，
 * 所以不要把「图片」「站点名」当成会被继承的公共字段来用。
 */
export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    // 首页卡片：分享出去是「Shenicest · 让好产品自然生长」+ 品牌图。
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    type: 'website',
    images: [DEFAULT_SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SHARE_IMAGE.url],
  },
}

export const viewport: Viewport = {
  // 只有「生长」一套浅色皮肤，所以只有一个主题色（= --boom-cloud-1）。
  // 之前这里按 prefers-color-scheme 分了两档，第二档是已删除的夜空皮肤底色。
  themeColor: '#F8FBFF',
}

/**
 * 站点只有一套「生长」皮肤，颜色全部由 styles/skins/boomland.css 提供，
 * 因此不需要首屏引导脚本，也没有 `data-skin` 属性 —— 省掉一次内联脚本
 * 求值，也不会再出现「闪一下别的配色」。
 */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="zh-CN"
      data-scroll-behavior="smooth"
      className={`${harmony.variable} ${monocraft.variable} ${dseg7.variable} ${coverSerif.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <AuthProvider>
          <LayoutChrome>{children}</LayoutChrome>
          {/* 演示模式用不依赖 API /mock/* 的身份切换器；否则仍用本地 mock 切换器。 */}
          {DEMO_MODE ? <DemoUserSwitcher /> : <MockUserSwitcher />}
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
