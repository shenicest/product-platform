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
    coverUrl: 'https://cdn.example.com/cover.png',
    demoImages: ['https://cdn.example.com/demo-1.png', 'https://cdn.example.com/demo-2.png'],
    demoVideoUrl: 'https://cdn.example.com/demo.mp4',
    demoLink: 'https://example.com/demo',
    stage: ProjectStage.Mvp,
    categories: ['开发者工具'],
    problemStatement: '独立开发者缺少低成本的接口监控方案。',
    progress: '正在内测',
    nextSteps: '扩大测试范围',
    differentiation: '粘贴 URL 即可开始监控。',
    businessModel: '按监控点数订阅。',
    userCount: 120,
    monthlyRevenue: 3000,
    retentionRate: 42,
    seekingSkills: ['后端开发'],
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
  it('shows every submitted review field, including media, contact, and beta details', () => {
    render(<OperatorProjectDetail project={makeProject()} proposals={[]} />)

    expect(screen.getByRole('img', { name: '完整信息项目封面' })).toHaveAttribute('src', 'https://cdn.example.com/cover.png')
    expect(screen.getByRole('link', { name: '访问产品链接' })).toHaveAttribute('href', 'https://example.com/demo')
    expect(screen.getByRole('link', { name: '观看演示视频' })).toHaveAttribute('href', 'https://cdn.example.com/demo.mp4')
    expect(screen.getByRole('img', { name: '完整信息项目演示图 1' })).toHaveAttribute('src', 'https://cdn.example.com/demo-1.png')
    expect(screen.getByRole('img', { name: '完整信息项目演示图 2' })).toHaveAttribute('src', 'https://cdn.example.com/demo-2.png')
    expect(screen.getByText('13800138000')).toBeInTheDocument()
    expect(screen.getByText('founder@example.com')).toBeInTheDocument()
    expect(screen.getByText('founder-wechat')).toBeInTheDocument()
    expect(screen.getByText('正在开放内测')).toBeInTheDocument()
    expect(screen.getByText('正在招募 20 位内测用户。')).toBeInTheDocument()
  })

  it('shows the traction metric bar with formatted values', () => {
    render(<OperatorProjectDetail project={makeProject()} proposals={[]} />)

    expect(screen.getByText('用户数')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('月收入')).toBeInTheDocument()
    expect(screen.getByText('¥3,000')).toBeInTheDocument()
    expect(screen.getByText('留存率')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('renders no traction metrics when all three are null', () => {
    render(
      <OperatorProjectDetail
        project={makeProject({ userCount: null, monthlyRevenue: null, retentionRate: null })}
        proposals={[]}
      />,
    )

    expect(screen.queryByText('用户数')).not.toBeInTheDocument()
    expect(screen.queryByText('月收入')).not.toBeInTheDocument()
    expect(screen.queryByText('留存率')).not.toBeInTheDocument()
  })
})
