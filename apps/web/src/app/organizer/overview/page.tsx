import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '总览 · 主办方后台' }

export default function OrganizerOverviewPage() {
  return (
    <WorkInProgress
      tab="overview"
      title="总览"
      scope="赛季状态、发布就绪度九项、关键时间与核心计数（报名 / 通过 / 候补 / 选手名额），以及提交、开赛、暂停、取消等状态操作。"
    />
  )
}
