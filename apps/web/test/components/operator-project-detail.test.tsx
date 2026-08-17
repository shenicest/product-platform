import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectStage, ProjectStatus } from '@shenicest/shared'
import { OperatorProjectDetail } from '@/components/operator/operator-project-detail'
import type { OperatorProject } from '@/server/operator'

vi.mock('@/lib/operator-api', () => ({
  approveProject: vi.fn(),
  requireProjectRevision: vi.fn(),
  rejectProject: vi.fn(),
  delistProject: vi.fn(),
  restoreProject: vi.fn(),
}))

function makeProject(overrides: Partial<OperatorProject> = {}): OperatorProject {
  return {
    id: 7786,
    userId: 'founder-1',
    status: ProjectStatus.PendingReview,
    likeCount: 0,
    name: '完整信息项目',
    tagline: '待审核的完整项目资料',
    description: '这是完整的项目介绍。',
    coverUrl: 'https://cdn.example.com/cover.png',
    demoImages: ['https://cdn.example.com/demo-1.png', 'https://cdn.example.com/demo-2.png'],
    demoVideoUrl: 'https://cdn.example.com/demo.mp4',
    demoLink: 'https://example.com/demo',
    stage: ProjectStage.MVP,
    categories: ['开发者工具'],
    targetUsers: '独立开发者',
    userProblem: '验证产品需求',
    progress: '正在内测',
    nextSteps: '扩大测试范围',
    messageToUsers: '欢迎参与体验并反馈。',
    isOpenForBeta: true,
    betaDescription: '正在招募 20 位内测用户。',
    contactName: '张三',
    contactPhone: '13800138000',
    contactEmail: 'founder@example.com',
    contactWechat: 'founder-wechat',
    teamName: '示例团队',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  } as OperatorProject
}

describe('OperatorProjectDetail', () => {
  it('shows every submitted review field, including media, user message, and beta details', () => {
    render(<OperatorProjectDetail project={makeProject()} proposals={[]} />)

    expect(screen.getByRole('img', { name: '完整信息项目封面' })).toHaveAttribute('src', 'https://cdn.example.com/cover.png')
    expect(screen.getByRole('link', { name: '访问产品链接' })).toHaveAttribute('href', 'https://example.com/demo')
    expect(screen.getByRole('link', { name: '观看演示视频' })).toHaveAttribute('href', 'https://cdn.example.com/demo.mp4')
    expect(screen.getByRole('img', { name: '完整信息项目演示图 1' })).toHaveAttribute('src', 'https://cdn.example.com/demo-1.png')
    expect(screen.getByRole('img', { name: '完整信息项目演示图 2' })).toHaveAttribute('src', 'https://cdn.example.com/demo-2.png')
    expect(screen.getByText('欢迎参与体验并反馈。')).toBeInTheDocument()
    expect(screen.getByText('正在开放内测')).toBeInTheDocument()
    expect(screen.getByText('正在招募 20 位内测用户。')).toBeInTheDocument()
  })
})
