import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '审计 · 主办方后台' }

export default function OrganizerAuditPage() {
  return (
    <WorkInProgress
      tab="audit"
      title="审计"
      scope="按 action / target 筛选的赛季审计日志：谁在什么时候改了什么，含状态流转与关键字段的前后值。"
    />
  )
}
