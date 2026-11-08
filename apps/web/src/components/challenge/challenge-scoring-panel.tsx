import {
  SCORING_EXCLUDED_NOTE,
  SCORING_WEIGHT_NOTE,
  scoringRuleRows,
  scoringWeightRows,
  type ChallengeDetailDto,
} from '@/lib/challenge-detail'

/**
 * 评分与奖励 tab。
 *
 * 上半部分是五维权重（条形 + 百分比），下半部分是积分口径的六行说明。
 * 权重未配置时照常显示默认引导权重，但**加一句**「本命题未单独配置」——
 * 不能让读者以为系统已经替主办方配好了。
 */
export function ChallengeScoringPanel({ challenge }: { challenge: ChallengeDetailDto }) {
  const { rows, configured } = scoringWeightRows(challenge.scoringWeights)
  const ruleRows = scoringRuleRows({
    singleWorkCap: challenge.singleWorkCap,
    season: challenge.season,
  })

  return (
    <section className="challenge-panel" aria-labelledby="challenge-scoring-title">
      <h2 id="challenge-scoring-title" className="challenge-panel__title">
        评分与奖励
      </h2>
      <p className="challenge-panel__lead">
        五个维度的权重决定评分构成；权重不是发布必填项，未配置时按默认引导权重展示。
      </p>

      <div className="challenge-weights">
        {rows.map((row) => (
          <div key={row.key} className="challenge-weight" data-dimension={row.key}>
            <div className="challenge-weight__head">
              <span className="challenge-weight__label">{row.label}</span>
              <span className="challenge-weight__value">{row.percentLabel}</span>
            </div>
            <div
              className="challenge-weight__track"
              role="img"
              aria-label={`${row.label} ${row.percentLabel}`}
            >
              <i
                className="challenge-weight__bar"
                style={{ width: `${Math.max(0, Math.min(100, row.weight))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {configured ? null : (
        <p className="challenge-panel__footnote">本命题未单独配置权重，以上为默认引导权重。</p>
      )}

      <p className="challenge-note">{SCORING_WEIGHT_NOTE}</p>

      <h3 className="challenge-panel__subtitle">积分与奖励口径</h3>
      <dl className="challenge-field-list">
        {ruleRows.map((row) => (
          <div key={row.key} className="challenge-field" data-field={row.key}>
            <dt className="challenge-field__label">{row.label}</dt>
            <dd className="challenge-field__value">{row.value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="challenge-panel__subtitle">不计分项</h3>
      <p className="challenge-panel__body">{SCORING_EXCLUDED_NOTE}</p>
    </section>
  )
}
