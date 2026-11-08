import { challengeCardRows, type ChallengeDetailDto } from '@/lib/challenge-detail'

/**
 * 命题卡 tab。
 *
 * 十个字段的顺序由 `challengeCardRows` 决定（那里可单测）；这里只负责摆成
 * 「左标签 / 右内容」的说明列表。空值已经被兜成「待补充」，所以不会出现空白行。
 */
export function ChallengeCardPanel({ challenge }: { challenge: ChallengeDetailDto }) {
  const rows = challengeCardRows({
    background: challenge.background,
    realProblem: challenge.realProblem,
    // 契约 §1.1 的 `industry` 就是「目标客户 / 产业对象」；
    // 老的五件套字段 `targetCustomer` 作为兜底，避免旧数据整行变「待补充」。
    targetCustomer: challenge.industry ?? challenge.targetCustomer,
    scope: challenge.scope,
    outOfScope: challenge.outOfScope,
    monthlyGoal: challenge.monthlyGoal,
    suggestedSkills: challenge.suggestedSkills,
    teamCapacity: challenge.teamCapacity,
    selectedCount: challenge.selectedCount,
    capacity: challenge.capacity,
    ownerName: challenge.ownerName,
    responseSla: challenge.responseSla,
  })

  return (
    <section className="challenge-panel" aria-labelledby="challenge-card-title">
      <h2 id="challenge-card-title" className="challenge-panel__title">
        命题卡
      </h2>
      <p className="challenge-panel__lead">
        命题方对这条命题的完整说明。五件套（真实问题、目标客户、最小交付物、可提供资源、
        结果证据规则）是发布门槛，其余字段用于对齐预期。
      </p>

      <dl className="challenge-field-list">
        {rows.map((row) => (
          <div key={row.key} className="challenge-field" data-field={row.key}>
            <dt className="challenge-field__label">{row.label}</dt>
            <dd className="challenge-field__value">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
