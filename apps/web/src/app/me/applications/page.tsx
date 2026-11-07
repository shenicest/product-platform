import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { MyApplicationsList } from '@/components/boomland/my-applications'
import { Pagination } from '@/components/pagination'
import { EmptyState } from '@/components/ui/surface'
import { SectionHead } from '@/components/ui/typography'
import { ButtonLink } from '@/components/ui/button'
import { getMyApplications } from '@/server/boomland'
import type { SearchParams } from '@/lib/project-filters'

export const metadata = { title: '我的报名' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

export default async function MyApplicationsPage(props: { searchParams: Promise<SearchParams> }) {
  const token = (await cookies()).get('shenicest_token')?.value
  if (!token) redirect('/login?returnTo=/me/applications')

  const searchParams = await props.searchParams
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page
  const parsed = Number(rawPage ?? '1')
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
  const applied = searchParams.applied === '1'

  const list = await getMyApplications({ page, pageSize: PAGE_SIZE }).catch(() => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  }))
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize))

  return (
    <main>
      <section className="section section--flush">
        <div className="shell shell--narrow">
          <SectionHead
            eyebrow="MY / APPLICATIONS"
            title="我的报名"
            lead="你提交过的赛季报名与审核进度。通过后主办方会邀请你加入赛季微信群，组队结果以群内登记为准。"
            aside={
              <span className="section-head__aside">
                TOTAL:
                <b className="font-digits text-lg font-normal text-brand-text">{list.total}</b>
                APPLICATIONS
              </span>
            }
          />

          {applied ? (
            <p className="mb-6 rounded-md border border-brand-line bg-brand-wash px-4 py-3 text-body-sm text-brand-text">
              报名已提交，等待主办方审核。
            </p>
          ) : null}

          {list.items.length === 0 ? (
            <EmptyState
              title="NO APPLICATION"
              description="你还没有报名任何赛季。"
              action={
                <ButtonLink href="/seasons" variant="secondary">
                  去看看火热赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
                </ButtonLink>
              }
            />
          ) : (
            <MyApplicationsList items={list.items} />
          )}

          <Pagination page={list.page} totalPages={totalPages} searchParams={searchParams} basePath="/me/applications" />
        </div>
      </section>
    </main>
  )
}
