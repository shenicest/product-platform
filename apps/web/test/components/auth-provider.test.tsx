import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { server } from '../msw/server'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}))

beforeEach(() => {
  push.mockClear()
})

function Probe() {
  const { user, loading, isAuthenticated, refresh, logout } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="email">{user?.email ?? '-'}</span>
      <button onClick={() => refresh()}>refresh</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

describe('AuthProvider — initial load', () => {
  it('reports the authenticated user once /api/me resolves', async () => {
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({
          user: { user_id: 1, email: 'a@b.com', role: 'operator', roles: [1] },
        })
      )
    )

    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    )
    expect(screen.getByTestId('auth')).toHaveTextContent('yes')
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com')
  })

  it('reports an unauthenticated state when /api/me returns 401', async () => {
    server.use(http.get('/api/me', () => new HttpResponse(null, { status: 401 })))

    renderProvider()
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    )
    expect(screen.getByTestId('auth')).toHaveTextContent('no')
    expect(screen.getByTestId('email')).toHaveTextContent('-')
  })
})

describe('AuthProvider — refresh', () => {
  it('re-fetches the current user on demand', async () => {
    let calls = 0
    server.use(
      http.get('/api/me', () => {
        calls += 1
        return HttpResponse.json({
          user: {
            user_id: calls,
            email: `user${calls}@b.com`,
            role: 'founder',
            roles: [0],
          },
        })
      })
    )

    const user = userEvent.setup()
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('user1@b.com'))
    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('user2@b.com'))
  })
})

describe('AuthProvider — logout', () => {
  it('clears the user and pushes /login', async () => {
    let logoutCalled = false
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({
          user: { user_id: 1, email: 'a@b.com', role: 'operator', roles: [1] },
        })
      ),
      http.post('/api/auth/logout', () => {
        logoutCalled = true
        return HttpResponse.json({ success: true })
      })
    )

    const user = userEvent.setup()
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'))

    await user.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('no'))
    expect(logoutCalled).toBe(true)
    expect(push).toHaveBeenCalledWith('/login')
  })
})

describe('useAuth', () => {
  it('throws outside of AuthProvider', () => {
    // React logs an error to the console when a component throws during
    // render; silence it for the duration of this test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/AuthProvider/)
    spy.mockRestore()
  })
})
