import { Eyebrow } from '@/components/ui/typography'

/**
 * 主办方后台各 tab 的统一占位。
 *
 * 本批只交付入口与外壳，tab 内容按模块逐个补齐；这里明确写出
 * “该 tab 负责什么”，这样占位本身也能当下一个开发者的交接说明，
 * 而不是一句干巴巴的“开发中”。
 */
export function WorkInProgress({
  tab,
  title,
  scope,
}: {
  /** 稳定标识，用于测试与埋点，如 `season-settings`。 */
  tab: string
  title: string
  /** 一句话说明这个 tab 未来承载什么。 */
  scope: string
}) {
  return (
    <section className="ui-panel" aria-labelledby={`wip-${tab}`} data-tab={tab}>
      <Eyebrow tone="accent">COMING SOON</Eyebrow>
      <h2 id={`wip-${tab}`} className="mt-2 text-h3 font-bold text-foreground">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-body-sm leading-relaxed text-muted-foreground">{scope}</p>
      <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 font-mono text-meta tracking-[0.08em] text-muted-foreground">
        <span aria-hidden>◐</span> 开发中
      </p>
    </section>
  )
}
