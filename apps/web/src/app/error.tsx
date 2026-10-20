'use client'

import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <div className="shell shell--text flex flex-col items-start py-24">
      <Eyebrow>CONNECTION INTERRUPTED</Eyebrow>
      <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">暂时无法加载此页面</h1>
      <p className="mt-4 max-w-md text-body-lg leading-[1.7] text-muted-foreground">
        我们无法取得最新内容。请检查网络连接后重新请求。
      </p>
      <Button type="button" variant="primary" onClick={reset} className="mt-8">
        重新加载 <span className="ui-btn__arrow" aria-hidden>→</span>
      </Button>
    </div>
  )
}
