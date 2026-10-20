'use client'

import { usePathname } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export function LayoutChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBath = pathname.startsWith('/bath')

  if (isBath) {
    return <main className="flex-1">{children}</main>
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed top-4 left-4 z-[60] bg-brand px-4 py-2 font-bold text-primary-foreground focus:not-sr-only"
      >
        跳到主要内容
      </a>
      <SiteHeader />
      <main id="main-content" className="flex-1">{children}</main>
      <SiteFooter />
    </>
  )
}
