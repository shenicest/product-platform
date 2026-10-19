import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectStage } from '@shenicest/shared'
import { ProjectDetail } from '@/components/project-detail'
import type { ProjectDetail as ProjectDetailData } from '@/server/projects'

vi.mock('@/components/like-button', () => ({
  LikeButton: ({ likeCount }: { likeCount: number }) => (
    <button type="button">like {likeCount}</button>
  ),
}))

vi.mock('@/components/demo-embed', () => ({
  DemoEmbed: ({ src }: { src: string }) => <iframe title="demo-embed" src={src} />,
}))

function makeProject(overrides: Partial<ProjectDetailData> = {}): ProjectDetailData {
  return {
    id: 8201,
    userId: 'founder-1',
    status: 3,
    likeCount: 12,
    name: '健康助手',
    tagline: '把经期记录做成一件轻松的事',
    coverUrl: 'https://cdn.example.com/cover.png',
    demoImages: null,
    demoVideoUrl: 'https://www.youtube.com/watch?v=abc',
    demoLink: 'https://app.example.com',
    stage: ProjectStage.Launched,
    categories: ['女性健康'],
    problemStatement: '现有经期记录工具广告太多。',
    progress: null,
    nextSteps: '上线社区功能。',
    differentiation: '界面干净且完全免费。',
    businessModel: '后期做增值服务。',
    userCount: 1234,
    monthlyRevenue: 0,
    retentionRate: 38,
    seekingSkills: ['frontend', 'contentCreation'],
    isOpenForBeta: true,
    betaDescription: '正在招募第一批 Beta 用户。',
    contactName: '李四',
    contactPhone: null,
    contactEmail: 'li@example.com',
    contactWechat: null,
    teamName: '健康助手团队',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    founder: null,
    ...overrides,
  } as ProjectDetailData
}

describe('ProjectDetail — 新字段故事', () => {
  it('renders problem statement, next steps, differentiation, business model sections', () => {
    render(<ProjectDetail project={makeProject()} showLike={false} />)

    expect(screen.getByText('项目背景与问题')).toBeInTheDocument()
    expect(screen.getByText('现有经期记录工具广告太多。')).toBeInTheDocument()
    expect(screen.getByText('下一步计划')).toBeInTheDocument()
    expect(screen.getByText('上线社区功能。')).toBeInTheDocument()
    expect(screen.getByText('差异化优势')).toBeInTheDocument()
    expect(screen.getByText('商业模式')).toBeInTheDocument()
  })

  it('omits sections whose field is empty/null', () => {
    const project = makeProject({ problemStatement: null, differentiation: '  ', userCount: null, monthlyRevenue: null, retentionRate: null, isOpenForBeta: false })
    render(<ProjectDetail project={project} showLike={false} />)

    expect(screen.queryByText('项目背景与问题')).not.toBeInTheDocument()
    expect(screen.queryByText('差异化优势')).not.toBeInTheDocument()
  })

  it('renders the traction metric bar with only the non-empty metrics', () => {
    render(<ProjectDetail project={makeProject({ userCount: 1234, monthlyRevenue: null, retentionRate: 38 })} showLike={false} />)

    expect(screen.getByText('用户数')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('留存率')).toBeInTheDocument()
    expect(screen.getByText('38%')).toBeInTheDocument()
    expect(screen.queryByText('月收入')).not.toBeInTheDocument()
  })

  it('formats monthly revenue with ¥ and hides the whole bar when all metrics are null', () => {
    const project = makeProject({ userCount: null, monthlyRevenue: 5200 })
    const { container, rerender } = render(<ProjectDetail project={project} showLike={false} />)
    expect(screen.getByText('月收入')).toBeInTheDocument()
    expect(screen.getByText('¥5,200')).toBeInTheDocument()

    rerender(<ProjectDetail project={makeProject({ userCount: null, monthlyRevenue: null, retentionRate: null })} showLike={false} />)
    expect(screen.queryByText('月收入')).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('留存率')
  })

  it('renders seeking skills chips and the beta call with its description', () => {
    render(<ProjectDetail project={makeProject()} showLike={false} />)

    expect(screen.getByText('寻求帮助')).toBeInTheDocument()
    expect(screen.getByText('前端')).toBeInTheDocument()
    expect(screen.getByText('内容创作')).toBeInTheDocument()
    expect(screen.getByText('正在招募 Beta 用户')).toBeInTheDocument()
    expect(screen.getByText('正在招募第一批 Beta 用户。')).toBeInTheDocument()
  })

  it('renders the demo video embed for a YouTube link plus the product demo', () => {
    render(<ProjectDetail project={makeProject()} showLike={false} />)

    expect(screen.getByTitle('健康助手 演示视频')).toHaveAttribute('src', 'https://www.youtube.com/embed/abc')
    expect(screen.getByTitle('demo-embed')).toHaveAttribute('src', 'https://app.example.com')
  })
})

describe('ProjectDetail — 联系方式隐私（owner/Operator 视野）', () => {
  it('shows the contact section only when the API returned contact fields (owner/operator view)', () => {
    render(<ProjectDetail project={makeProject()} showLike={false} />)

    expect(screen.getByText('联系方式')).toBeInTheDocument()
    expect(screen.getByText('李四')).toBeInTheDocument()
    expect(screen.getByText('li@example.com')).toBeInTheDocument()
  })

  it('renders no contact section when contact fields are stripped (public view)', () => {
    const project = makeProject({
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      contactWechat: null,
    })
    const { container } = render(<ProjectDetail project={project} showLike={false} />)

    expect(screen.queryByText('联系方式')).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('li@example.com')
  })
})
