import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectStage } from '@shenicest/shared'
import { ProjectCard } from '@/components/project-card'
import type { Project } from '@/server/projects'

// Fixture matching the shape of the API's public project payload. Fields the
// component doesn't read are typed with reasonable defaults.
function makeProject(overrides: Partial<Project> = {}): Project {
  const base = {
    id: 7,
    userId: 'u-1',
    status: 3,
    name: 'Nova',
    tagline: 'A fast build tool',
    description: null,
    coverUrl: 'https://cdn.example.com/covers/7.png',
    demoImages: null,
    demoVideoUrl: null,
    demoLink: null,
    stage: ProjectStage.MVP,
    categories: ['开发者工具'],
    targetUsers: null,
    userProblem: null,
    progress: null,
    nextSteps: null,
    messageToUsers: null,
    isOpenForBeta: null,
    betaDescription: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    contactWechat: null,
    teamName: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }
  return { ...base, ...overrides } as Project
}

describe('ProjectCard', () => {
  it('links to /projects/:id', () => {
    render(<ProjectCard project={makeProject({ id: 7 })} />)
    const link = screen.getByRole('link', { name: /Nova/i })
    expect(link).toHaveAttribute('href', '/projects/7')
  })

  it('renders the padded project id label', () => {
    render(<ProjectCard project={makeProject({ id: 7 })} />)
    expect(screen.getByText('P-007')).toBeInTheDocument()
  })

  it('renders the project name and tagline', () => {
    render(<ProjectCard project={makeProject()} />)
    expect(screen.getByText('Nova')).toBeInTheDocument()
    expect(screen.getByText('A fast build tool')).toBeInTheDocument()
  })

  it('omits the tagline element when tagline is null', () => {
    render(<ProjectCard project={makeProject({ tagline: null })} />)
    expect(screen.queryByText('A fast build tool')).not.toBeInTheDocument()
  })

  it('shows the cover image when coverUrl is set', () => {
    render(<ProjectCard project={makeProject()} />)
    const img = screen.getByRole('img', { name: 'Nova' })
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/covers/7.png')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('shows the NO COVER placeholder when coverUrl is missing', () => {
    render(<ProjectCard project={makeProject({ coverUrl: null })} />)
    expect(screen.queryByRole('img', { name: 'Nova' })).not.toBeInTheDocument()
    expect(screen.getByText('NO COVER')).toBeInTheDocument()
  })

  it('renders badges for stage and categories', () => {
    render(<ProjectCard project={makeProject()} />)
    expect(screen.getByText('MVP 阶段')).toBeInTheDocument()
    expect(screen.getByText('开发者工具')).toBeInTheDocument()
  })
})
