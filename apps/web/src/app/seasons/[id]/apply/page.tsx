import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { SeasonApplicationForm } from '@/components/boomland/season-application-form'
import { ApplicationStatusBadge } from '@/components/boomland/application-status-badge'
import { SeasonStatusBadge } from '@/components/boomland/season-status-badge'
import { ButtonLink } from '@/components/ui/button'
import { getMySeasonApplication, getSeason } from '@/server/boomland'
import { applicationWindowReason, formatDateTime } from '@/lib/boomland'

export const metadata = { title: '报名赛季' }
export const dynamic = 'force-dynamic'

/**
 * 报名表单页（设计稿 `#apply`）。
 *
 * 视觉：900px 单栏、顶部返回链接 + 大标题、说明提示条、白底表单面板、
 * 两列字段网格、右下角操作区。字段与提交逻辑完全沿用原来的
 * `SeasonApplicationForm`，这里只换外壳与分区标题。
 *
 * 三种状态保持原样：
 *   · 已提交过 → 展示状态与「查看我的报名」；
 *   · 报名未开放 / 已截止 → 提示条 + 说明面板；
 *   · 可报名 → 表单。
 */
export default async function SeasonApplyPage(props: PageProps<'/seasons/[id]/apply'>) {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) notFound()
  const seasonId = Number(rawId)

  const token = (await cookies()).get('shenicest_token')?.value
  if (!token) redirect(`/login?returnTo=/seasons/${seasonId}/apply`)

  const season = await getSeason(seasonId).catch(() => null)
  if (!season) notFound()

  const myApplication = await getMySeasonApplication(seasonId).catch(() => null)
  const reason = applicationWindowReason(season)
  const alreadyApplied =
    myApplication && myApplication.application.status !== 'withdrawn'

  return (
    <main className="v26 v26-apply">
      <div className="v26-shell v26-shell--narrow">
        <Link href={`/seasons/${season.id}`} className="v26-apply__back">
          <span aria-hidden>←</span> 返回 {season.name}
        </Link>

        <header className="v26-apply__head">
          <div>
            <span className="v26-eyebrow">APPLICATION / {season.code}</span>
            <SeasonStatusBadge status={season.status} />
          </div>
          <h1>报名 · {season.name}</h1>
          <p>
            报名窗口
            <span style={{ color: 'var(--v26-ink)', fontWeight: 600 }}>
              {' '}
              {formatDateTime(season.applicationWindow.opensAt)} —{' '}
              {formatDateTime(season.applicationWindow.closesAt)}{' '}
            </span>
            。信息仅主办方与平台运营可见，通过后会邀请你加入赛季微信群完成组队。
          </p>
        </header>

        {reason && !alreadyApplied ? (
          <p className="v26-notice" role="status">
            <span aria-hidden>ⓘ</span>
            {reason}
          </p>
        ) : null}

        {alreadyApplied ? (
          <section className="v26-form-panel" aria-labelledby="already-applied-title">
            <h2 id="already-applied-title" className="v26-form-panel__title">
              你已提交过报名
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <ApplicationStatusBadge status={myApplication.application.status} />
              <span className="v26-muted v26-small">
                提交时间 {formatDateTime(myApplication.application.createdAt)}
              </span>
            </div>
            <p className="v26-muted" style={{ marginTop: 14, fontSize: 13 }}>
              无需重复报名，可以在「我的报名」查看审核进度
              {myApplication.application.status === 'withdrawn'
                ? '；该报名已撤回，可在下方重新提交。'
                : '。'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
              <ButtonLink href="/me/applications" variant="secondary">
                查看我的报名 <span className="ui-btn__arrow" aria-hidden>→</span>
              </ButtonLink>
              <ButtonLink href={`/seasons/${season.id}`} variant="ghost">
                返回赛季详情
              </ButtonLink>
            </div>
          </section>
        ) : reason ? (
          <section className="v26-form-panel" aria-labelledby="closed-title">
            <h2 id="closed-title" className="v26-form-panel__title">
              暂不可报名
            </h2>
            <p className="v26-muted" style={{ fontSize: 13, lineHeight: 1.8 }}>
              {reason}。你可以先查看赛季详情与命题，报名开放后会在赛季页给出入口。
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
              <ButtonLink href={`/seasons/${season.id}`} variant="secondary">
                查看赛季详情 <span className="ui-btn__arrow" aria-hidden>→</span>
              </ButtonLink>
            </div>
          </section>
        ) : (
          <section className="v26-form-panel" aria-labelledby="application-form-title">
            <h2 id="application-form-title" className="v26-form-panel__title">
              个人报名表
            </h2>
            <SeasonApplicationForm season={season} />
          </section>
        )}
      </div>
    </main>
  )
}
