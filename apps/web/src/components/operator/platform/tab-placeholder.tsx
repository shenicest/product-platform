import { Eyebrow } from '@/components/ui/typography'

/**
 * 平台后台尚未接入数据的 tab 的统一占位。
 *
 * 本批交付的是「赛季治理」与「主办方组织与成员」两个 tab；其余 tab（积分池总览、
 * 评委授权、评分流水与冲正、全局权限、异议、审计）先给出明确的职责说明。
 * 占位文案来自 `PLATFORM_TABS[].scope`，这样「开发中」本身也能当下一个开发者的
 * 交接说明，而不是一句干巴巴的空话（与主办方后台 `WorkInProgress` 同一做法）。
 */
export function PlatformTabPlaceholder({
  tab,
  title,
  scope,
}: {
  /** 稳定标识，用于测试与埋点，如 `points`。 */
  tab: string
  title: string
  scope: string
}) {
  return (
    <section className="ui-panel" aria-labelledby={`platform-wip-${tab}`} data-tab={tab}>
      <Eyebrow tone="accent">COMING SOON</Eyebrow>
      <h2 id={`platform-wip-${tab}`} className="mt-2 text-h3 font-bold text-foreground">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-body-sm leading-relaxed text-muted-foreground">{scope}</p>
      <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 font-mono text-meta tracking-[0.08em] text-muted-foreground">
        <span aria-hidden>◐</span> 开发中
      </p>
    </section>
  )
}
