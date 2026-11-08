'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import {
  challengeStatusMeta,
  type SeasonChallenge,
} from '@/lib/boomland'

const FIVE_PIECE = [
  { key: 'realProblem', label: '真实问题' },
  { key: 'targetCustomer', label: '目标客户' },
  { key: 'minimumDeliverable', label: '最小交付物' },
  { key: 'resourceCommitment', label: '可提供资源' },
  { key: 'resultEvidenceRules', label: '结果证据规则' },
] as const

/**
 * 火热赛季页的「企业命题」区。
 *
 * 两种入口并存，但**不嵌套**：
 *   · 卡片本身就是链接（`<Link>` 包整张卡）→ `/challenges/<id>`；
 *   · 「查看详情」是页面级的展开/收起（`<button>`），展开的是下方的
 *     五件套摘要块，与卡片链接没有任何 DOM 嵌套关系 ——
 *     `<a>` 里套 `<button>` 在键盘和读屏里都是坏结构。
 */
export function SeasonChallengeSection({
  challenges,
}: {
  challenges: SeasonChallenge[]
}) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()

  return (
    <section className="season-section">
      <div className="season-section__head">
        <div>
          <h2 className="season-section__title">企业命题</h2>
          <p className="season-section__lead">
            企业 / 命题方、真实问题、目标客户、验证目标与可提供资源由赛季配置。
          </p>
        </div>
        {challenges.length ? (
          <button
            type="button"
            className="season-detail-btn"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? '收起详情' : '查看详情'}
            <span aria-hidden>{expanded ? '↑' : '→'}</span>
          </button>
        ) : null}
      </div>

      {challenges.length ? (
        <div className="season-challenge-grid">
          {challenges.map((challenge) => {
            const status = challengeStatusMeta(challenge.status)
            return (
              <Link
                key={challenge.id}
                href={`/challenges/${challenge.id}`}
                className="season-challenge challenge-card-link"
              >
                <div className="season-challenge__top">
                  <span className="season-challenge__type">企业命题</span>
                  <span className="season-challenge__status">{status.label}</span>
                </div>
                <h3 className="season-challenge__title">{challenge.title}</h3>
                <div className="season-challenge__foot">
                  <span className="season-challenge__host">
                    公开命题 · v{challenge.version}
                  </span>
                  <span className="season-challenge__desc">
                    公开评审名单与身份、利益关系，确保评审公平。
                  </span>
                </div>
                <span className="challenge-card-link__go" aria-hidden>
                  查看命题 <span>→</span>
                </span>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="season-challenge">
          <p className="season-section__lead">本赛季还没有发布企业命题。</p>
        </div>
      )}

      {expanded ? (
        <div id={detailsId} className="season-challenge-details">
          {challenges.map((challenge) => (
            <article key={challenge.id} className="season-challenge-detail">
              <h3 className="season-challenge-detail__title">{challenge.title}</h3>
              <dl className="season-challenge-detail__grid">
                {FIVE_PIECE.map((field) => (
                  <div key={field.key} className="season-challenge-detail__field">
                    <dt>{field.label}</dt>
                    <dd>{challenge[field.key] || '待补充'}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href={`/challenges/${challenge.id}`}
                className="challenge-card-link__detail"
              >
                打开命题详情 <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
