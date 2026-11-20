import Link from 'next/link'
import { WORKSPACE_ACTIVITIES } from '@/lib/season-workspace'

/**
 * 首页赛季动态长条。
 *
 * 横向无缝循环：同一组事件渲染两遍，轨道整体左移 50% 后立刻回到起点，
 * 视觉上不会出现空白。悬停/聚焦暂停，减少动态偏好下改为静态横向滚动。
 */
export function SeasonActivityTicker() {
  const items = WORKSPACE_ACTIVITIES

  return (
    <section className="activity-ticker" aria-label="赛季实时动态">
      <span className="activity-ticker__label">
        <span className="activity-ticker__pulse" aria-hidden />
        LIVE FEED
      </span>

      <div className="activity-ticker__viewport">
        <div className="activity-ticker__track">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="activity-ticker__group"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {items.map((item) => (
                <span className="activity-ticker__item" key={`${copy}-${item.id}`}>
                  <span className="activity-ticker__dot" aria-hidden />
                  <span>{item.text}</span>
                  <span className="activity-ticker__time">{item.time}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Link href="/seasons/1" className="activity-ticker__more">
        赛季动态 <span aria-hidden>→</span>
      </Link>
    </section>
  )
}
