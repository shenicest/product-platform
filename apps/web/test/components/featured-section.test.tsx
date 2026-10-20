import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FeaturedSection } from '@/components/featured-section'
import type { Project } from '@/server/projects'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function makeProject(id: number, name: string): Project {
  return {
    id,
    userId: 'u-1',
    status: 3,
    likeCount: 0,
    name,
    tagline: null,
    coverUrl: null,
    demoImages: null,
    demoVideoUrl: null,
    demoLink: null,
    stage: null,
    categories: null,
    problemStatement: null,
    progress: null,
    nextSteps: null,
    differentiation: null,
    businessModel: null,
    userCount: null,
    monthlyRevenue: null,
    retentionRate: null,
    seekingSkills: null,
    isOpenForBeta: null,
    betaDescription: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    contactWechat: null,
    teamName: null,
    founder: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  } as Project
}

describe('FeaturedSection', () => {
  it('renders nothing when no projects are configured', () => {
    const { container } = render(<FeaturedSection projects={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows at most four projects and hides the rotate button when there is only one batch', () => {
    render(
      <FeaturedSection
        projects={[
          makeProject(1, 'Alpha'),
          makeProject(2, 'Beta'),
          makeProject(3, 'Gamma'),
          makeProject(4, 'Delta'),
        ]}
      />
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Delta')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /换一批/ })).not.toBeInTheDocument()
  })

  it('rotates to the next batch and wraps around', async () => {
    const user = userEvent.setup()
    render(
      <FeaturedSection
        projects={[
          makeProject(1, 'Alpha'),
          makeProject(2, 'Beta'),
          makeProject(3, 'Gamma'),
          makeProject(4, 'Delta'),
          makeProject(5, 'Epsilon'),
          makeProject(6, 'Zeta'),
        ]}
      />
    )

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Epsilon')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /换一批/ }))
    expect(screen.getByText('Epsilon')).toBeInTheDocument()
    expect(screen.getByText('Zeta')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Delta')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /换一批/ }))
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Delta')).toBeInTheDocument()
    expect(screen.queryByText('Epsilon')).not.toBeInTheDocument()
  })
})
