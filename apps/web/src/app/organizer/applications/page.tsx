import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '报名审核 · 主办方后台' }

export default function OrganizerApplicationsPage() {
  return (
    <WorkInProgress
      tab="applications"
      title="报名审核"
      scope="报名队列与筛选（状态 / 可见性 / 关键词），查看完整报名材料并按接受、待定、候补、拒绝流转；名额满时自动进入候补。"
    />
  )
}
