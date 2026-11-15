import type { Metadata } from 'next'
import { getOperatorAuditRecords } from '@/server/operator'
import { OperatorAuditRecordsClient } from '@/components/operator/operator-audit-records'
import {
  OPERATOR_PAGE_SIZE,
  parseAuditRecordParams,
} from '@/lib/operator-filters'

export const metadata: Metadata = {
  title: '审计记录 · 运营后台',
}

export const dynamic = 'force-dynamic'

interface OperatorAuditRecordsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OperatorAuditRecordsPage(
  props: OperatorAuditRecordsPageProps
) {
  const searchParams = await props.searchParams
  const params = parseAuditRecordParams(searchParams)

  const records = await getOperatorAuditRecords({
    projectId: params.projectId,
    from: params.from,
    to: params.to,
    offset: (params.page - 1) * OPERATOR_PAGE_SIZE,
    limit: OPERATOR_PAGE_SIZE,
  })

  return (
    <OperatorAuditRecordsClient
      initialRecords={records.data}
      total={records.total}
      params={params}
    />
  )
}
