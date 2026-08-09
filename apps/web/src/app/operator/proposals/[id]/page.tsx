import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOperatorProposals, getOperatorProject } from '@/server/operator'
import { OperatorProposalDetail } from '@/components/operator/operator-proposal-detail'

export const dynamic = 'force-dynamic'

function parseProposalId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await props.params
  const proposalId = parseProposalId(id)
  if (proposalId === null) return { title: '提案不可用' }
  return { title: `提案 #${proposalId} · 审核` }
}

export default async function OperatorProposalDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const proposalId = parseProposalId(id)
  if (proposalId === null) notFound()

  const proposalsResult = await getOperatorProposals({ limit: 1000 })
  const proposal = proposalsResult.data.find((p) => p.id === proposalId)
  if (!proposal) notFound()

  let project = null
  try {
    project = await getOperatorProject(proposal.projectId)
  } catch {
    // project may not be loadable; we still show the proposal
  }

  return (
    <div>
      <header className="mb-8">
        <p className="eyebrow">PROPOSAL / #{proposalId}</p>
        <h2 className="mt-3 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
          提案审核
        </h2>
      </header>
      <OperatorProposalDetail proposal={proposal} project={project} />
    </div>
  )
}
