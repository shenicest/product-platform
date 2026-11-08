import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '预算与结算 · 主办方后台' }

export default function OrganizerBudgetPage() {
  return (
    <WorkInProgress
      tab="budget"
      title="预算与结算"
      scope="预算版本（每次追加都留痕并标明当前有效版本）与赛季结算口径、获奖主体与发放记录。"
    />
  )
}
