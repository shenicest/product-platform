import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import { LayoutChrome } from '@/components/layout-chrome'
import { SpeedInsights } from '@vercel/speed-insights/next'

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SHENICEST_WEB_BASE_URL ??
      'http://localhost:3000',
  ),
  title: {
    default: 'Shenicest · 让好产品自然生长',
    template: '%s · Shenicest',
  },
  description: '发现、关注并支持正在被打造的早期产品。新产品，新世界。',
  openGraph: {
    title: 'Shenicest · 让好产品自然生长',
    description: '发现、关注并支持正在被打造的早期产品。',
    images: [{ url: '/brand/og-boomland.jpg', width: 1200, height: 630 }],
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
      className={`${harmony.variable} ${monocraft.variable} ${dseg7.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <AuthProvider>
          <LayoutChrome>{children}</LayoutChrome>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
