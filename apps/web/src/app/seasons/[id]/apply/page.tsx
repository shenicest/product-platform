import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { SeasonApplicationForm } from '@/components/boomland/season-application-form'
import { ApplicationStatusBadge } from '@/components/boomland/application-status-badge'
import { SeasonStatusBadge } from '@/components/boomland/season-status-badge'
import { ButtonLink } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'
import { getMySeasonApplication, getSeason } from '@/server/boomland'
import { applicationWindowReason, formatDateTime } from '@/lib/boomland'

export const metadata = { title: '报名赛季' }
export const dynamic = 'force-dynamic'

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

  return (
    <main>
      <section className="shell shell--narrow pt-10 pb-16 sm:pt-14">
        <Link
          href={`/seasons?season=${season.id}`}
          className="font-mono text-meta tracking-[0.08em] text-muted-foreground transition-colors hover:text-brand-text"
        >
          ← 返回{season.name}
        </Link>

        <header className="mt-8 border-b border-border pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow tone="accent">APPLICATION / {season.code}</Eyebrow>
            <SeasonStatusBadge status={season.status} />
          </div>
          <h1 className="page-title">报名 · {season.name}</h1>
          <p className="page-lead">
            报名窗口
            <span className="mx-2 font-mono text-foreground">
              {formatDateTime(season.applicationWindow.opensAt)} —{' '}
              {formatDateTime(season.applicationWindow.closesAt)}
            </span>
            。信息仅主办方与平台运营可见，通过后会邀请你加入赛季微信群完成组队。
          </p>
        </header>

        <div className="ui-panel mt-8">
          {myApplication && myApplication.application.status !== 'withdrawn' ? (
            <div className="grid gap-4">
              <p className="ui-panel__label">ALREADY APPLIED</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-h3 font-bold text-foreground">你已提交过报名</h2>
                <ApplicationStatusBadge status={myApplication.application.status} />
              </div>
              <p className="text-body-sm text-muted-foreground">
                提交时间 {formatDateTime(myApplication.application.createdAt)}
                {myApplication.application.status === 'withdrawn'
                  ? '，该报名已撤回，可在下方重新提交。'
                  : '。如需查看进度，请前往「我的报名」。'}
              </p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/me/applications" variant="secondary">
                  查看我的报名 <span className="ui-btn__arrow" aria-hidden>→</span>
                </ButtonLink>
              </div>
            </div>
          ) : reason ? (
            <div className="grid gap-4">
              <p className="ui-panel__label">CLOSED</p>
              <h2 className="text-h3 font-bold text-foreground">暂不可报名</h2>
              <p className="text-body-sm text-muted-foreground">{reason}</p>
              <ButtonLink href={`/seasons?season=${season.id}`} variant="secondary" className="w-fit">
                查看赛季详情 <span className="ui-btn__arrow" aria-hidden>→</span>
              </ButtonLink>
            </div>
          ) : (
            <div className="grid gap-6">
              <p className="ui-panel__label">APPLICATION FORM</p>
              <SeasonApplicationForm season={season} />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
