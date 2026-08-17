import Link from 'next/link'
import { UserMenu } from '@/components/user-menu'

export function SiteHeader() {
  return (
    <header className="hazard-edge sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-mono text-[22px] leading-none text-foreground transition-colors hover:text-primary"
        >
          SHE<span className="text-primary">NICEST</span>:
        </Link>
        <div className="flex min-w-0 items-center gap-3 lg:gap-6">
          <nav className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm text-muted-foreground lg:gap-6">
            <Link
              href="/#all-projects"
              className="transition-colors hover:text-primary"
            >
              发现项目
            </Link>
            <Link href="/talents" className="whitespace-nowrap transition-colors hover:text-primary">人才广场</Link>
            <Link
              href="/following"
              className="whitespace-nowrap transition-colors hover:text-primary"
            >
              我的关注
            </Link>
            <Link
              href="/hackathon"
              className="whitespace-nowrap transition-colors hover:text-primary"
            >
              黑客松专区
            </Link>
          </nav>
          <Link href="/submit" className="btn-hard btn-primary shrink-0 px-3 py-2 text-xs sm:px-4">+ 提交项目</Link>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
