import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth-provider'
import { FollowButton } from '@/components/follow-button'
import { UserInteractionProvider } from '@/components/user-interaction-provider'
import { server } from '../msw/server'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

function renderButton() {
  return render(<AuthProvider><UserInteractionProvider initialLikedProjectIds={[]} initialFollowedFounderUserIds={[]}><FollowButton founderUserId="7" /></UserInteractionProvider></AuthProvider>)
}

describe('FollowButton', () => {
  beforeEach(() => {
    push.mockClear()
    server.use(http.get('/api/me', () => HttpResponse.json({ user: { user_id: 1, roles: [] } })))
  })

  it('optimistically flips to Following', async () => {
    server.use(http.post('/api/founders/7/follow', () => HttpResponse.json({ followed: true, followerCount: 1 })))
    const user = userEvent.setup()
    renderButton()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Follow' }))
    expect(screen.getByRole('button', { name: 'Following' })).toBePressed()
  })

  it('rolls back when the mutation fails', async () => {
    server.use(http.post('/api/founders/7/follow', () => HttpResponse.json({ error: { code: 'FAILED', message: 'failed' } }, { status: 500 })))
    const user = userEvent.setup()
    renderButton()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Follow' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeEnabled())
  })

  it('hides for the current Founder', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json({ user: { user_id: 7, roles: [0] } })))
    renderButton()
    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
  })

  it('routes an anonymous click to login', async () => {
    server.use(http.get('/api/me', () => new HttpResponse(null, { status: 401 })))
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: 'Follow' }))
    expect(push).toHaveBeenCalledWith('/login')
  })
})
