'use client'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="eyebrow">CONNECTION INTERRUPTED</p>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">暂时无法加载此页面</h1>
      <p className="mt-4 max-w-md text-base leading-[1.7] text-muted-foreground">
        我们无法取得最新内容。请检查网络连接后重新请求。
      </p>
      <button type="button" onClick={reset} className="btn-hard btn-primary mt-8">
        重新加载 <span aria-hidden>→</span>
      </button>
    </div>
  )
}
