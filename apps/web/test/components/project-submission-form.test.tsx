import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth-provider'
import { ProjectSubmissionForm } from '@/components/submit/project-submission-form'
import { server } from '../msw/server'

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }) }))
vi.mock('@/lib/upload', () => ({
  presignAndUpload: vi.fn(async () => 'https://example.com/cover.png'),
  UploadError: class UploadError extends Error {},
}))

const ME_WITH_NICKNAME = { user: { user_id: 1, roles: [], nickname: '测试昵称', avatarUrl: null } }
const ME_NO_NICKNAME = { user: { user_id: 1, roles: [], nickname: null, avatarUrl: null } }

let createdBodies: Record<string, unknown>[] = []
let submitRequests = 0

function mswCreateAndSubmit() {
  server.use(
    http.post('/api/projects', async ({ request }) => {
      createdBodies.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({ id: 5 })
    }),
    http.put('/api/projects/5/submit', () => {
      submitRequests += 1
      return HttpResponse.json({ id: 5, status: 1 })
    }),
  )
}

function renderForm(initialData?: Record<string, unknown>) {
  return render(
    <AuthProvider>
      <ProjectSubmissionForm projectId={initialData ? 5 : undefined} initialData={initialData} />
    </AuthProvider>,
  )
}

/**
 * The server-rendered path: the page resolved the session and the nickname
 * before rendering, so the form must show both without waiting for /api/me.
 */
function renderServerResolved(props: { initialNickname?: string | null } = {}) {
  return render(
    <AuthProvider>
      <ProjectSubmissionForm serverAuthenticated initialNickname={props.initialNickname ?? null} />
    </AuthProvider>,
  )
}

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  { withContact = true }: { withContact?: boolean } = {},
) {
  await user.type(screen.getByLabelText(/^项目名称/), '测试项目')
  await user.type(screen.getByLabelText(/^一句话介绍/), '满足四到五十字符的一句话介绍')
  await user.click(screen.getByRole('button', { name: '效率工具' }))
  await user.selectOptions(screen.getByLabelText(/^产品阶段/), '1')
  await user.type(
    screen.getByLabelText(/^为谁解决什么问题/),
    '自由职业者需要同时服务多个客户，还要自己处理合同、收款与报税，过程分散且容易出错。',
  )
  await user.type(screen.getByLabelText(/^下一步计划/), '继续收集反馈并完善核心流程。')
  await user.upload(
    document.querySelector<HTMLInputElement>('#coverUrl')!,
    new File(['x'], 'cover.png', { type: 'image/png' }),
  )
  await waitFor(() => expect(screen.getAllByRole('button', { name: '删除图片' }).length).toBeGreaterThan(0))
  if (withContact) {
    await user.type(screen.getByPlaceholderText(/联系邮箱/), 'test@example.com')
  }
}

describe('ProjectSubmissionForm', () => {
  beforeEach(() => {
    push.mockClear()
    replace.mockClear()
    createdBodies = []
    submitRequests = 0
  })

  it('renders the 6 reordered sections and video link inputs (not an uploader)', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toBeInTheDocument())
    for (const title of ['项目速览', '项目故事', '进展与前景', '展示资料', '招募与合作', '联系方式']) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('06')).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('须为 http:// 或 https:// 地址')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: '+ 上传演示视频' })).toBeNull()
  })

  it('prefills contactName with the account nickname on new submissions', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('测试昵称'))
  })

  it('leaves contactName empty when the account has no nickname', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_NO_NICKNAME)))
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue(''))
  })

  it('does not overwrite the saved contactName of an existing draft', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    renderForm({ name: '草稿项目', contactName: '草稿联系人' })
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('草稿联系人'))
  })

  describe('server-resolved session (static-snapshot path)', () => {
    it('renders the form on first paint with the server nickname already filled', () => {
      // The client fetch deliberately answers "no user" here. The form must
      // still render, because the page already resolved the session on the
      // server. That is what makes the page correct without JavaScript, and
      // capturable by scripts/html-snapshot.mjs, which only ever sends a GET.
      server.use(http.get('/api/me', () => HttpResponse.json({})))
      renderServerResolved({ initialNickname: '服务端昵称' })

      expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('服务端昵称')
      expect(screen.getByText('项目速览')).toBeInTheDocument()
      expect(screen.queryByText('请先登录后再提交项目。')).toBeNull()
    })

    it('keeps the form visible even when the nickname is null', () => {
      server.use(http.get('/api/me', () => HttpResponse.json({})))
      renderServerResolved({ initialNickname: null })
      expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('')
      expect(screen.getByText('项目速览')).toBeInTheDocument()
    })

    it('still prefills from /api/me when the page passed no nickname', async () => {
      server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
      render(
        <AuthProvider>
          <ProjectSubmissionForm />
        </AuthProvider>,
      )
      await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('测试昵称'))
    })
  })

  it('blocks submission with client-side validation errors and no network call', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    let created = 0
    server.use(http.post('/api/projects', () => { created += 1; return HttpResponse.json({ id: 5 }) }))
    const user = userEvent.setup()
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /提交审核/ }))
    expect(screen.getAllByText('请补全必填信息').length).toBeGreaterThan(0)
    await waitFor(() => expect(created).toBe(0))
  })

  it('maps a 422 submit error back to the reported field', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    server.use(
      http.post('/api/projects', () => HttpResponse.json({ id: 5 })),
      http.put('/api/projects/5/submit', () =>
        HttpResponse.json(
          { error: { code: 'MISSING_REQUIRED_FIELD', message: 'Missing required field: tagline', field: 'tagline' } },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('测试昵称'))
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /提交审核/ }))
    await waitFor(() => expect(screen.getByText('Missing required field: tagline')).toBeInTheDocument())
  })

  it('submits a complete valid form and shows the pending-review state', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    mswCreateAndSubmit()
    const user = userEvent.setup()
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('测试昵称'))
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /提交审核/ }))

    await waitFor(() => expect(screen.getByText('正在审核中')).toBeInTheDocument())
    expect(submitRequests).toBe(1)
    const body = createdBodies[0]
    expect(body.stage).toBe(1)
    expect(body.problemStatement).toContain('自由职业者')
    expect(body.seekingSkills).toEqual([])
  })

  it('reveals the seeking-skills wall via the checkbox, caps at 5 tags, and clears on untick', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    const user = userEvent.setup()
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: '产品策略' })).toBeNull()
    await user.click(screen.getByRole('checkbox', { name: '正在寻找的角色' }))
    for (const name of ['产品策略', 'UI', '前端', '增长策略', '社区运营']) {
      await user.click(screen.getByRole('button', { name }))
    }
    expect(screen.getByRole('button', { name: '内容策划' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '产品策略' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '产品策略' }))
    expect(screen.getByRole('button', { name: '内容策划' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '产品策略' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: '内容策划' }))
    await user.click(screen.getByRole('checkbox', { name: '正在寻找的角色' }))
    expect(screen.queryByRole('button', { name: '内容策划' })).toBeNull()
  })

  it('accepts wechat as the only contact channel', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    mswCreateAndSubmit()
    const user = userEvent.setup()
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('测试昵称'))
    await fillRequiredFields(user)
    await user.type(screen.getByPlaceholderText(/微信号/), 'wechat-id-01')
    await user.click(screen.getByRole('button', { name: /提交审核/ }))
    await waitFor(() => expect(screen.getByText('正在审核中')).toBeInTheDocument())
    expect(createdBodies[0].contactWechat).toBe('wechat-id-01')
  })

  it('sends traction numbers when filled', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_WITH_NICKNAME)))
    mswCreateAndSubmit()
    const user = userEvent.setup()
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toHaveValue('测试昵称'))
    await fillRequiredFields(user)
    await user.type(screen.getByLabelText(/用户量/), '1200')
    await user.type(screen.getByLabelText(/月收入/), '3500')
    await user.type(screen.getByLabelText(/30 日留存/), '45')
    await user.click(screen.getByRole('button', { name: /提交审核/ }))
    await waitFor(() => expect(screen.getByText('正在审核中')).toBeInTheDocument())
    expect(createdBodies[0].userCount).toBe(1200)
    expect(createdBodies[0].monthlyRevenue).toBe(3500)
    expect(createdBodies[0].retentionRate).toBe(45)
  })

  it('requires a contact channel (at least one of phone/email/wechat)', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(ME_NO_NICKNAME)))
    const user = userEvent.setup()
    renderForm()
    await waitFor(() => expect(screen.getByLabelText(/^联系人姓名/)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/^联系人姓名/), '张三')
    await fillRequiredFields(user, { withContact: false })
    await user.click(screen.getByRole('button', { name: /提交审核/ }))
    expect(screen.getByText('请至少填写一种联系方式（电话/邮箱/微信）')).toBeInTheDocument()
    expect(submitRequests).toBe(0)
  })
})
