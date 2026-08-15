import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { ProjectProposalForm } from '@/components/founder/project-proposal-form'
import { server } from '../msw/server'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

const description = '这是一段完整的项目介绍，用于说明项目是什么、解决什么问题以及当前进度。为了满足提交要求，这段内容需要达到一百个字符以上，并包含足够清晰的信息。项目已经完成基础原型和首轮用户访谈，接下来会继续验证核心需求、完善产品功能，并根据真实反馈持续改进使用体验。'

describe('ProjectProposalForm', () => {
  it('submits only changed allowed fields', async () => {
    let requestBody: unknown
    server.use(http.post('/api/projects/7/proposals', async ({ request }) => {
      requestBody = await request.json()
      return HttpResponse.json({ id: 1, projectId: 7, changes: {}, status: 0 })
    }))
    const user = userEvent.setup()
    render(<ProjectProposalForm projectId={7} liveData={{ description, demoLink: '', betaDescription: '' }} />)

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
        liveData={{ description, demoLink: '', betaDescription: '' }}
        initialChanges={{ demoLink: 'https://example.com/old' }}
      />,
    )

    await user.clear(screen.getByLabelText('Demo 访问链接'))
    await user.type(screen.getByLabelText('Demo 访问链接'), 'https://example.com/new')
    await user.click(screen.getByRole('button', { name: '重新提交修改' }))

    await waitFor(() => expect(requestBody).toEqual({ changes: { demoLink: 'https://example.com/new' } }))
  })
})
