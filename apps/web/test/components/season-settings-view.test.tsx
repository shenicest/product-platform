import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEASON_REQUIRED_RULE_CARD_LABELS, SEASON_RULE_DEFAULTS } from '@shenicest/shared'
import { SeasonSettingsView } from '@/components/organizer/season-settings/season-settings-view'
import { SeasonInfoPreview } from '@/components/organizer/season-settings/rule-card-preview'
import type { SeasonSettingsDetail } from '@/lib/organizer-settings'
import type { SeasonReadiness } from '@/lib/organizer'
import { createSeasonDraft } from '@/lib/organizer-api'
import {
  submitSeason,
  suspendSeason,
  cancelSeason,
  updateSeasonCore,
  updateSeasonOrganizers,
  updateSeasonRules,
  updateSeasonSchedule,
  updateSeasonThemes,
} from '@/lib/organizer-settings-api'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn(), back: vi.fn(), preload: vi.fn() }),
  usePathname: () => '/organizer/season-settings',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/organizer-api', () => ({
  createSeasonDraft: vi.fn(),
  getSeasonManageDetail: vi.fn(),
}))

vi.mock('@/lib/organizer-settings-api', () => ({
  updateSeasonCore: vi.fn(),
  updateSeasonSchedule: vi.fn(),
  updateSeasonRules: vi.fn(),
  updateSeasonRuleCard: vi.fn(),
  updateSeasonThemes: vi.fn(),
  updateSeasonOrganizers: vi.fn(),
  submitSeason: vi.fn(),
  approveSeason: vi.fn(),
  rejectSeason: vi.fn(),
  startSeason: vi.fn(),
  suspendSeason: vi.fn(),
  resumeSeason: vi.fn(),
  cancelSeason: vi.fn(),
  createSeasonAnnouncement: vi.fn(),
}))

const ORG = { id: 3, name: '储能联盟', memberCount: 4, isMember: true, createdAt: '2026-01-01T00:00:00.000Z' }

const RULE_CARD = [
  {
    id: 1,
    key: 'max_project_challenges',
    label: '每个项目可选命题上限',
    value: '3 个',
    required: true,
    visible: true,
    sortOrder: 0,
  },
  {
    id: 2,
    key: 'custom_note',
    label: '自定义条目',
    value: '自定义内容',
    required: false,
    visible: true,
    sortOrder: 1,
  },
]

function detail(overrides: Partial<SeasonSettingsDetail> = {}): SeasonSettingsDetail {
  return {
    id: 7,
    code: 'BL2027A',
    name: '2027 春季赛季',
    type: 'season',
    city: '上海',
    status: 'draft',
    themes: ['储能'],
    schedule: null,
    organizerOrgs: [{ id: 3, name: '储能联盟' }],
    organizerOrgIds: [3],
    pinned: false,
    approvedAt: null,
    participantCapacity: 60,
    participantCount: 0,
    publishedChallengeCount: 0,
    intro: '介绍',
    ruleCard: RULE_CARD,
    rulesVersion: 1,
    awardingEntity: null,
    agreementVersion: 'v1',
    startedAt: null,
    applicationWindow: { opensAt: null, closesAt: null, isOpen: false },
    rules: SEASON_RULE_DEFAULTS,
    pendingApproval: false,
    rejection: null,
    timestamps: {
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      startedAt: null,
      suspendedAt: null,
      statusBeforeSuspend: null,
      resumedAt: null,
      cancelledAt: null,
      cancelReason: null,
    },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  } as SeasonSettingsDetail
}

function readiness(ready: boolean): SeasonReadiness {
  return {
    seasonId: 7,
    ready,
    checks: [
      { key: 'schedule', label: '赛程完整', passed: ready, ...(ready ? {} : { detail: '赛程尚未填写完整' }) },
      { key: 'challenges', label: '至少一个已发布命题', passed: ready },
    ],
    generatedAt: '2026-11-01T00:00:00.000Z',
  }
}

function renderView(overrides: {
  detail?: Partial<SeasonSettingsDetail>
  ready?: boolean
  readiness?: SeasonReadiness | null
  isOperator?: boolean
} = {}) {
  return render(
    <SeasonSettingsView
      detail={detail(overrides.detail)}
      readiness={overrides.readiness === undefined ? readiness(overrides.ready ?? true) : overrides.readiness}
      announcements={[]}
      organizerOrgs={[ORG]}
      isOperator={overrides.isOperator ?? false}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(submitSeason).mockResolvedValue({ data: {} as never, error: null })
  vi.mocked(suspendSeason).mockResolvedValue({ data: {} as never, error: null })
  vi.mocked(cancelSeason).mockResolvedValue({ data: {} as never, error: null })
  vi.mocked(updateSeasonCore).mockResolvedValue({ data: {} as never, error: null })
  vi.mocked(updateSeasonSchedule).mockResolvedValue({ data: {} as never, error: null })
  vi.mocked(updateSeasonRules).mockResolvedValue({ data: {} as never, error: null })
  vi.mocked(updateSeasonThemes).mockResolvedValue({ data: { themes: [] } as never, error: null })
  vi.mocked(updateSeasonOrganizers).mockResolvedValue({ data: {} as never, error: null })
})

describe('SeasonSettingsView · draft season', () => {
  it('shows the draft notice, readiness score and the season facts', () => {
    renderView()
    expect(screen.getByText('草稿 · 未公开')).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
    // 编号 / 名称同时出现在概要卡和「预览 · 赛季信息」里。
    expect(screen.getAllByText('BL2027A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2027 春季赛季').length).toBeGreaterThan(0)
    expect(screen.getAllByText('储能联盟').length).toBeGreaterThan(0)
  })

  it('keeps 提交待批 disabled while readiness has missing checks', () => {
    const { container } = renderView({ ready: false })
    expect(screen.getByRole('button', { name: '提交待批' })).toBeDisabled()
    // 文案被计数节点打断，直接比对整段 textContent。
    const hint = [...container.querySelectorAll('p')]
      .map((node) => node.textContent ?? '')
      .find((text) => text.includes('发布门槛还有'))
    expect(hint).toBe('发布门槛还有 2 项未通过，提交与批准暂不可用。')
  })

  it('submits an operator draft directly and refreshes', async () => {
    const user = userEvent.setup()
    renderView({ isOperator: true })
    await user.click(screen.getByRole('button', { name: '发布（管理员直接生效）' }))

    expect(submitSeason).toHaveBeenCalledWith(7)
    expect(refresh).toHaveBeenCalled()
  })

  it('reports the backend message when an action fails', async () => {
    vi.mocked(submitSeason).mockResolvedValue({
      data: null,
      error: { status: 409, body: { error: { code: 'SEASON_NOT_READY', message: '赛季尚未满足发布条件' } } },
    } as never)

    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: '提交待批' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('赛季尚未满足发布条件')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('requires a reason before cancelling and sends it to the API', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: '取消赛季' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '确认取消' }))
    expect(cancelSeason).not.toHaveBeenCalled()
    expect(within(dialog).getByText('请填写至少 2 个字符的原因')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/原因/), '方向调整')
    await user.click(within(dialog).getByRole('button', { name: '确认取消' }))

    expect(cancelSeason).toHaveBeenCalledWith(7, '方向调整')
    expect(refresh).toHaveBeenCalled()
  })

  it('does not offer approval to a non-operator', () => {
    renderView({ detail: { status: 'upcoming', pendingApproval: true }, isOperator: false })
    expect(screen.queryByRole('button', { name: '批准' })).not.toBeInTheDocument()
    // 概要卡的 chip 与顶部横幅都会写「待批准」。
    expect(screen.getAllByText('待批准').length).toBeGreaterThan(0)
  })

  it('offers approval to an operator on a pending season', () => {
    renderView({ detail: { status: 'upcoming', pendingApproval: true }, isOperator: true })
    expect(screen.getByRole('button', { name: '批准' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '驳回' })).toBeInTheDocument()
  })
})

describe('SeasonSettingsView · 草稿编辑弹窗', () => {
  const SCHEDULE = {
    applyOpen: '2026-11-01T02:00:00.000Z',
    applyClose: '2026-11-10T02:00:00.000Z',
    startAt: '2026-11-20T02:00:00.000Z',
    teamDeadline: '2026-11-25T02:00:00.000Z',
    challengeFreezeAt: '2026-11-24T02:00:00.000Z',
    workDeadline: '2026-12-01T02:00:00.000Z',
    scoreDeadline: '2026-12-05T02:00:00.000Z',
    settleDate: '2026-12-10T02:00:00.000Z',
  }

  it('offers the 编辑 entry only for a draft season', () => {
    renderView()
    expect(screen.getByRole('button', { name: '编辑赛季草稿' })).toBeInTheDocument()
  })

  it('hides the 编辑 entry once the season is no longer a draft', () => {
    renderView({
      detail: { status: 'upcoming', timestamps: { ...detail().timestamps, approvedAt: '2026-10-01T00:00:00.000Z' } },
    })
    expect(screen.queryByRole('button', { name: '编辑赛季草稿' })).not.toBeInTheDocument()
  })

  it('prefills name, schedule and rules from the current season', async () => {
    const user = userEvent.setup()
    renderView({
      detail: {
        schedule: SCHEDULE,
        rules: { ...SEASON_RULE_DEFAULTS, maxCoreMembers: 2 },
      },
    })

    await user.click(screen.getByRole('button', { name: '编辑赛季草稿' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: '编辑赛季草稿' })).toBeInTheDocument()

    // 名称与编号回填；编号在编辑模式下只读（后端 PATCH 不接受 code）。
    expect(within(dialog).getByLabelText(/赛季名称/)).toHaveValue('2027 春季赛季')
    expect(within(dialog).getByLabelText(/赛季编号/)).toHaveValue('BL2027A')
    expect(within(dialog).getByLabelText(/赛季编号/)).toHaveAttribute('readonly')

    // 赛程按北京时间回填成 datetime-local（UTC 02:00 → 10:00）。
    expect(within(dialog).getByLabelText('报名开放')).toHaveValue('2026-11-01T10:00')
    expect(within(dialog).getByLabelText('结算日')).toHaveValue('2026-12-10T10:00')

    // 规则回填。
    expect(within(dialog).getByLabelText('团队核心成员上限')).toHaveValue(2)
  })

  it('updates the current season instead of creating a new one', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: '编辑赛季草稿' }))
    const dialog = await screen.findByRole('dialog')
    const nameInput = within(dialog).getByLabelText(/赛季名称/)
    await user.clear(nameInput)
    await user.type(nameInput, '2027 春季赛季（改）')
    await user.click(within(dialog).getByRole('button', { name: '保存修改' }))

    await waitFor(() => expect(updateSeasonCore).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateSeasonCore).mock.calls[0][0]).toBe(7)
    expect(vi.mocked(updateSeasonCore).mock.calls[0][1]).toMatchObject({ name: '2027 春季赛季（改）' })
    // 走的是更新而不是新建。
    expect(createSeasonDraft).not.toHaveBeenCalled()
    // 其它块没改就不发 PUT（否则会凭空生成公告与规则版本）。
    expect(updateSeasonSchedule).not.toHaveBeenCalled()
    expect(updateSeasonRules).not.toHaveBeenCalled()
    expect(updateSeasonThemes).not.toHaveBeenCalled()
    expect(updateSeasonOrganizers).not.toHaveBeenCalled()
    // 成功后刷新并关闭。
    expect(refresh).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('also saves the schedule and typed rules when they changed', async () => {
    const user = userEvent.setup()
    renderView({ detail: { schedule: SCHEDULE } })

    await user.click(screen.getByRole('button', { name: '编辑赛季草稿' }))
    const dialog = await screen.findByRole('dialog')

    const settle = within(dialog).getByLabelText('结算日')
    await user.clear(settle)
    await user.type(settle, '2026-12-12T10:00')

    const members = within(dialog).getByLabelText('团队核心成员上限')
    await user.clear(members)
    await user.type(members, '2')

    await user.click(within(dialog).getByRole('button', { name: '保存修改' }))

    await waitFor(() => expect(updateSeasonSchedule).toHaveBeenCalledTimes(1))
    const schedule = vi.mocked(updateSeasonSchedule).mock.calls[0][1].schedule
    // 北京时间 2026-12-12 10:00 → UTC 02:00。
    expect(schedule.settleDate).toBe('2026-12-12T02:00:00.000Z')
    expect(schedule.applyOpen).toBe(SCHEDULE.applyOpen)

    expect(updateSeasonRules).toHaveBeenCalledTimes(1)
    expect(vi.mocked(updateSeasonRules).mock.calls[0][1].rules.maxCoreMembers).toBe(2)
    expect(createSeasonDraft).not.toHaveBeenCalled()
  })

  it('shows the backend message when updating fails', async () => {
    vi.mocked(updateSeasonCore).mockResolvedValue({
      data: null,
      error: { status: 409, body: { error: { code: 'SEASON_INVALID_STATUS', message: '当前状态不能修改赛季' } } },
    } as never)

    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: '编辑赛季草稿' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '保存修改' }))

    expect(await within(dialog).findByText('当前状态不能修改赛季')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('SeasonSettingsView · active season', () => {
  it('locks typed rules but keeps the schedule editable', () => {
    renderView({
      detail: { status: 'active', timestamps: { ...detail().timestamps, approvedAt: '2026-10-01T00:00:00.000Z' } },
    })
    expect(screen.getByRole('button', { name: '修改规则' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '改赛程' })).toBeEnabled()
    expect(screen.getByText('开赛后不能修改类型化规则。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '提交待批' })).not.toBeInTheDocument()
  })

  it('shows the cancellation reason instead of the draft banner', () => {
    renderView({
      detail: {
        status: 'cancelled',
        timestamps: { ...detail().timestamps, cancelReason: '方向调整' },
      },
    })
    expect(screen.getByText('取消原因：方向调整')).toBeInTheDocument()
    expect(screen.queryByText('草稿 · 未公开')).not.toBeInTheDocument()
  })
})

describe('SeasonSettingsView · rule card', () => {
  it('renders the editor rows and the season-info preview from the same draft', () => {
    renderView()
    const table = screen.getByRole('table', { name: /规则卡条目/ })
    expect(within(table).getAllByRole('row')).toHaveLength(RULE_CARD.length + 1)
    // 预览改成「赛季信息」：必要条目的 value 原样展示。
    const preview = screen.getByRole('region', { name: '预览 · 赛季信息' })
    expect(within(preview).getByText('3 个')).toBeInTheDocument()
    expect(within(preview).getByText('2027 春季赛季')).toBeInTheDocument()
    // 没配置的必要条目显示占位。
    expect(within(preview).getAllByText('—').length).toBeGreaterThan(0)
    // 可选条目不再出现在预览里。
    expect(within(preview).queryByText('自定义内容')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存规则卡' })).toBeDisabled()
  })

  it('adds a custom item through the dialog and marks the draft as unsaved', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: '新增规则' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/条目名称/), '新增的规则')
    await user.type(within(dialog).getByLabelText(/条目内容/), '新增的内容')
    await user.click(within(dialog).getByRole('button', { name: '确认新增' }))

    expect(screen.getByText('有未保存的改动')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存规则卡' })).toBeEnabled()
    expect(screen.getByText('新增的内容')).toBeInTheDocument()
  })

  it('does not mark the draft dirty when the add dialog is cancelled', async () => {
    const user = userEvent.setup()
    renderView()

    await user.click(screen.getByRole('button', { name: '新增规则' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }))

    expect(screen.getByText('与已保存版本一致')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存规则卡' })).toBeDisabled()
  })

  it('shows the announcement empty state for a draft', () => {
    renderView()
    expect(screen.getByText('还没有公告。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发布公告' })).not.toBeInTheDocument()
  })
})

describe('SeasonSettingsView · 赛季主题', () => {
  it('renders the dedicated section with the saved themes', () => {
    renderView()
    const section = screen.getByRole('region', { name: /赛季主题/ })
    expect(within(section).getByRole('table')).toBeInTheDocument()
    expect(within(section).getByText('储能')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: '保存主题' })).toBeDisabled()
    expect(within(section).getByText('主题与已保存版本一致')).toBeInTheDocument()
  })

  it('saves the reordered themes through PUT and refreshes', async () => {
    vi.mocked(updateSeasonThemes).mockResolvedValue({ data: { themes: ['AI', '储能'] }, error: null })
    const user = userEvent.setup()
    renderView({ detail: { themes: ['储能', 'AI'] } })

    const section = screen.getByRole('region', { name: /赛季主题/ })
    await user.click(within(section).getByRole('button', { name: /拖动排序 AI/ }))
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')

    expect(within(section).getByText('主题有未保存的改动')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: '保存主题' }))

    expect(updateSeasonThemes).toHaveBeenCalledWith(7, { themes: ['AI', '储能'] })
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the backend message when saving themes fails', async () => {
    vi.mocked(updateSeasonThemes).mockResolvedValue({
      data: null,
      error: { status: 409, body: { error: { code: 'SEASON_INVALID_STATUS', message: '当前状态不能修改主题' } } },
    } as never)
    const user = userEvent.setup()
    renderView({ detail: { themes: ['储能'] } })

    const section = screen.getByRole('region', { name: /赛季主题/ })
    await user.click(within(section).getByRole('button', { name: '删除主题 储能' }))
    await user.click(within(section).getByRole('button', { name: '保存主题' }))

    expect(await within(section).findByText('当前状态不能修改主题')).toBeInTheDocument()
  })

  it('locks the editor for a cancelled season', () => {
    renderView({ detail: { status: 'cancelled' } })
    const section = screen.getByRole('region', { name: /赛季主题/ })
    expect(within(section).getByRole('button', { name: '新增主题' })).toBeDisabled()
    expect(within(section).getByText(/当前赛季状态不能修改赛季主题/)).toBeInTheDocument()
  })
})

describe('SeasonInfoPreview', () => {
  it('renders the eight shared labels and the draft values', () => {
    render(
      <SeasonInfoPreview
        detail={detail()}
        items={[
          {
            key: 'max_project_challenges',
            label: '项目命题',
            value: '每个项目可选择 1—2 个命题',
            required: true,
            visible: true,
          },
          {
            key: 'custom_note',
            label: '自定义条目',
            value: '不该出现在赛季信息里',
            required: false,
            visible: true,
          },
        ]}
      />,
    )

    // 八行标题全部来自 shared 常量，前端不硬编码。
    for (const label of Object.values(SEASON_REQUIRED_RULE_CARD_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // 草稿里的 value 原样展示（改了还没保存也能预览到）。
    expect(screen.getByText('每个项目可选择 1—2 个命题')).toBeInTheDocument()
    // 可选条目不属于「赛季信息」八行。
    expect(screen.queryByText('不该出现在赛季信息里')).not.toBeInTheDocument()
    // 赛季自身的信息。
    expect(screen.getByText('BL2027A')).toBeInTheDocument()
    expect(screen.getByText(/名额 60/)).toBeInTheDocument()
  })
})
