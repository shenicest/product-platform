import Link from 'next/link'
import { challengeStatusMeta, type SeasonChallenge } from '@/lib/boomland'

/**
 * 赛季详情页的「企业命题」区（设计稿 `.challenge-summary-card` 三列卡）。
 *
 * 卡片整张是一个 `<Link>` → `/challenges/:id`。五件套的完整内容在命题详情页，
 * 这里不提供页内展开 —— 设计稿同样只有一个「查看命题」入口。
 *
 * 与设计稿的差异：原型卡片有企业名、命题类型和「已选项目 x / y」，
 * 当前 `SeasonChallenge` 只返回标题、五件套字段、状态与版本，所以卡片
 * 只展示真实存在的信息（见 docs/boomland/design-v26-conflicts.md）。
 */
export function SeasonChallengeSection({ challenges }: { challenges: SeasonChallenge[] }) {
  return (
    <section aria-labelledby="season-challenges-title">
      <div className="v26-section-head">
        <div>
          <h2 id="season-challenges-title">企业命题</h2>
          <p className="v26-muted v26-small" style={{ marginTop: 4 }}>
            企业 / 命题方、真实问题、目标客户、验证目标与可提供资源由赛季配置。
          </p>
        </div>
      </div>

      {challenges.length ? (
        <div className="v26-challenge-grid">
          {challenges.map((challenge) => {
            const status = challengeStatusMeta(challenge.status)
            return (
              <Link
                key={challenge.id}
                href={`/challenges/${challenge.id}`}
                className="v26-challenge-card"
              >
                <span className="v26-challenge-card__head">
                  <span className="v26-challenge-card__title">{challenge.title}</span>
                  <span className="v26-challenge-card__company">
                    企业命题 · 第 {challenge.version} 版
                  </span>
                  <span className="v26-challenge-card__tags">
                    <span className="ui-chip">{status.label}</span>
                    <span className="ui-chip">公开命题</span>
                  </span>
                </span>

                <span className="v26-challenge-card__body">
                  <span>{challenge.realProblem || '命题方正在补充真实问题。'}</span>
                  {challenge.minimumDeliverable ? (
                    <span className="v26-challenge-card__target">
                      {challenge.minimumDeliverable}
                    </span>
                  ) : null}
                </span>

                <span className="v26-challenge-card__foot">
                  <span className="v26-challenge-card__meta">
                    选择本命题的项目与资源承诺以命题详情为准
                  </span>
                  <span
                    className="ui-btn ui-btn--secondary ui-btn--small"
                    style={{ justifySelf: 'start' }}
                  >
                    查看命题 <span aria-hidden>→</span>
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="v26-panel">
          <p className="v26-muted">本赛季还没有发布企业命题。</p>
        </div>
      )}
    </section>
  )
}
