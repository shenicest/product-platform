import type { Metadata } from 'next'
import { getOperatorStats } from '@/server/operator'
import { OperatorDashboard } from '@/components/operator/operator-dashboard'

export const metadata: Metadata = {
  title: '运营后台',
  description: '平台运营管理面板：项目审核、提案管理、数据统计。',
}

export const dynamic = 'force-dynamic'

export default async function OperatorPage() {
  const stats = await getOperatorStats()

  return <OperatorDashboard stats={stats} />
}
