import { Eyebrow } from '@/components/ui/typography'
import { PENDING_TAB_COPY } from '@/lib/challenge-detail'

/**
 * 待开发 tab 的占位（结果与证据 / 命题报告）。
 *
 * 复用主办方 `WorkInProgress` 的视觉语言（COMING SOON + 虚线胶囊），
 * 但文案写清这一 tab 未来承载什么 —— 占位本身也是交接说明。
 */
export function ChallengePendingPanel({ tab }: { tab: 'evidence' | 'report' }) {
  const copy = PENDING_TAB_COPY[tab]
  return (
    <section className="challenge-panel" aria-labelledby={`challenge-pending-${tab}`} data-tab={tab}>
      <Eyebrow tone="accent">COMING SOON</Eyebrow>
      <h2 id={`challenge-pending-${tab}`} className="challenge-panel__title mt-2">
        {copy.title}
      </h2>
      <p className="challenge-panel__body">{copy.scope}</p>
      <p className="challenge-pending__pill">
        <span aria-hidden>◐</span> 待开发
      </p>
    </section>
  )
}
