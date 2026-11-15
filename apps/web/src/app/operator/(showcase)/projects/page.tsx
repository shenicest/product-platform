import type { Metadata } from 'next'
import { getOperatorProjects } from '@/server/operator'
import { OperatorProjectsClient } from '@/components/operator/operator-projects'
import {
  OPERATOR_PAGE_SIZE,
  parseOperatorProjectParams,
} from '@/lib/operator-filters'

export const metadata: Metadata = {
  title: '项目管理 · 运营后台',
}

export const dynamic = 'force-dynamic'

interface OperatorProjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OperatorProjectsPage(
  props: OperatorProjectsPageProps
) {
  const searchParams = await props.searchParams
  const params = parseOperatorProjectParams(searchParams)

  const projects = await getOperatorProjects({
    status: params.status,
    stage: params.stage,
    category: params.category,
    q: params.q,
    sort: params.sort,
    order: params.order,
    offset: (params.page - 1) * OPERATOR_PAGE_SIZE,
    limit: OPERATOR_PAGE_SIZE,
  })

  return (
    <OperatorProjectsClient
      initialProjects={projects.data}
      total={projects.total}
      params={params}
    />
  )
}
