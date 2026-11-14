import { formatDate, type SeasonAnnouncement } from '@/lib/boomland'

/**
 * 赛季详情页左栏「公告」（设计稿 `.season-announcements-scroll`）。
 *
 * 公告来自 `GET /seasons/:id/announcements`，按发布时间倒序。设计稿里每条
 * 公告前有一个「未读」红点，但后端没有已读状态，所以这里不画红点 ——
 * 不把「未读」做成假的状态。
 */
export function SeasonAnnouncements({
  announcements,
}: {
  announcements: SeasonAnnouncement[]
}) {
  const items = [...announcements].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  )

  return (
    <section aria-labelledby="season-announcements-title">
      <div className="v26-section-head">
        <h2 id="season-announcements-title">公告</h2>
        {items.length > 0 ? (
          <span className="v26-muted v26-small">共 {items.length} 条</span>
        ) : null}
      </div>

      <div className="v26-scroll-panel" tabIndex={0} role="region" aria-label="赛季公告">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={item.id} className="v26-announcement">
              <h3>{item.title}</h3>
              <p>{item.content}</p>
              <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
            </article>
          ))
        ) : (
          <p className="v26-announcement v26-muted">本赛季还没有发布公告。</p>
        )}
      </div>
    </section>
  )
}
