import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SeasonReviewActions } from '@/components/operator/platform/seasons/season-review-actions'
import { server } from '../msw/server'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn(), back: vi.fn(), preload: vi.fn() }),
  usePathname: () => '/operator/boomland/seasons',
}))

const season = {
  id: 12,
  name: '上海站',
  status: 'upcoming',
  approvedAt: null,
  readinessReady: true,
}

/**
 * 待批赛季的批准 / 驳回动作。
 *
 * 打桩的是真实 HTTP（MSW `POST /api/seasons/:id/...`），所以「到底发了什么请求」
 * 是被 `client-api` 真正序列化过的，而不是 mock 函数的入参。
 */
describe('SeasonReviewActions', () => {
  beforeEach(() => {
    refresh.mockClear()
  })

  it('批准后调用接口并刷新列表', async () => {
    let calls = 0
    server.use(
      http.post('/api/seasons/12/approve', () => {
        calls += 1
        return HttpResponse.json({ id: 12 })
      }),
    )

    render(<SeasonReviewActions season={season} isOperator />)
    await userEvent.click(screen.getByRole('button', { name: '批准' }))

    await waitFor(() => expect(calls).toBe(1))
    expect(await screen.findByRole('status')).toHaveTextContent('已批准')
    expect(refresh).toHaveBeenCalled()
  })

  it('门槛没全过时禁用批准并说明原因', () => {
    render(<SeasonReviewActions season={{ ...season, readinessReady: false }} isOperator />)

    expect(screen.getByRole('button', { name: '批准' })).toBeDisabled()
    expect(screen.getByText(/发布门槛/)).toBeInTheDocument()
  })

  it('驳回原因不足 2 个字时不发请求', async () => {
    let calls = 0
    server.use(
      http.post('/api/seasons/12/reject', () => {
        calls += 1
        return HttpResponse.json({ id: 12 })
      }),
    )

    render(<SeasonReviewActions season={season} isOperator />)
    await userEvent.click(screen.getByRole('button', { name: '驳回' }))
    await userEvent.click(screen.getByRole('button', { name: '确认驳回' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('至少 2 个字')
    expect(calls).toBe(0)
  })

  it('填了原因后提交驳回并展示后端错误', async () => {
    server.use(
      http.post('/api/seasons/12/reject', () =>
        HttpResponse.json(
          { error: { code: 'SEASON_NOT_PENDING', message: '该赛季不是待批状态' } },
          { status: 409 },
        ),
      ),
    )

    render(<SeasonReviewActions season={season} isOperator />)
    await userEvent.click(screen.getByRole('button', { name: '驳回' }))
    await userEvent.type(screen.getByLabelText('驳回原因'), '赛程不完整，请补齐后重新提交')
    await userEvent.click(screen.getByRole('button', { name: '确认驳回' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('该赛季不是待批状态')
  })

  it('主办方成员看不到任何写操作', () => {
    const { container } = render(<SeasonReviewActions season={season} isOperator={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
