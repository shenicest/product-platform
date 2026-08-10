import Link from 'next/link'
import { AuthNav } from '@/components/auth-nav'

export function SiteHeader() {
  return (
    <header className="hazard-edge sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-mono text-[22px] leading-none text-foreground transition-colors hover:text-primary"
        >
          SHE<span className="text-primary">NICEST</span>:
        </Link>
        <div className="flex items-center gap-8">
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/#all-projects"
              className="transition-colors hover:text-primary"
            >
              项目
            </Link>
            <Link
              href="/submit"
              className="transition-colors hover:text-primary"
            >
              提交
            </Link>
            <a
              href="/api/auth/sso-redirect"
              className="transition-colors hover:text-primary"
            >
              黑客松专区
            </a>
          </nav>
          <AuthNav />
          <p className="hidden items-center gap-2.5 font-mono text-xs sm:flex">
            <i
              aria-hidden
              className="size-2 bg-primary shadow-[0_0_12px_var(--primary)]"
            />
            <span className="text-muted-foreground">SYSTEM ONLINE</span>
            <b className="font-normal text-primary">
              {new Date().getFullYear()}
            </b>
          </p>
        </div>
      </div>
    </header>
  )
}
