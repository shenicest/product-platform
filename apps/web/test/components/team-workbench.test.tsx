import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ChallengeStatus,
  RecruitmentApplicationStatus,
  RecruitmentCardStatus,
  SeasonProjectSource,
  SeasonProjectStatus,
  SeasonStatus,
} from '@shenicest/shared'
import { TeamWorkbench } from '@/components/me/team-workbench'
import { TeamRecruitmentApplyDialog } from '@/components/me/team-recruitment-dialog'
import type { TeamWorkbenchDto } from '@/lib/team'
import { server } from '../msw/server'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh,
    preload: vi.fn(),
  }),
  usePathname: () => '/me/team',
  useSearchParams: () => new URLSearchParams(),
}))

/**
 * 组队 tab 的行为测试。
 *
 * 只测 Client 组件（Server Component 不直接测，见根 AGENTS.md）：5 张卡的
 * 内容、退出二次确认、发布招募卡弹窗、申请处理。视觉细节走截图走查。
 */

function workbench(overrides: Partial<TeamWorkbenchDto> = {}): TeamWorkbenchDto {
  return {
    season: {
      id: 7,
      code: 'A4BBS',
      name: '2026 秋季赛季',
      type: 'season',
      city: null,
      status: SeasonStatus.Active,
      themes: ['新能源与储能', '效率工具'],
      schedule: null,
      organizerOrgs: [],
      pinned: false,
      approvedAt: '2026-09-01T00:00:00.000Z',
      participantCapacity: 100,
      participantCount: 42,
      publishedChallengeCount: 3,
    },
    participant: {
      userId: '9001',
      status: 'active',
      wechatStatus: 'joined',
      canWithdraw: true,
    },
    application: { id: 12, status: 'accepted' },
    project: null,
    recruitmentCard: null,
    myApplications: [],
    stats: { unassignedParticipantCount: 6, openRecruitmentCardCount: 3 },
    rules: {
      maxCoreMembers: 3,
      maxProjectsPerParticipant: 1,
      maxChallengesPerProject: 2,
      teamDeadline: '2026-11-12T15:59:00.000Z',
      deadlinePassed: false,
    },
    ...overrides,
  }
}

const CHALLENGES = [
  {
    id: 3,
    seasonId: 7,
    title: '峰谷电价预测',
    realProblem: null,
    targetCustomer: null,
    minimumDeliverable: null,
    resourceCommitment: null,
    resultEvidenceRules: null,
    status: ChallengeStatus.Published,
    version: 2,
    createdBy: '1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    type: '企业命题',
    capacity: 5,
    selectedCount: 1,
  },
  {
    id: 9,
    seasonId: 7,
    title: 'AI 基建用电地图',
    realProblem: null,
    targetCustomer: null,
    minimumDeliverable: null,
    resourceCommitment: null,
    resultEvidenceRules: null,
    status: ChallengeStatus.Reference,
    version: 1,
    createdBy: '1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    type: null,
    capacity: null,
    selectedCount: 0,
  },
]

const PROJECT = {
  id: 70,
  seasonId: 7,
  projectId: 11,
  ownerUserId: '9001',
  source: SeasonProjectSource.Created,
  name: '峰谷电价计算器',
  tagline: '帮工厂看清每度电的时段成本',
  themes: ['新能源与储能'],
  challengeIds: [3],
  challenges: [
    { id: 3, title: '峰谷电价预测', type: '企业命题', capacity: 5, selectedCount: 1 },
  ],
  status: SeasonProjectStatus.Published,
  members: [
    { userId: '9001', name: '周默', avatarUrl: null, role: 'owner', status: 'accepted' },
    { userId: '9002', name: '李想', avatarUrl: null, role: 'core', status: 'accepted' },
  ],
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
}

const RECRUITMENT_CARD = {
  id: 21,
  seasonId: 7,
  seasonProjectId: 70,
  projectName: '峰谷电价计算器',
  creatorUserId: '9001',
  creator: { userId: '9001', name: '周默', avatarUrl: null },
  roles: ['前端', '数据分析'],
  skills: ['小程序'],
  description: '做一个冷库电费看板，每周投入 6 小时',
  deadline: '2026-11-19T15:59:59.000Z',
  status: RecruitmentCardStatus.Open,
  applicationCount: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

const RECEIVED_APPLICATION = {
  id: 31,
  cardId: 21,
  applicantUserId: '9003',
  applicant: { userId: '9003', name: '江河', avatarUrl: null },
  message: '我是前端，做过两个小程序',
  status: RecruitmentApplicationStatus.Pending,
  decidedAt: null,
  createdAt: '2026-11-08T04:00:00.000Z',
  card: {
    id: 21,
    projectName: '峰谷电价计算器',
    roles: ['前端'],
    deadline: '2026-11-19T15:59:59.000Z',
    status: RecruitmentCardStatus.Open,
  },
}

const SENT_APPLICATION = {
  id: 41,
  cardId: 22,
  applicantUserId: '9001',
  applicant: { userId: '9001', name: '周默', avatarUrl: null },
  message: '我想加入',
  status: RecruitmentApplicationStatus.Pending,
  decidedAt: null,
  createdAt: '2026-11-08T00:00:00.000Z',
  card: {
    id: 22,
    projectName: '冷库电费管家',
    roles: ['后端'],
    deadline: '2026-11-20T15:59:59.000Z',
    status: RecruitmentCardStatus.Open,
  },
}

function renderWorkbench(overrides: Partial<TeamWorkbenchDto> = {}) {
  return render(
    <TeamWorkbench
      data={workbench(overrides)}
      challenges={CHALLENGES}
      bringableProjects={[{ id: 42, name: '旧项目' }]}
    />,
  )
}

beforeEach(() => {
  refresh.mockClear()
})

describe('TeamWorkbench · 5 张卡', () => {
  it('renders the five cards with their headings', () => {
    renderWorkbench()
    expect(screen.getByRole('heading', { name: '还没有项目' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '退出赛季' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '找队友' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '招募卡与申请' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '组队规则' })).toBeInTheDocument()
  })

  it('shows the empty-project copy and the create entry point', () => {
    renderWorkbench()
    expect(
      screen.getByText('等发起人登记你，或者自己发起一个（允许单人项目）。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发起项目' })).toBeInTheDocument()
  })

  it('shows the project details when a season project exists', () => {
    renderWorkbench({ project: PROJECT })
    expect(screen.getByRole('heading', { name: '峰谷电价计算器' })).toBeInTheDocument()
    expect(screen.getByText('赛季内新建')).toBeInTheDocument()
    expect(screen.getByText('已发布')).toBeInTheDocument()
    expect(screen.getByText('新能源与储能')).toBeInTheDocument()
    expect(screen.getByText('峰谷电价预测')).toBeInTheDocument()
    expect(screen.getByText(/发起人 周默/)).toBeInTheDocument()
    expect(screen.getByText(/1 位核心成员/)).toBeInTheDocument()
  })

  it('renders the teammate-finding copy with the live count and the talents link', () => {
    renderWorkbench()
    expect(
      screen.getByText('A4BBS 还有 6 位已通过报名、还没组队的选手。'),
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /去共鸣之地看 A4BBS 未组队选手/ })
    expect(link).toHaveAttribute('href', '/talents')
    expect(screen.getByText(/不展示联系方式/)).toBeInTheDocument()
  })

  it('renders the six rule bullets generated from the season config', () => {
    renderWorkbench()
    const items = within(screen.getByRole('list', { name: '' })).queryAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(6)
    expect(screen.getByText('核心团队 1—3 人，允许单人项目')).toBeInTheDocument()
    expect(
      screen.getByText('本赛季每人原则上 1 个项目；组队与命题变更截止 11月12日 23:59'),
    ).toBeInTheDocument()
    expect(screen.getByText(/成员退出不删除作品、积分与 Track Record/)).toBeInTheDocument()
  })

  it('explains that no recruitment card has been published yet', () => {
    renderWorkbench()
    expect(screen.getByText('你还没有发布招募卡。')).toBeInTheDocument()
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发布招募卡' })).toBeInTheDocument()
  })

  it('shows my sent applications with status and relative time', () => {
    renderWorkbench({ myApplications: [SENT_APPLICATION] })
    expect(screen.getByText('冷库电费管家')).toBeInTheDocument()
    expect(screen.getByText('待处理')).toBeInTheDocument()
    expect(screen.getByText(/接受申请不等于登记为赛季核心成员/)).toBeInTheDocument()
  })
})

describe('TeamWithdrawCard · 二次确认', () => {
  it('asks for confirmation before calling the API', async () => {
    const user = userEvent.setup()
    let called = false
    server.use(
      http.post('/api/seasons/7/participants/9001/withdraw', () => {
        called = true
        return HttpResponse.json({ status: 'withdrawn' })
      }),
    )

    renderWorkbench()
    await user.click(screen.getByRole('button', { name: '退出 A4BBS' }))
    expect(called).toBe(false)
    expect(screen.getByRole('button', { name: '确认退出 A4BBS' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认退出 A4BBS' }))
    await waitFor(() => expect(called).toBe(true))
    expect(refresh).toHaveBeenCalled()
  })

  it('can cancel the confirmation without calling the API', async () => {
    const user = userEvent.setup()
    let called = false
    server.use(
      http.post('/api/seasons/7/participants/9001/withdraw', () => {
        called = true
        return HttpResponse.json({ status: 'withdrawn' })
      }),
    )

    renderWorkbench()
    await user.click(screen.getByRole('button', { name: '退出 A4BBS' }))
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(called).toBe(false)
    expect(screen.getByRole('button', { name: '退出 A4BBS' })).toBeInTheDocument()
  })

  it('shows the backend message when the withdrawal fails', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/seasons/7/participants/9001/withdraw', () =>
        HttpResponse.json(
          { error: { code: 'PARTICIPANT_WITHDRAW_LOCKED', message: '组队截止后请由主办方处理退出' } },
          { status: 409 },
        ),
      ),
    )

    renderWorkbench()
    await user.click(screen.getByRole('button', { name: '退出 A4BBS' }))
    await user.click(screen.getByRole('button', { name: '确认退出 A4BBS' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('组队截止后请由主办方处理退出')
  })

  it('explains why withdrawal is unavailable once the deadline passed', () => {
    renderWorkbench({
      participant: { userId: '9001', status: 'active', wechatStatus: 'joined', canWithdraw: false },
      rules: {
        maxCoreMembers: 3,
        maxProjectsPerParticipant: 1,
        maxChallengesPerProject: 2,
        teamDeadline: '2026-11-01T15:59:00.000Z',
        deadlinePassed: true,
      },
    })
    expect(screen.getByText('组队已截止，退出请找主办方处理。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /退出 A4BBS/ })).not.toBeInTheDocument()
  })
})

describe('TeamRecruitmentDialog · 发布招募卡', () => {
  it('opens with the contract description and a prefilled project', async () => {
    const user = userEvent.setup()
    renderWorkbench({ project: PROJECT })

    await user.click(screen.getByRole('button', { name: '发布招募卡' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('heading', { name: '发布招募卡' })).toBeInTheDocument()
    expect(
      within(dialog).getByText(/招募卡（P1）出现在共鸣之地/),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/项目/)).toHaveValue(String(PROJECT.id))
    expect(within(dialog).getByLabelText(/需要的角色/)).toHaveValue('')
  })

  it('validates before submitting and points at each field', async () => {
    const user = userEvent.setup()
    let called = false
    server.use(
      http.post('/api/seasons/7/recruitment-cards', () => {
        called = true
        return HttpResponse.json(RECRUITMENT_CARD)
      }),
    )

    renderWorkbench({ project: PROJECT })
    await user.click(screen.getByRole('button', { name: '发布招募卡' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '发布' }))

    expect(called).toBe(false)
    expect(within(dialog).getByText('请至少填写 1 个需要的角色')).toBeInTheDocument()
    expect(
      within(dialog).getByText('请填写说明：要做什么、每周需要投入多少'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('请选择截止日期')).toBeInTheDocument()
  })

  it('submits the split roles/skills and refreshes the server data', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.post('/api/seasons/7/recruitment-cards', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(RECRUITMENT_CARD)
      }),
    )

    renderWorkbench({ project: PROJECT })
    await user.click(screen.getByRole('button', { name: '发布招募卡' }))
    const dialog = screen.getByRole('dialog')

    await user.type(within(dialog).getByLabelText(/需要的角色/), '前端，数据分析')
    await user.type(within(dialog).getByLabelText(/技能关键词/), '小程序, Python')
    await user.type(
      within(dialog).getByLabelText(/说明/),
      '做一个冷库电费看板，每周投入 6 小时',
    )
    await user.type(within(dialog).getByLabelText(/截止日期/), '2026-11-19')
    await user.click(within(dialog).getByRole('button', { name: '发布' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toMatchObject({
      seasonProjectId: PROJECT.id,
      roles: ['前端', '数据分析'],
      skills: ['小程序', 'Python'],
      description: '做一个冷库电费看板，每周投入 6 小时',
      deadline: '2026-11-19T15:59:59.000Z',
    })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderWorkbench({ project: PROJECT })
    await user.click(screen.getByRole('button', { name: '发布招募卡' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('TeamProjectDialog · 发起项目', () => {
  it('opens with the season code, the existing-project warning and the challenge hint', async () => {
    const user = userEvent.setup()
    renderWorkbench()

    await user.click(screen.getByRole('button', { name: '发起项目' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: '发起项目 · A4BBS' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/你在产品共生里已经有「旧项目」/),
    ).toBeInTheDocument()
    // 参考资料命题不可选，并在底部点名。
    expect(
      within(dialog).getByText('「AI 基建用电地图」是参考资料，不能正式选择。'),
    ).toBeInTheDocument()
    // 已发布命题以「标题 / 类型 · 版本 · 已选 N / 容量」呈现。
    expect(within(dialog).getByText('企业命题 · v2 · 已选 1 / 5')).toBeInTheDocument()
  })

  it('validates the name and the challenge selection before submitting', async () => {
    const user = userEvent.setup()
    let called = false
    server.use(
      http.post('/api/seasons/7/projects', () => {
        called = true
        return HttpResponse.json(PROJECT)
      }),
    )

    renderWorkbench()
    await user.click(screen.getByRole('button', { name: '发起项目' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '发布为「种子」' }))

    expect(called).toBe(false)
    expect(within(dialog).getByText('请填写项目名称')).toBeInTheDocument()
    expect(within(dialog).getByText('请至少选择 1 个命题')).toBeInTheDocument()
  })

  it('submits a create payload and refreshes', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.post('/api/seasons/7/projects', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(PROJECT)
      }),
    )

    renderWorkbench()
    await user.click(screen.getByRole('button', { name: '发起项目' }))
    const dialog = screen.getByRole('dialog')

    await user.type(within(dialog).getByLabelText(/项目名称/), '冷库电费管家')
    await user.type(within(dialog).getByLabelText(/一句话介绍/), '帮冷库老板省电费')
    await user.click(within(dialog).getByRole('checkbox', { name: '峰谷电价预测' }))
    await user.click(within(dialog).getByRole('button', { name: '发布为「种子」' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toMatchObject({
      mode: 'create',
      name: '冷库电费管家',
      tagline: '帮冷库老板省电费',
      challengeIds: [3],
    })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('switches to bring mode from the warning bar', async () => {
    const user = userEvent.setup()
    renderWorkbench()
    await user.click(screen.getByRole('button', { name: '发起项目' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '改为带入已有项目' }))
    expect(within(dialog).getByLabelText(/带入哪个项目/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/项目名称/)).not.toBeInTheDocument()
  })
})

describe('TeamRecruitmentApplyDialog · 申请', () => {
  it('validates the message before submitting', async () => {
    const user = userEvent.setup()
    let called = false
    server.use(
      http.post('/api/recruitment-cards/21/apply', () => {
        called = true
        return HttpResponse.json(SENT_APPLICATION)
      }),
    )

    render(
      <TeamRecruitmentApplyDialog cardId={21} projectName="峰谷电价计算器" roles={['前端']} />,
    )
    await user.click(screen.getByRole('button', { name: '申请加入' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '提交申请' }))

    expect(called).toBe(false)
    expect(within(dialog).getByText('请填写申请说明：你是谁、能做什么')).toBeInTheDocument()
  })

  it('submits the trimmed message and refreshes', async () => {
    const user = userEvent.setup()
    let body: unknown
    server.use(
      http.post('/api/recruitment-cards/21/apply', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(SENT_APPLICATION)
      }),
    )

    render(
      <TeamRecruitmentApplyDialog cardId={21} projectName="峰谷电价计算器" roles={['前端']} />,
    )
    await user.click(screen.getByRole('button', { name: '申请加入' }))
    const dialog = screen.getByRole('dialog')
    await user.type(
      within(dialog).getByLabelText(/申请说明/),
      '  我是前端，做过两个小程序  ',
    )
    await user.click(within(dialog).getByRole('button', { name: '提交申请' }))

    await waitFor(() => expect(body).toEqual({ message: '我是前端，做过两个小程序' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the backend message for a duplicate application', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/recruitment-cards/21/apply', () =>
        HttpResponse.json(
          { error: { code: 'RECRUITMENT_APPLICATION_DUPLICATED', message: '你已经申请过这张卡' } },
          { status: 409 },
        ),
      ),
    )

    render(
      <TeamRecruitmentApplyDialog cardId={21} projectName="峰谷电价计算器" roles={['前端']} />,
    )
    await user.click(screen.getByRole('button', { name: '申请加入' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/申请说明/), '我是前端')
    await user.click(within(dialog).getByRole('button', { name: '提交申请' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('你已经申请过这张卡')
  })
})

describe('TeamRecruitmentCard · 收到的申请', () => {
  it('lists the received applications and accepts one', async () => {
    const user = userEvent.setup()
    let patched: unknown
    server.use(
      http.get('/api/recruitment-cards/21/applications', () =>
        HttpResponse.json({ items: [RECEIVED_APPLICATION] }),
      ),
      http.patch('/api/recruitment-applications/31', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ ...RECEIVED_APPLICATION, status: 'accepted' })
      }),
    )

    renderWorkbench({ project: PROJECT, recruitmentCard: RECRUITMENT_CARD })

    expect(await screen.findByText('江河')).toBeInTheDocument()
    expect(screen.getByText('我是前端，做过两个小程序')).toBeInTheDocument()
    expect(screen.getByText('前端')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '接受' }))
    await waitFor(() => expect(patched).toEqual({ status: 'accepted' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByText('已接受')).toBeInTheDocument()
  })

  it('declines an application and shows the backend message on failure', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/recruitment-cards/21/applications', () =>
        HttpResponse.json({ items: [RECEIVED_APPLICATION] }),
      ),
      http.patch('/api/recruitment-applications/31', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: '只有卡片发起人可以处理申请' } },
          { status: 403 },
        ),
      ),
    )

    renderWorkbench({ project: PROJECT, recruitmentCard: RECRUITMENT_CARD })
    await screen.findByText('江河')

    await user.click(screen.getByRole('button', { name: '婉拒' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('只有卡片发起人可以处理申请')
  })

  it('closes the recruitment card', async () => {
    const user = userEvent.setup()
    let patched: unknown
    server.use(
      http.get('/api/recruitment-cards/21/applications', () =>
        HttpResponse.json({ items: [] }),
      ),
      http.patch('/api/recruitment-cards/21', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ ...RECRUITMENT_CARD, status: 'closed' })
      }),
    )

    renderWorkbench({ project: PROJECT, recruitmentCard: RECRUITMENT_CARD })
    await user.click(screen.getByRole('button', { name: '关闭招募' }))
    await waitFor(() => expect(patched).toEqual({ status: 'closed' }))
    expect(refresh).toHaveBeenCalled()
  })
})
