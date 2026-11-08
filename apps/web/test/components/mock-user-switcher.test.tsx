import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockUserSwitcher } from '@/components/dev/mock-user-switcher'
import { MOCK_SWITCHER_COLLAPSED_KEY } from '@/lib/mock-auth'
import { server } from '../msw/server'

// 切换器通过 useAuth().refresh 让头部/页面重新拉 /api/me；测试里只关心它被调用。
const refresh = vi.fn()

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isAuthenticated: false,
    refresh,
    logout: vi.fn(),
  }),
}))

const USERS = [
  {
    key: 'founder',
    label: '创始人 · 小林',
    description: '有 founder 角色与人才档案',
    userId: 'u-founder',
    email: 'founder@shenicest.test',
    roles: [0],
    isOrganizer: false,
    hasProfile: true,
  },
  {
    key: 'organizer',
    label: '主办方 · 阿岚',
    description: '主办方组织成员',
    userId: 'u-organizer',
    email: null,
    roles: [1, 2],
    isOrganizer: true,
    hasProfile: false,
  },
]

function stubUsers(active: string | null = 'founder') {
  server.use(http.get('/api/mock/users', () => HttpResponse.json({ active, users: USERS })))
}

beforeEach(() => {
  refresh.mockReset()
  refresh.mockResolvedValue(undefined)
  // 收起偏好写在 localStorage 里，跨用例共享同一个 jsdom；不清掉的话上一个
  // 用例的「收起」会带进下一个用例。
  window.localStorage.clear()
})

// 生产构建那条用例会临时 stub NODE_ENV，跑完必须还原，否则后续用例会
// 拿到一个「生产版」的模块。unstubEnvs 由 vitest 配置的 unstubEnvs 兜底，
// 这里显式再清一次模块缓存，保证下次 import 重新求值构建期常量。
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('MockUserSwitcher', () => {
  it('lists the mock users and shows the active one', async () => {
    stubUsers('founder')
    render(<MockUserSwitcher />)

    // 当前身份同时出现在顶部 chip 与列表行里，所以按 chip 的 aria-label 定位。
    expect(await screen.findByLabelText('当前身份：创始人 · 小林')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /创始人 · 小林/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /主办方 · 阿岚/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /未登录/ })).toBeInTheDocument()
    // 无档案的候选用户会打一个标记。
    expect(screen.getByText('无档案')).toBeInTheDocument()
  })

  it('switches the mock user and refreshes the auth context', async () => {
    stubUsers('founder')
    const posted: unknown[] = []
    server.use(
      http.post('/api/mock/session', async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json({ active: 'organizer' })
      }),
    )

    const user = userEvent.setup()
    render(<MockUserSwitcher />)

    await user.click(await screen.findByText('主办方 · 阿岚'))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(posted).toEqual([{ key: 'organizer' }])
    // 浮层上的当前身份跟着切换结果更新。
    await waitFor(() =>
      expect(screen.getByLabelText('当前身份：主办方 · 阿岚')).toBeInTheDocument(),
    )
  })

  it('signs out by posting a null key', async () => {
    stubUsers('founder')
    const posted: unknown[] = []
    server.use(
      http.post('/api/mock/session', async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json({ active: null })
      }),
    )

    const user = userEvent.setup()
    render(<MockUserSwitcher />)

    await user.click(await screen.findByText('未登录'))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(posted).toEqual([{ key: null }])
  })

  it('renders nothing when the mock API is not mounted (404)', async () => {
    server.use(http.get('/api/mock/users', () => new HttpResponse(null, { status: 404 })))

    const { container } = render(<MockUserSwitcher />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('renders nothing when the network fails', async () => {
    server.use(http.get('/api/mock/users', () => HttpResponse.error()))

    const { container } = render(<MockUserSwitcher />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('stays visible but does not switch when the request is rejected (unknown key)', async () => {
    stubUsers('founder')
    server.use(
      http.post('/api/mock/session', () =>
        HttpResponse.json(
          { error: { code: 'MOCK_USER_NOT_FOUND', message: 'unknown key' } },
          { status: 400 },
        ),
      ),
    )

    const user = userEvent.setup()
    render(<MockUserSwitcher />)

    await user.click(await screen.findByRole('button', { name: /主办方 · 阿岚/ }))

    // 400 说明后端在，只是这次没切成：浮层必须留着，身份也不该变。
    await waitFor(() =>
      expect(screen.getByLabelText('当前身份：创始人 · 小林')).toBeInTheDocument(),
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('collapses when the switch endpoint 404s (mock turned off mid-session)', async () => {
    stubUsers('founder')
    server.use(
      http.post('/api/mock/session', () => new HttpResponse(null, { status: 404 })),
    )

    const user = userEvent.setup()
    const { container } = render(<MockUserSwitcher />)

    await user.click(await screen.findByRole('button', { name: /主办方 · 阿岚/ }))

    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(refresh).not.toHaveBeenCalled()
  })

  it('renders nothing in a production build', async () => {
    // 组件读的是构建期常量，所以要按生产环境重新导入一次模块。
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    const { MockUserSwitcher: ProductionSwitcher } = await import(
      '@/components/dev/mock-user-switcher'
    )

    // 不装任何 MSW handler：生产构建下组件不应发出请求（否则会被
    // onUnhandledRequest: 'error' 抓住）。
    const { container } = render(<ProductionSwitcher />)
    expect(container).toBeEmptyDOMElement()
  })

  describe('collapsible panel', () => {
    it('collapses to a pill that keeps the active identity visible', async () => {
      stubUsers('founder')
      const user = userEvent.setup()
      render(<MockUserSwitcher />)

      await user.click(await screen.findByLabelText('收起 mock 用户切换器'))

      // 列表整块消失，只剩一颗能重新展开的胶囊，且身份仍可读。
      expect(screen.queryByRole('button', { name: /主办方 · 阿岚/ })).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: '展开 mock 用户切换器（当前身份：创始人 · 小林）' }),
      ).toHaveAttribute('aria-expanded', 'false')
      // 收起状态写进 localStorage，刷新页面后不该又铺开。
      expect(window.localStorage.getItem(MOCK_SWITCHER_COLLAPSED_KEY)).toBe('1')
    })

    it('expands again from the pill', async () => {
      stubUsers('founder')
      const user = userEvent.setup()
      render(<MockUserSwitcher />)

      await user.click(await screen.findByLabelText('收起 mock 用户切换器'))
      await user.click(
        screen.getByRole('button', { name: '展开 mock 用户切换器（当前身份：创始人 · 小林）' }),
      )

      expect(await screen.findByRole('button', { name: /主办方 · 阿岚/ })).toBeInTheDocument()
      expect(window.localStorage.getItem(MOCK_SWITCHER_COLLAPSED_KEY)).toBeNull()
    })

    it('starts collapsed when the preference was remembered', async () => {
      window.localStorage.setItem(MOCK_SWITCHER_COLLAPSED_KEY, '1')
      stubUsers('founder')
      render(<MockUserSwitcher />)

      expect(
        await screen.findByRole('button', { name: '展开 mock 用户切换器（当前身份：创始人 · 小林）' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /主办方 · 阿岚/ })).not.toBeInTheDocument()
    })

    it('collapses on Escape while expanded', async () => {
      stubUsers('founder')
      const user = userEvent.setup()
      render(<MockUserSwitcher />)

      await screen.findByLabelText('当前身份：创始人 · 小林')
      await user.keyboard('{Escape}')

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: '展开 mock 用户切换器（当前身份：创始人 · 小林）' }),
        ).toBeInTheDocument(),
      )
    })

    it('keeps the list reachable when storage is unavailable', async () => {
      // 隐私模式下 localStorage 可能直接抛错：不能因此把整块浮层弄没。
      const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled')
      })
      stubUsers('founder')
      render(<MockUserSwitcher />)

      expect(await screen.findByRole('button', { name: /主办方 · 阿岚/ })).toBeInTheDocument()
      getItem.mockRestore()
    })
  })
})
