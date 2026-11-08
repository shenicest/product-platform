import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '人工拉群 · 主办方后台' }

export default function OrganizerManualGroupPage() {
  return (
    <WorkInProgress
      tab="manual-group"
      title="人工拉群"
      scope="选手名单与微信群状态流转（未邀请 / 已邀请 / 已加入 / 邀请失败），支持重新邀请与登记入群时间。"
    />
  )
}
