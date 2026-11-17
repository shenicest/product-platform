import Link from 'next/link'
import { SeasonStatus } from '@shenicest/shared'
import { agreementParagraphs } from '@/lib/season-agreement'
import {
  formatDateTime,
  seasonStatusMeta,
  type SeasonDetail,
} from '@/lib/boomland'
import { SeasonRulesGrid } from '@/components/boomland/season-rules-grid'
import { Chip } from '@/components/ui/chip'

/**
 * 赛季协议与规则卡公开页（`/seasons/:id/agreement`）。
 *
 * 报名表单的「我已阅读并同意本赛季协议与规则卡」勾选项链到这里，所以页面
 * 同时承担两件事：
 *   1. 协议正文 —— `seasons.agreement_content`，主办方在后台录入；
 *   2. 规则卡 —— 与赛季详情页同一份 `ruleCard`（必要项由赛季配置生成）。
 *
 * 正文为空时不编造法律文本：只提示尚未填写，规则卡照常展示。
 */
export function SeasonAgreementPage({ season }: { season: SeasonDetail }) {
  const paragraphs = agreementParagraphs(season.agreementContent)
  const status = seasonStatusMeta(season.status)
  const canApply = season.status !== SeasonStatus.Cancelled && season.status !== SeasonStatus.Suspended

  return (
    <main className="v26 v26-agreement">
      <div className="v26-shell v26-shell--narrow">
        <nav className="v26-breadcrumb" aria-label="面包屑">
          <Link href={`/seasons/${season.id}`}>← {season.name}</Link>
          <span aria-hidden>/</span>
          <span>协议与规则卡</span>
        </nav>

        <header className="v26-apply__head">
          <div>
            <span className="v26-eyebrow">AGREEMENT / {season.code}</span>
            <Chip tone={status.tone}>{status.label}</Chip>
          </div>
          <h1>本赛季协议与规则卡</h1>
          <p>
            {season.name} · 协议版本 <strong>{season.agreementVersion}</strong> · 规则卡版本{' '}
            <strong>{season.rulesVersion}</strong>。报名即表示你已阅读并同意以下协议与规则。
          </p>
        </header>

        <section className="v26-form-panel" aria-labelledby="agreement-content-title">
          <h2 id="agreement-content-title" className="v26-form-panel__title">
            赛季协议
          </h2>
          {paragraphs.length > 0 ? (
            <div className="v26-agreement-body">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="v26-notice" role="status">
              <span aria-hidden>ⓘ</span>
              主办方还没有填写协议正文。报名前请以赛季公告、规则卡与主办方说明为准。
            </p>
          )}
        </section>

        <section className="v26-form-panel v26-agreement-rules" aria-labelledby="agreement-rules-title">
          <h2 id="agreement-rules-title" className="v26-form-panel__title">
            规则卡
          </h2>
          <p className="v26-muted v26-small v26-agreement-rules__lead">
            规则卡由赛季配置生成，与赛季详情页展示的内容一致；主办方可以在赛季设置里调整必要条目之外的说明。
          </p>
          <SeasonRulesGrid items={season.ruleCard} />
        </section>

        <div className="v26-agreement-foot">
          {canApply ? (
            <Link href={`/seasons/${season.id}/apply`} className="ui-btn ui-btn--primary">
              去报名 <span aria-hidden>→</span>
            </Link>
          ) : null}
          <Link href={`/seasons/${season.id}`} className="ui-btn ui-btn--secondary">
            返回赛季详情
          </Link>
          <span className="v26-muted v26-small">
            协议版本 {season.agreementVersion} · 赛季更新于 {formatDateTime(season.updatedAt)}
          </span>
        </div>
      </div>
    </main>
  )
}
