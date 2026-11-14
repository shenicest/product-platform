import Link from 'next/link'
import {
  applicationWindowReason,
  formatDateTime,
  seasonStatusMeta,
  type MySeasonApplication,
  type SeasonAnnouncement,
  type SeasonChallenge,
  type SeasonDetail,
} from '@/lib/boomland'
import { SeasonChallengeSection } from '@/components/boomland/season-challenge-section'
import { SeasonRulesGrid } from '@/components/boomland/season-rules-grid'
import { SeasonTimeline } from '@/components/boomland/season-timeline'
import { SeasonAnnouncements } from '@/components/boomland/v26/season-announcements'
import { SeasonPoster } from '@/components/boomland/v26/season-poster'
import { SeasonStatGrid } from '@/components/boomland/v26/season-stat-grid'

function ReviewDisclosure() {
  return (
    <details className="v26-wide-card" style={{ marginTop: 24 }}>
      <summary>
        <div>
          <h2 className="v26-wide-card__title">评审志愿者 / 利益关系</h2>
          <p className="v26-wide-card__lead">公开评审名单与身份、利益关系，确保评审公平。</p>
        </div>
        <span className="ui-btn ui-btn--secondary ui-btn--small">
          查看详情 <span aria-hidden>→</span>
        </span>
      </summary>
      <p className="v26-wide-card__body">
        评审志愿者名单、身份与利益关系披露数据待开发。
      </p>
    </details>
  )
}

function PendingCards() {
  return (
    <div className="v26-pending-grid">
      <section className="v26-pending">
        <div className="v26-pending__head">
          <h2 className="v26-pending__title">参赛项目</h2>
          <span className="v26-pending__pill">敬请期待</span>
        </div>
        <p>赛季开始后，逐步展示参赛项目与项目公开进展。</p>
      </section>

      <section className="v26-pending">
        <div className="v26-pending__head">
          <h2 className="v26-pending__title">实时成果</h2>
          <span className="v26-pending__pill">敬请期待</span>
        </div>
        <p>赛季开始后，随项目推进逐步更新真实收入与赛季贡献。</p>
      </section>
    </div>
  )
}

/**
 * 赛季详情页（设计稿 BoomLand V2.6 `#season`）。
 *
 * 结构与设计稿一一对应：
 *   面包屑 → 拼贴海报 → 四格指标 → 赛程时间轴 → 企业命题 →
 *   公告 / 赛季规则双栏 → 评审披露 → 敬请期待。
 *
 * 设计稿还有「评委公示」表格，但当前后端没有评委名单接口；这里保留原有的
 * 「评审志愿者 / 利益关系」披露入口，不伪造评委姓名与机构。
 */
export function SeasonDetailPage({
  season,
  challenges,
  announcements,
  myApplication,
  isLoggedIn,
}: {
  season: SeasonDetail
  challenges: SeasonChallenge[]
  announcements: SeasonAnnouncement[]
  myApplication: MySeasonApplication | null
  isLoggedIn: boolean
}) {
  const reason = applicationWindowReason(season)

  return (
    <div className="v26 v26-season">
      <div className="v26-shell">
        <nav className="v26-breadcrumb" aria-label="面包屑">
          <Link href="/seasons">← 火热赛季</Link>
          <span aria-hidden>/</span>
          <span>{season.name}</span>
        </nav>

        <SeasonPoster
          season={season}
          myApplication={myApplication}
          isLoggedIn={isLoggedIn}
        />

        <SeasonStatGrid season={season} challengeCount={challenges.length} />

        <section className="v26-panel v26-timeline" aria-label="完整赛程时间轴">
          <SeasonTimeline season={season} />
        </section>

        <SeasonChallengeSection challenges={challenges} />

        <div className="v26-info-columns">
          <SeasonAnnouncements announcements={announcements} />

          <section aria-labelledby="season-rules-title">
            <div className="v26-section-head">
              <h2 id="season-rules-title">赛季规则</h2>
            </div>
            <div className="v26-scroll-panel">
              <SeasonRulesGrid items={season.ruleCard} />
            </div>
          </section>
        </div>

        <div style={{ marginTop: 24 }}>
          <ReviewDisclosure />
        </div>
        <PendingCards />

        <p className="v26-muted v26-small" style={{ marginTop: 28 }}>
          报名窗口 {formatDateTime(season.applicationWindow.opensAt)} —{' '}
          {formatDateTime(season.applicationWindow.closesAt)}
          {reason ? ` · ${reason}` : ''}
          {' · '}
          赛季状态：{seasonStatusMeta(season.status).label}
        </p>
      </div>
    </div>
  )
}
