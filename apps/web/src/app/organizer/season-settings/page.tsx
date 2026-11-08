import type { Metadata } from 'next'
import { WorkInProgress } from '@/components/organizer/work-in-progress'

export const metadata: Metadata = { title: '赛季设置 · 主办方后台' }

export default function OrganizerSeasonSettingsPage() {
  return (
    <WorkInProgress
      tab="season-settings"
      title="赛季设置"
      scope="赛季基础字段、赛程八个节点、类型化规则与规则卡；草稿阶段可随意修改，提交后仅管理员可调整主办方。"
    />
  )
}
