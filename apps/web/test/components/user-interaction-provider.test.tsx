import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth-provider'
import { UserInteractionProvider, useUserInteraction } from '@/components/user-interaction-provider'
import { server } from '../msw/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

function Probe() {
  const { liked, unlike, likeCounts, registerLikeCount } = useUserInteraction()
  return <div>
    <span data-testid="liked">{liked.has(7) ? 'yes' : 'no'}</span>
    <span data-testid="count">{likeCounts.get(7) ?? '-'}</span>
    <button onClick={() => registerLikeCount(7, 2)}>register</button>
    <button onClick={() => unlike(7)}>unlike</button>
  </div>
}

function renderProvider() {
  return render(<AuthProvider><UserInteractionProvider initialLikedProjectIds={[7]}><Probe /></UserInteractionProvider></AuthProvider>)
}

beforeEach(() => {
  server.use(
    http.get('/api/me', () => HttpResponse.json({ user: { user_id: 1, email: 'user@example.com', roles: [] } })),
    http.delete('/api/projects/7/like', () => HttpResponse.json({ liked: false, likeCount: 1 })),
  )
})

describe('UserInteractionProvider', () => {
  it('hydrates the liked set and updates optimistically', async () => {
    const user = userEvent.setup()
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('liked')).toHaveTextContent('yes'))
    await user.click(screen.getByRole('button', { name: 'register' }))
    await user.click(screen.getByRole('button', { name: 'unlike' }))
    expect(screen.getByTestId('liked')).toHaveTextContent('no')
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
  })
})
