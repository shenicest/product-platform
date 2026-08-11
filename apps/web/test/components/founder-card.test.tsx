import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FounderCard } from '@/components/founder-card'
import { UserInteractionProvider } from '@/components/user-interaction-provider'
import { AuthProvider } from '@/components/auth-provider'
import { HttpResponse, http } from 'msw'
import userEvent from '@testing-library/user-event'
import { server } from '../msw/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

describe('FounderCard', () => {
  it('renders the founder follower count', () => {
    render(<AuthProvider><UserInteractionProvider initialLikedProjectIds={[]} initialFollowedFounderUserIds={[]}><FounderCard projectName="Atlas" founder={{ userId: '7', nickname: 'Ada', avatarUrl: null, followerCount: 12 }} /></UserInteractionProvider></AuthProvider>)
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('12 followers')).toBeInTheDocument()
  })

  it('updates the live count after following', async () => {
    server.use(
      http.get('/api/me', () => HttpResponse.json({ user: { user_id: 1, roles: [] } })),
      http.post('/api/founders/7/follow', () => HttpResponse.json({ followed: true, followerCount: 13 })),
    )
    const user = userEvent.setup()
    render(<AuthProvider><UserInteractionProvider initialLikedProjectIds={[]} initialFollowedFounderUserIds={[]}><FounderCard projectName="Atlas" founder={{ userId: '7', nickname: 'Ada', avatarUrl: null, followerCount: 12 }} /></UserInteractionProvider></AuthProvider>)
    await user.click(screen.getByRole('button', { name: 'Follow' }))
    expect(await screen.findByText('13 followers')).toBeInTheDocument()
  })
})
