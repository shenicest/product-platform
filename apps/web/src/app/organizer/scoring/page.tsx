import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '评委与积分池 · 主办方后台' }

export default function OrganizerScoringPage() {
  return (
    <WorkInProgress
      tab="scoring"
      title="评委与积分池"
      scope="积分池充值、评委额度分配与回收、核验员授权与撤销，以及已分配 / 已使用 / 未分配的实时口径。"
    />
  )
}
