import Image from 'next/image'
import Link from 'next/link'
import { Eyebrow } from '@/components/ui/typography'

export const metadata = { title: '致歉与声明 | 黑客松专区' }

export default function HackathonStatementPage() {
  return (
    <main className="shell shell--text py-14 sm:py-20">
      <Link
        href="/hackathon"
        className="font-mono text-meta tracking-[0.08em] text-muted-foreground transition-colors hover:text-brand-text"
      >
        &lt; 返回黑客松项目
      </Link>
      <Eyebrow className="mt-10">HACKATHON / STATEMENT</Eyebrow>
      <h1 className="mt-4 max-w-[850px] text-[clamp(2rem,5vw,4rem)] font-black leading-[1.08] tracking-[-0.045em] text-foreground">
        She Nicest 团队关于「烈变千人黑客松」活动的致歉与声明
      </h1>
      <div className="mt-10 grid gap-3">
        {[1, 2, 3].map((page) => (
          <Image
            key={page}
            src={`/letter-${page}.png`}
            alt={`致歉与声明手写信第 ${page} 页`}
            width={4493}
            height={6358}
            className="h-auto w-full rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    </main>
  )
}
