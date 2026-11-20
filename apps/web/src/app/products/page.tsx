import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/surface'
import { SectionHead } from '@/components/ui/typography'
import { FilterBar } from '@/components/filter-bar'
import { Pagination } from '@/components/pagination'
import { ProjectCard } from '@/components/project-card'
import { getLiveProjects } from '@/server/projects'
import {
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
} from '@/lib/project-filters'

export const metadata: Metadata = {
  title: '产品共生',
  description: 'BoomLand 产品共生：长期项目库，参加赛季的项目与所有人提交的产品都在这里。',
  alternates: { canonical: '/products' },
}

export const dynamic = 'force-dynamic'

/**
 * 产品共生（长期项目库）。
 *
 * 复用首页已有的项目卡、筛选与分页，不再造一套列表。长期项目不区分
 * 是否参加过赛季；孵化中的产品、参加赛季的项目和线下活动产出的作品
 * 都可以在这里被浏览。人才与线下活动入口继续复用 /talents 与 /hackathon。
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const { category, stage, q, sort, page } = parseListParams(params)
  const { data: projects, total } = await getLiveProjects({
    category,
    stage,
    q,
    sort,
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  })

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = hasActiveFilters({ category, stage, q, sort })

  return (
    <main>
      <section className="section section--flush">
        <div className="shell">
          <SectionHead
            eyebrow="PRODUCT COMMONS / 产品共生"
            title="长期项目库"
            lead="参加赛季的项目、所有人提交的产品，以及从线下活动里长出来的作品，都在这里持续更新。"
            aside={
              <ButtonLink href="/submit" variant="primary">
                提交产品 <span className="ui-btn__arrow" aria-hidden>→</span>
              </ButtonLink>
            }
          />

          <div className="product-commons__shells">
            <Link href="/talents" className="product-commons__shell">
              <span className="eyebrow">PEOPLE / 培养中的创作者</span>
              <strong>共鸣之地 · 人才库</strong>
              <span>技能、合作状态、赛季经历与正在寻找的机会。</span>
            </Link>
            <Link href="/hackathon" className="product-commons__shell">
              <span className="eyebrow">OFFLINE / 线下活动作品</span>
              <strong>黑客松 · 城市站</strong>
              <span>城市站、现场冲刺与线下活动产出的项目与作品。</span>
            </Link>
          </div>

          <div className="mt-8">
            <FilterBar />
          </div>

          {projects.length === 0 ? (
            <EmptyState
              title="NO PRODUCT"
              description={
                filtered
                  ? '没有符合筛选条件的产品，试试调整筛选条件'
                  : '产品共生里还没有公开项目'
              }
              action={
                filtered ? (
                  <ButtonLink href="/products" variant="secondary">
                    清除筛选 <span className="ui-btn__arrow" aria-hidden>→</span>
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/submit" variant="primary">
                    提交第一个产品
                  </ButtonLink>
                )
              }
            />
          ) : (
            <>
              <p className="product-commons__total">
                TOTAL
                <b className="font-digits">{total}</b>
                PRODUCTS
              </p>
              <div className="card-grid">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} searchParams={params} />
            </>
          )}
        </div>
      </section>
    </main>
  )
}
