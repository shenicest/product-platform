import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth-provider'
import { LikeButton } from '@/components/like-button'
import { UserInteractionProvider } from '@/components/user-interaction-provider'
import { server } from '../msw/server'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

function renderButton() {
  return render(<AuthProvider><UserInteractionProvider initialLikedProjectIds={[]}><LikeButton projectId={7} likeCount={0} /></UserInteractionProvider></AuthProvider>)
}

describe('LikeButton', () => {
  beforeEach(() => {
    push.mockClear()
    server.use(http.get('/api/me', () => HttpResponse.json({ user: { user_id: 1, roles: [] } })))
  })

  it('optimistically increments and lights the heart', async () => {
    server.use(http.post('/api/projects/7/like', () => HttpResponse.json({ liked: true, likeCount: 1 })))
    const user = userEvent.setup()
    renderButton()
    await waitFor(() => expect(screen.getByRole('button', { name: '喜欢项目' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '喜欢项目' }))
    expect(screen.getByRole('button', { name: '取消喜欢' })).toHaveTextContent('1')
  })

  it('rolls back when the mutation fails', async () => {
    server.use(http.post('/api/projects/7/like', () => HttpResponse.json({ error: { code: 'FAILED', message: 'failed' } }, { status: 500 })))
    const user = userEvent.setup()
    renderButton()
    await waitFor(() => expect(screen.getByRole('button', { name: '喜欢项目' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '喜欢项目' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '喜欢项目' })).toHaveTextContent('0'))
  })

  it('routes an anonymous click to login', async () => {
    server.use(http.get('/api/me', () => new HttpResponse(null, { status: 401 })))
    const user = userEvent.setup()
    renderButton()
    await waitFor(() => expect(screen.getByRole('button', { name: '喜欢项目' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '喜欢项目' }))
    expect(push).toHaveBeenCalledWith('/login')
  })
})
