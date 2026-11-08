import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '命题与资源 · 主办方后台' }

export default function OrganizerChallengesPage() {
  return (
    <WorkInProgress
      tab="challenges"
      title="命题与资源"
      scope="命题五件套的创建与发布（真实问题、目标客户、最小交付、资源投入、结果证据），以及资源承诺的跟踪。"
    />
  )
}
