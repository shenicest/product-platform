import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '里程碑 · 主办方后台' }

export default function OrganizerMilestonesPage() {
  return (
    <WorkInProgress
      tab="milestones"
      title="里程碑"
      scope="赛季里程碑的定义、时间与达成状态，用于阶段推进与积分发放的触发依据。"
    />
  )
}
