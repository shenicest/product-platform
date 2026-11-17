import { ButtonLink } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import type { SeasonSpotlight } from '@/lib/season-spotlight'

/**
 * 首页「当前赛季」入口。
 *
 * 放在首屏之后、精选项目之前：首页的主线仍然是「看项目」，但赛季是
 * 有时效的 —— 报名窗口一过，入口再显眼也没有意义。所以它需要一块
 * 独立的、比普通分区更重的版面，而不是塞进导航里的一行链接。
 *
 * 视觉上用「夜色门廊」：深墨蓝底 + 粉色光晕，与上方浅色首屏形成一次
 * 明确的空间切换；右侧的票券卡是这扇门的把手 —— 赛季编号、赛程、规模
 * 都印在票面上，正文只负责讲「这是什么」和「往哪走」。
 *
 * 整块只读，不发起任何客户端请求；没有赛季时渲染筹备态，入口依然
 * 指向 `/seasons`，所以「当前赛季」不会出现「什么都没有」的死胡同。
 */
function SeasonPass({ season }: { season: SeasonSpotlight }) {
  return (
    <aside className="season-gate__pass" aria-label={`${season.name} 赛季信息`}>
      <div className="season-gate__pass-head">
        <span className="season-gate__pass-label">SEASON PASS</span>
        <span className="season-gate__pass-code">{season.code}</span>
      </div>

      <p className="season-gate__pass-name">{season.displayName}</p>

      <dl className="season-gate__facts">
        <div className="season-gate__fact season-gate__fact--wide">
          <dt>活动</dt>
          <dd>{season.activityRange}</dd>
        </div>
        <div className="season-gate__fact season-gate__fact--wide">
          <dt>报名</dt>
          <dd>{season.registrationRange}</dd>
        </div>
        <div className="season-gate__fact">
          <dt>命题</dt>
          <dd>{season.challengeCount} 个</dd>
        </div>
        <div className="season-gate__fact">
          <dt>参与</dt>
          <dd>{season.participantLabel}</dd>
        </div>
      </dl>

      <div className="season-gate__pass-foot">
        <span className="season-gate__pass-note">{season.registrationNote}</span>
        <span className="season-gate__pass-stamp" aria-hidden>
          ✿
        </span>
      </div>
    </aside>
  )
}

function EmptyPass() {
  return (
    <aside className="season-gate__pass season-gate__pass--empty" aria-hidden>
      <div className="season-gate__pass-head">
        <span className="season-gate__pass-label">SEASON PASS</span>
        <span className="season-gate__pass-code">--</span>
      </div>

      <p className="season-gate__pass-name">下一季，正在路上</p>
      <p className="season-gate__pass-copy">
        赛季公开后，赛程、命题与报名入口会一起出现在这里。
      </p>

      <div className="season-gate__pass-foot">
        <span className="season-gate__pass-note">NO ACTIVE SEASON</span>
        <span className="season-gate__pass-stamp" aria-hidden>
          ✿
        </span>
      </div>
    </aside>
  )
}

export function CurrentSeasonGate({ season }: { season: SeasonSpotlight | null }) {
  return (
    <section className="season-gate" aria-labelledby="season-gate-title">
      <div className="shell">
        <div className={`season-gate__panel${season ? '' : ' season-gate__panel--empty'}`}>
          <div className="season-gate__copy">
            <p className="eyebrow season-gate__eyebrow">CURRENT SEASON / 当前赛季</p>

            {season ? (
              <>
                <h2 className="season-gate__title" id="season-gate-title">
                  <span className="season-gate__title-kicker">BoomLand</span>
                  <span className="season-gate__title-name">{season.displayName}</span>
                </h2>

                <p className="season-gate__lead">{season.intro}</p>

                <div className="season-gate__meta">
                  <Chip tone={season.statusTone} dot className="season-gate__status">
                    {season.statusLabel}
                  </Chip>
                  <Chip
                    tone={season.registrationTone}
                    className="season-gate__registration"
                    data-open={season.registrationOpen}
                  >
                    {season.registrationLabel}
                  </Chip>
                  <span className="season-gate__organizer">
                    {season.organizer} · {season.typeLabel}
                  </span>
                </div>

                <div className="season-gate__actions">
                  <ButtonLink
                    href={season.href}
                    variant="primary"
                    aria-label={`进入当前赛季：${season.name}`}
                  >
                    进入当前赛季{' '}
                    <span className="ui-btn__arrow" aria-hidden>
                      →
                    </span>
                  </ButtonLink>
                  <ButtonLink href="/seasons" variant="secondary">
                    查看全部赛季
                  </ButtonLink>
                </div>
              </>
            ) : (
              <>
                <h2 className="season-gate__title" id="season-gate-title">
                  <span className="season-gate__title-kicker">BoomLand</span>
                  <span className="season-gate__title-name">新一季正在筹备</span>
                </h2>

                <p className="season-gate__lead">
                  当前没有进行中的赛季。下一季开放报名后，会第一时间出现在这里。
                </p>

                <div className="season-gate__actions">
                  <ButtonLink href="/seasons" variant="primary">
                    查看火热赛季{' '}
                    <span className="ui-btn__arrow" aria-hidden>
                      →
                    </span>
                  </ButtonLink>
                </div>
              </>
            )}
          </div>

          {season ? <SeasonPass season={season} /> : <EmptyPass />}
        </div>
      </div>
    </section>
  )
}
