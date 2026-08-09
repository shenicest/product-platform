import type { Metadata } from 'next'
import { getOperatorProposals } from '@/server/operator'
import { OperatorProposalsClient } from '@/components/operator/operator-proposals'
import {
  OPERATOR_PAGE_SIZE,
  parseOperatorProposalParams,
} from '@/lib/operator-filters'

export const metadata: Metadata = {
  title: '提案审核 · 运营后台',
}

export const dynamic = 'force-dynamic'

interface OperatorProposalsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OperatorProposalsPage(
  props: OperatorProposalsPageProps
) {
  const searchParams = await props.searchParams
  const params = parseOperatorProposalParams(searchParams)

  const proposals = await getOperatorProposals({
    stage: params.stage,
    category: params.category,
    offset: (params.page - 1) * OPERATOR_PAGE_SIZE,
    limit: OPERATOR_PAGE_SIZE,
  })

  return (
    <OperatorProposalsClient
      initialProposals={proposals.data}
      total={proposals.total}
      params={params}
    />
  )
}
