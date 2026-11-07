import { SeasonChallengeSection } from '@/components/boomland/season-challenge-section'
import { SeasonHero } from '@/components/boomland/season-hero'
import { SeasonRulesGrid } from '@/components/boomland/season-rules-grid'
import { SeasonTimeline } from '@/components/boomland/season-timeline'
import type {
  MySeasonApplication,
  SeasonChallenge,
  SeasonDetail,
} from '@/lib/boomland'

function ReviewDisclosure() {
  return (
    <details className="season-wide-card">
      <summary>
        <div>
          <h2 className="season-wide-card__title">评审志愿者 / 利益关系</h2>
          <p className="season-wide-card__lead">
            公开评审名单与身份、利益关系，确保评审公平。
          </p>
        </div>
        <span className="season-detail-btn">
          查看详情 <span aria-hidden>→</span>
        </span>
      </summary>
      <p className="season-wide-card__body">
        评审志愿者名单、身份与利益关系披露数据待开发。
      </p>
    </details>
  )
}

function PendingCards() {
  return (
    <div className="season-pending-grid">
      <section className="season-pending">
        <div className="season-pending__head">
          <h2 className="season-pending__title">参赛项目</h2>
          <span className="season-pending__pill">敬请期待</span>
        </div>
        <p className="season-pending__text">
          赛季开始后，逐步展示参赛项目与项目公开进展。
        </p>
      </section>

      <section className="season-pending">
        <div className="season-pending__head">
          <h2 className="season-pending__title">实时成果</h2>
          <span className="season-pending__pill">敬请期待</span>
        </div>
        <p className="season-pending__text">
          赛季开始后，随项目推进逐步更新真实收入与赛季贡献。
        </p>
      </section>
    </div>
  )
}

export function SeasonDetailPage({
  season,
  challenges,
  myApplication,
  isLoggedIn,
}: {
  season: SeasonDetail
  challenges: SeasonChallenge[]
  myApplication: MySeasonApplication | null
  isLoggedIn: boolean
}) {
  return (
    <div className="season-page">
      <SeasonHero
        season={season}
        isLoggedIn={isLoggedIn}
        myApplication={myApplication}
      />

      <div className="shell">
        <SeasonTimeline season={season} />
        <SeasonRulesGrid items={season.ruleCard} />
        <SeasonChallengeSection challenges={challenges} />
        <ReviewDisclosure />
        <PendingCards />
      </div>
    </div>
  )
}
