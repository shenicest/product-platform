import {
  RIGHTS_FOOTNOTE,
  challengeRightsRows,
  type ChallengeDetailDto,
} from '@/lib/challenge-detail'

/**
 * 公开与权益 tab。
 *
 * 七项**分开**展示（CHG-006：先明示再签）。任何把它们合并成一段自由文本的做法
 * 都会让某一项在公开页里消失，所以这里逐行渲染，空值写「待补充」。
 */
export function ChallengeRightsPanel({ challenge }: { challenge: ChallengeDetailDto }) {
  const rows = challengeRightsRows({
    rightsPublicScope: challenge.rightsPublicScope,
    rightsConfidentiality: challenge.rightsConfidentiality,
    rightsIp: challenge.rightsIp,
    rightsEnterpriseUsage: challenge.rightsEnterpriseUsage,
    rightsProcurement: challenge.rightsProcurement,
    rightsSpecialTerms: challenge.rightsSpecialTerms,
    rightsExclusivity: challenge.rightsExclusivity,
  })

  return (
    <section className="challenge-panel" aria-labelledby="challenge-rights-title">
      <h2 id="challenge-rights-title" className="challenge-panel__title">
        公开与权益
      </h2>
      <p className="challenge-panel__lead">
        项目选择本命题前需要先看清的七项约定。参与即视为已知悉；需要签署的另行签署。
      </p>

      <dl className="challenge-field-list">
        {rows.map((row) => (
          <div key={row.key} className="challenge-field" data-field={row.key}>
            <dt className="challenge-field__label">{row.label}</dt>
            <dd className="challenge-field__value">{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="challenge-panel__footnote">{RIGHTS_FOOTNOTE}</p>
    </section>
  )
}
