import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__row">
        <span className="site-footer__status">
          <i aria-hidden className="site-footer__dot" />
          <span>SHE NICEST · 产品生长之地</span>
          <span className="text-subtle-foreground">/ {new Date().getFullYear()}</span>
        </span>

        <span className="site-footer__links">
          <Link href="/privacy">隐私</Link>
          <Link href="/terms">条款</Link>
          <Link href="/hackathon/statement">活动声明</Link>
          <a href="#main-content">回到顶部 ↑</a>
        </span>
      </div>
    </footer>
  )
}
