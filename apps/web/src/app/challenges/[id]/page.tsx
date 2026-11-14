import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { ChallengeDetailAside } from '@/components/challenge/challenge-detail-aside'
import { ChallengeDetailHeader } from '@/components/challenge/challenge-detail-header'
import { ChallengeDetailTabs } from '@/components/challenge/challenge-detail-tabs'
import { ChallengeCardPanel } from '@/components/challenge/challenge-card-panel'
import { ChallengePendingPanel } from '@/components/challenge/challenge-pending-panel'
import { ChallengeResourcesPanel } from '@/components/challenge/challenge-resources-panel'
import { ChallengeRightsPanel } from '@/components/challenge/challenge-rights-panel'
import { ChallengeScoringPanel } from '@/components/challenge/challenge-scoring-panel'
import { EmptyState } from '@/components/ui/surface'
import { getChallengeDetail } from '@/server/challenge-detail'

export const dynamic = 'force-dynamic'

const DESCRIPTION_MAX_LENGTH = 150

function parseChallengeId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`
}

/**
 * 取数：404 → `null`（页面 `notFound()`），其它失败 → 抛错由页面降级成空态。
 * `getChallengeDetail` 内部有 `cache()`，metadata 与页面各调一次不会重复请求。
 */
async function loadChallenge(rawId: string) {
  const id = parseChallengeId(rawId)
  if (id === null) return { status: 'missing' as const }
  try {
    const challenge = await getChallengeDetail(id)
    return challenge ? { status: 'ok' as const, challenge } : { status: 'missing' as const }
  } catch {
    return { status: 'failed' as const }
  }
}

export async function generateMetadata(
  props: PageProps<'/challenges/[id]'>,
): Promise<Metadata> {
  const { id } = await props.params
  const result = await loadChallenge(id)
  if (result.status !== 'ok') return { title: '命题不可用' }

  const { challenge } = result
  const description = challenge.summary
    ? truncate(challenge.summary, DESCRIPTION_MAX_LENGTH)
    : challenge.realProblem
      ? truncate(challenge.realProblem, DESCRIPTION_MAX_LENGTH)
      : undefined

  return {
    title: challenge.title || '命题',
    description,
    openGraph: {
      title: challenge.title || '命题',
      description,
      type: 'article',
    },
  }
}

export default async function ChallengeDetailPage(props: PageProps<'/challenges/[id]'>) {
  const { id } = await props.params
  const result = await loadChallenge(id)
  if (result.status === 'missing') notFound()

  const isLoggedIn = Boolean((await cookies()).get('shenicest_token')?.value)

  // 后端正在并行实现这些字段（契约 §3.1），接口短暂 500 时**不**把整页变成错误页：
  // 保留赛季外壳与返回入口，只让内容区降级。
  if (result.status === 'failed') {
    return (
      <div className="v26 v26-challenge-page">
        <div className="v26-shell challenge-page">
          <p className="challenge-crumb">BOOMLAND / CHALLENGES</p>
          <EmptyState
            title="LOAD FAILED"
            description="命题暂时无法加载，请稍后重新打开这条命题。"
            action={
              <Link href="/seasons" className="ui-btn ui-btn--secondary">
                回到赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const { challenge } = result

  const panels = [
    { key: 'card', content: <ChallengeCardPanel challenge={challenge} /> },
    { key: 'resources', content: <ChallengeResourcesPanel challenge={challenge} /> },
    { key: 'evidence', content: <ChallengePendingPanel tab="evidence" /> },
    { key: 'scoring', content: <ChallengeScoringPanel challenge={challenge} /> },
    { key: 'rights', content: <ChallengeRightsPanel challenge={challenge} /> },
    { key: 'report', content: <ChallengePendingPanel tab="report" /> },
  ]

  return (
    <div className="v26 v26-challenge-page">
      <div className="v26-shell challenge-page">
        <nav className="challenge-crumb" aria-label="面包屑">
          <Link href={`/seasons/${challenge.seasonId}`}>BOOMLAND / 赛季</Link>
          <span aria-hidden> / </span>
          <span>CHALLENGE {challenge.id}</span>
        </nav>

        <ChallengeDetailHeader challenge={challenge} />

        <div className="challenge-layout">
          <div className="challenge-main">
            <ChallengeDetailTabs panels={panels} />
          </div>
          <ChallengeDetailAside challenge={challenge} isLoggedIn={isLoggedIn} />
        </div>
      </div>
    </div>
  )
}
