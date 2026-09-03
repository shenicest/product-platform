import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FounderCard } from '@/components/founder-card'
import { UserInteractionProvider } from '@/components/user-interaction-provider'
import { HttpResponse, http } from 'msw'
import userEvent from '@testing-library/user-event'
import { server } from '../msw/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
const mockUser = vi.hoisted(() => ({ user_id: 1, email: null, role: '', roles: [] }))
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ user: mockUser }),
  useOptionalAuth: () => ({ user: mockUser }),
}))

beforeEach(() => {
  server.use(http.get('/api/me', () => HttpResponse.json({ user: null })))
})

describe('FounderCard', () => {
  const renderCard = () => render(<UserInteractionProvider initialLikedProjectIds={[]} initialFollowedFounderUserIds={[]}><FounderCard projectName="Atlas" founder={{ userId: '7', nickname: 'Ada', avatarUrl: null, followerCount: 12 }} /></UserInteractionProvider>)

  it('renders the founder follower count', () => {
    renderCard()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('12 followers')).toBeInTheDocument()
  })

  it('updates the live count after following', async () => {
    server.use(
      http.get('/api/me', () => HttpResponse.json({ user: { user_id: 1, roles: [] } })),
      http.post('/api/founders/7/follow', () => HttpResponse.json({ followed: true, followerCount: 13 })),
    )
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByRole('button', { name: 'Follow' }))
    expect(await screen.findByText('13 followers')).toBeInTheDocument()
  })
})
