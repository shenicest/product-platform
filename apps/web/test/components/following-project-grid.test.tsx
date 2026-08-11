import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Project } from '@/server/projects'

let following = new Set(['founder-1'])

vi.mock('@/components/user-interaction-provider', () => ({ useUserInteraction: () => ({ following }) }))
vi.mock('@/components/project-card', () => ({ ProjectCard: ({ project }: { project: Project }) => <div>{project.name}</div> }))
vi.mock('@/components/follow-button', () => ({ FollowButton: ({ founderUserId }: { founderUserId: string }) => <button>{founderUserId}</button> }))

import { FollowingProjectGrid } from '@/components/following-project-grid'

const projects = [
  { id: 1, userId: 'founder-1', name: 'Followed' },
  { id: 2, userId: 'founder-2', name: 'Unfollowed' },
] as Project[]

describe('FollowingProjectGrid', () => {
  it('removes a Founder projects when they leave the shared following Set', () => {
    const { rerender } = render(<FollowingProjectGrid projects={projects} />)
    expect(screen.getByText('Followed')).toBeInTheDocument()
    expect(screen.queryByText('Unfollowed')).not.toBeInTheDocument()

    following = new Set()
    rerender(<FollowingProjectGrid projects={projects} />)
    expect(screen.queryByText('Followed')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '你还没有关注任何 Founder' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /去发现/ })).toHaveAttribute('href', '/')
  })
})
