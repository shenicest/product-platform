import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-2 px-4 py-7 font-mono text-[11px] tracking-[0.04em] text-muted-foreground sm:flex-row sm:px-6">
        <span>SHE NICEST PRODUCT PLATFORM / V0.1</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <span>发现正在被打造的早期产品</span>
          <Link href="/privacy" className="transition-colors hover:text-primary">隐私</Link>
          <Link href="/terms" className="transition-colors hover:text-primary">条款</Link>
          <a href="#main-content" className="transition-colors hover:text-primary">回到顶部</a>
        </span>
      </div>
    </footer>
  )
}
