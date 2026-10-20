import type { Metadata } from 'next'
import {
  getOperatorFeaturedProjects,
  getOperatorProjects,
} from '@/server/operator'
import { OperatorFeaturedProjectsClient } from '@/components/operator/operator-featured-projects'

export const metadata: Metadata = {
  title: '精选项目 · 运营后台',
}

export const dynamic = 'force-dynamic'

export default async function OperatorFeaturedPage() {
  const [featured, liveProjects] = await Promise.all([
    getOperatorFeaturedProjects(),
    getOperatorProjects({ status: 3, limit: 100 }),
  ])

  return (
    <OperatorFeaturedProjectsClient
      initialFeatured={featured.data}
      liveProjects={liveProjects.data}
    />
  )
}
