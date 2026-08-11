import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectStage } from '@shenicest/shared'
import { ProjectBadges } from '@/components/project-badges'

describe('ProjectBadges', () => {
  it('renders nothing when there is no stage and no categories', () => {
    const { container } = render(<ProjectBadges stage={null} categories={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when categories is an empty array and stage is null', () => {
    const { container } = render(<ProjectBadges stage={null} categories={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a stage badge for MVP', () => {
    render(<ProjectBadges stage={ProjectStage.MVP} categories={null} />)
    expect(screen.getByText('MVP 阶段')).toBeInTheDocument()
  })

  it('renders a stage badge for Growth', () => {
    render(<ProjectBadges stage={ProjectStage.Growth} categories={null} />)
    expect(screen.getByText('成长阶段')).toBeInTheDocument()
  })

  it('renders each category as a chip', () => {
    render(
      <ProjectBadges stage={null} categories={['开发者工具', '效率工具']} />
    )
    expect(screen.getByText('开发者工具')).toBeInTheDocument()
    expect(screen.getByText('效率工具')).toBeInTheDocument()
  })

  it('renders stage and categories together', () => {
    render(
      <ProjectBadges stage={ProjectStage.MVP} categories={['开发者工具']} />
    )
    expect(screen.getByText('MVP 阶段')).toBeInTheDocument()
    expect(screen.getByText('开发者工具')).toBeInTheDocument()
  })

  it('applies the passed className', () => {
    const { container } = render(
      <ProjectBadges
        stage={ProjectStage.MVP}
        categories={null}
        className="custom-class"
      />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('ignores an unknown stage number (no label registered)', () => {
    // stage=42 is not in STAGE_LABELS; STAGE_LABELS[42] is undefined.
    render(<ProjectBadges stage={42 as number} categories={['开发者工具']} />)
    expect(screen.getByText('开发者工具')).toBeInTheDocument()
    expect(screen.queryByText('MVP 阶段')).not.toBeInTheDocument()
    expect(screen.queryByText('成长阶段')).not.toBeInTheDocument()
  })
})
