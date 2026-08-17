import Link from 'next/link'
import { UserMenu } from '@/components/user-menu'

export function SiteHeader() {
  return (
    <header className="hazard-edge sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto grid min-h-16 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Link
          href="/"
          className="col-start-1 font-mono text-[22px] leading-none text-foreground transition-colors hover:text-primary"
        >
          SHE<span className="text-primary">NICEST</span>:
        </Link>
        <nav className="col-span-2 col-start-1 row-start-2 flex min-w-0 items-center gap-4 overflow-x-auto text-sm text-muted-foreground md:col-span-1 md:col-start-2 md:row-start-1 md:justify-end lg:gap-6">
            <Link
              href="/#all-projects"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-primary"
            >
              发现项目
            </Link>
            <Link href="/talents" className="shrink-0 whitespace-nowrap transition-colors hover:text-primary">人才广场</Link>
            <Link
              href="/following"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-primary"
            >
              我的关注
            </Link>
            <Link
              href="/hackathon"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-primary"
            >
              黑客松专区
            </Link>
        </nav>
        <div className="col-start-2 row-start-1 flex items-center gap-3 md:col-start-3 lg:gap-6">
          <Link href="/submit" className="btn-hard btn-primary shrink-0 px-3 py-2 text-xs sm:px-4">+ 提交项目</Link>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
