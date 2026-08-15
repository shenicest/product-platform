import Link from 'next/link'

export const metadata = { title: '黑客松专区' }

export default function HackathonPage() {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">HACKATHON / LIVE</p>
          <h1 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold leading-[1.15]">
            黑客松专区
          </h1>
        </div>
        <Link
          href="https://shenicest.com/platform/projects"
          className="btn-hard btn-secondary"
          target="_blank"
          rel="noreferrer"
        >
          在新窗口打开 <span aria-hidden>↗</span>
        </Link>
      </header>

      <iframe
        src="https://shenicest.com/platform/projects"
        title="Shenicest 黑客松专区"
        className="min-h-[calc(100dvh-15rem)] w-full flex-1 border border-border bg-background"
      >
        你的浏览器不支持嵌入页面。请使用上方链接打开黑客松专区。
      </iframe>
    </section>
  )
}
