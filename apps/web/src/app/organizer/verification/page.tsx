import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '核验与异议 · 主办方后台' }

export default function OrganizerVerificationPage() {
  return (
    <WorkInProgress
      tab="verification"
      title="核验与异议"
      scope="作品与积分结果的核验队列，以及选手提出的异议处理与复核结论记录。"
    />
  )
}
