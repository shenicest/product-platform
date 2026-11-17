import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SeasonAgreementPage } from '@/components/boomland/season-agreement'
import { NO_INDEX_ROBOTS, pageMetadata } from '@/lib/site-metadata'
import { getSeason } from '@/server/boomland'

export const dynamic = 'force-dynamic'

/**
 * 赛季协议与规则卡公开页。
 *
 * 数据只取一次 `GET /seasons/:id`（`getSeason` 有 `cache()`）：协议正文
 * （`agreementContent`）与规则卡（`ruleCard`）都在同一个详情响应里。
 * 未公开 / 不存在的赛季一律 404 —— 与赛季详情页同一口径，避免草稿的
 * 协议正文被猜 id 读到。
 */
export async function generateMetadata(
  props: PageProps<'/seasons/[id]/agreement'>,
): Promise<Metadata> {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) return { title: '赛季不可用', robots: NO_INDEX_ROBOTS }
  const season = await getSeason(Number(rawId)).catch(() => null)
  if (!season) return { title: '赛季不可用', robots: NO_INDEX_ROBOTS }

  return pageMetadata({
    title: `${season.name} · 协议与规则卡`,
    description: `查看 ${season.name} 的赛季协议（${season.agreementVersion}）与规则卡。`,
    path: `/seasons/${season.id}/agreement`,
    type: 'article',
  })
}

export default async function SeasonAgreementRoute(
  props: PageProps<'/seasons/[id]/agreement'>,
) {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) notFound()
  const season = await getSeason(Number(rawId)).catch(() => null)
  if (!season) notFound()

  return <SeasonAgreementPage season={season} />
}
