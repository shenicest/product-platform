import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { ProjectProposalForm } from '@/components/founder/project-proposal-form'
import { server } from '../msw/server'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))


describe('ProjectProposalForm', () => {
  it('submits only changed allowed fields', async () => {
    let requestBody: unknown
    server.use(http.post('/api/projects/7/proposals', async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ id: 1, projectId: 7, changes: {}, status: 0 })
    }))
    const user = userEvent.setup()
    render(<ProjectProposalForm projectId={7} liveData={{ problemStatement: '现有方案监控成本高。', nextSteps: '扩大测试范围。', demoLink: '', betaDescription: '' }} />)

    await user.type(screen.getByLabelText('Demo 访问链接'), 'https://example.com/demo')
    await user.click(screen.getByRole('button', { name: '提交修改提案' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/founder/projects/7'))
    expect(requestBody).toEqual({ changes: { demoLink: 'https://example.com/demo' } })
  })

  it('resubmits the complete revised diff on the same proposal', async () => {
    let requestBody: unknown
    server.use(http.put('/api/projects/7/proposals/3', async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ id: 3, projectId: 7, changes: {}, status: 0 })
    }))
    const user = userEvent.setup()
    render(
      <ProjectProposalForm
        projectId={7}
        proposalId={3}
        liveData={{ problemStatement: '现有方案监控成本高。', nextSteps: '扩大测试范围。', demoLink: '', betaDescription: '' }}
        initialChanges={{ demoLink: 'https://example.com/old' }}
      />,
    )

    await user.clear(screen.getByLabelText('Demo 访问链接'))
    await user.type(screen.getByLabelText('Demo 访问链接'), 'https://example.com/new')
    await user.click(screen.getByRole('button', { name: '重新提交修改' }))

    await waitFor(() => expect(requestBody).toEqual({ changes: { demoLink: 'https://example.com/new' } }))
  })
})
