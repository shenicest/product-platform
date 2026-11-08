import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SeasonParticipantStatus, WechatStatus } from '@shenicest/shared'
import { ManualGroupView } from '@/components/organizer/manual-group/manual-group-view'
import { updateParticipantWechat } from '@/lib/organizer-manual-group-api'
import type { SeasonParticipant } from '@/lib/organizer-manual-group'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn(), back: vi.fn(), preload: vi.fn() }),
  usePathname: () => '/organizer/manual-group',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/organizer-manual-group-api', () => ({
  updateParticipantWechat: vi.fn(),
}))

/**
 * 拉群表的行为。
 *
 * 覆盖四件事：每行的按钮由状态决定、点击后带对的请求体、成功后局部换行 + 刷新、
 * 失败把后端那句话原样摆出来。视觉细节不在这里测（那是 `manual-group-display`
 * 的纯展示契约，靠截图走查）。
 */

function participant(overrides: Partial<SeasonParticipant> = {}): SeasonParticipant {
  return {
    id: 1,
    seasonId: 7,
    userId: '101',
    applicationId: 11,
    wechatStatus: WechatStatus.NotInvited,
    wechatInvitedBy: null,
    wechatInvitedAt: null,
    joinedAt: null,
    status: SeasonParticipantStatus.Active,
    withdrawnAt: null,
    withdrawnBy: null,
    withdrawReason: null,
    applicant: { userId: '101', name: '周默', avatarUrl: null },
    contact: { wechat: 'zhou_b1' },
    reviewedAt: '2026-11-03T07:00:00.000Z',
    wechatInvitedByUser: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderView(participants: SeasonParticipant[]) {
  return render(
    <ManualGroupView seasonId={7} seasonCode="AI4BBS" participants={participants} />,
  )
}

const ROSTER: SeasonParticipant[] = [
  participant({
    id: 1,
    userId: '101',
    applicant: { userId: '101', name: '周默', avatarUrl: null },
    wechatStatus: WechatStatus.Invited,
    // 通过时间（审核那一刻）与记录时间（点邀请那一刻）是两个不同的时刻，
    // 表里也是两列，测试数据不能偷懒用同一个值，否则断言分不清哪格是哪格。
    reviewedAt: '2026-11-03T07:00:00.000Z',
    wechatInvitedBy: '2',
    wechatInvitedAt: '2026-11-04T12:00:00.000Z',
    wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: null },
  }),
  participant({
    id: 2,
    userId: '102',
    applicant: { userId: '102', name: '周正', avatarUrl: null },
    wechatStatus: WechatStatus.Joined,
    joinedAt: '2026-10-24T12:00:00.000Z',
    wechatInvitedBy: '2',
    wechatInvitedAt: '2026-10-24T12:00:00.000Z',
    wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: null },
    contact: { wechat: 'zhengz_b1' },
  }),
  participant({
    id: 3,
    userId: '103',
    applicant: { userId: '103', name: '江河', avatarUrl: null },
    wechatStatus: WechatStatus.Failed,
    wechatInvitedBy: '2',
    wechatInvitedAt: '2026-10-23T12:00:00.000Z',
    wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: null },
    contact: { wechat: 'jiang_b1' },
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ManualGroupView', () => {
  it('explains that inviting is a manual action the platform only records', () => {
    renderView([participant()])
    expect(screen.getByText('拉群是人工动作：')).toBeInTheDocument()
    expect(
      screen.getByText(/平台只记录状态与记录人，不自动发送邀请/),
    ).toBeInTheDocument()
  })

  it('renders one row per participant with contact, recorder, and status', () => {
    renderView(ROSTER)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)

    const first = rows[0]
    expect(within(first).getByText('周默')).toBeInTheDocument()
    expect(within(first).getByText('wx: zhou_b1')).toBeInTheDocument()
    expect(within(first).getByLabelText('微信群状态：已邀请')).toBeInTheDocument()
    // 「通过时间」列取报名的审核时间。
    expect(within(first).getByText('11月3日 15:00')).toBeInTheDocument()
    // 「记录人」列是昵称 + 记录时间（北京时间），两者都在。
    expect(within(first).getByText('李想')).toBeInTheDocument()
    expect(within(first).getByText('11月4日 20:00')).toBeInTheDocument()
  })

  it('summarises the state distribution in the panel header', () => {
    renderView([...ROSTER, participant({ id: 4, userId: '104', wechatStatus: WechatStatus.NotInvited })])
    expect(screen.getByText('4 人')).toBeInTheDocument()
    // 四个状态全列，0 也显示 —— 主办方要知道「邀请失败 0」而不是「没统计到」。
    expect(
      screen.getByText('未邀请 1 · 已邀请 1 · 已加入 1 · 邀请失败 1'),
    ).toBeInTheDocument()
  })

  it('offers the join and failure actions only on the invited row', () => {
    renderView(ROSTER)
    expect(screen.getAllByRole('button', { name: '标记已入群' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: '标记邀请失败' })).toHaveLength(1)
    // 已加入是终态、失败只能重新邀请：这两种行不出现「标记已入群」。
    expect(screen.queryByRole('button', { name: '邀请' })).not.toBeInTheDocument()
  })

  it('offers a re-invite on a failed row', () => {
    renderView([participant({ wechatStatus: WechatStatus.Failed })])
    expect(screen.getByRole('button', { name: '重新邀请' })).toBeInTheDocument()
  })

  it('renders the row actions as icon-only buttons and freezes the action column', () => {
    renderView([participant()])
    const invite = screen.getByRole('button', { name: '邀请' })

    // 图标按钮：没有可见文字，只有一枚 aria-hidden 的 svg。
    expect(invite).toHaveTextContent('')
    expect(invite).toHaveClass('ui-icon-btn', 'ui-icon-btn--sm')
    expect(invite.querySelector('svg')).not.toBeNull()
    expect(invite.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    // 语义不丢：可访问名是动作文案，对象名在 title 里。
    expect(invite).toHaveAttribute('title', '邀请 周默')

    // 宽表：表格挂上冻结操作列的类，外层是横向滚动容器。
    const table = screen.getByRole('table')
    expect(table).toHaveClass('console-table', 'console-table--sticky-actions')
    expect(table.parentElement).toHaveClass('overflow-x-auto')
  })

  it('picks a distinct icon per action so the row is readable without hovering', () => {
    renderView([
      participant({ id: 1, userId: '101', wechatStatus: WechatStatus.NotInvited }),
      participant({
        id: 2,
        userId: '102',
        applicant: { userId: '102', name: '周正', avatarUrl: null },
        wechatStatus: WechatStatus.Invited,
      }),
      participant({
        id: 3,
        userId: '103',
        applicant: { userId: '103', name: '江河', avatarUrl: null },
        wechatStatus: WechatStatus.Failed,
      }),
    ])

    // 三种行的动作形状互不相同：人+加号 / 勾+圆、叉+圆 / 环形箭头。
    const shapes = (name: string) =>
      screen.getByRole('button', { name }).querySelector('svg')?.innerHTML ?? ''
    expect(shapes('邀请')).not.toBe('')
    expect(shapes('邀请')).not.toBe(shapes('重新邀请'))
    expect(shapes('标记已入群')).not.toBe(shapes('标记邀请失败'))
  })

  it('records the invite and swaps the row in place', async () => {
    vi.mocked(updateParticipantWechat).mockResolvedValue({
      data: participant({
        wechatStatus: WechatStatus.Invited,
        wechatInvitedBy: '2',
        wechatInvitedAt: '2026-11-03T07:00:00.000Z',
        wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: null },
      }),
      error: null,
    })

    const user = userEvent.setup()
    renderView([participant()])
    await user.click(screen.getByRole('button', { name: '邀请' }))

    expect(updateParticipantWechat).toHaveBeenCalledWith(7, '101', WechatStatus.Invited)
    expect(await screen.findByRole('status')).toHaveTextContent('已记录为已邀请')
    // 局部换行：状态胶囊与记录人都跟着更新，不用等整页重取。
    expect(screen.getByLabelText('微信群状态：已邀请')).toBeInTheDocument()
    expect(screen.getByText('李想')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('records a join and disables the rest of the table while the request is in flight', async () => {
    let resolveRequest: (value: unknown) => void = () => {}
    vi.mocked(updateParticipantWechat).mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve }) as never,
    )

    const user = userEvent.setup()
    renderView([
      participant({
        wechatStatus: WechatStatus.Invited,
        wechatInvitedBy: '2',
        wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: null },
      }),
      participant({
        id: 2,
        userId: '102',
        applicant: { userId: '102', name: '周正', avatarUrl: null },
        wechatStatus: WechatStatus.Invited,
        wechatInvitedBy: '2',
        wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: null },
      }),
    ])

    const [joinButton] = screen.getAllByRole('button', { name: '标记已入群' })
    await user.click(joinButton)

    // 图标按钮的 pending 态不改可访问名（否则读屏用户会听到一个「处理中…」，
    // 不知道在处理哪件事）：用 `aria-busy` + `title` 表达进行中。
    const [, firstRow, secondRow] = within(screen.getByRole('table')).getAllByRole('row')
    await waitFor(() =>
      expect(within(firstRow).getByRole('button', { name: '标记已入群' })).toBeDisabled(),
    )
    const busyButton = within(firstRow).getByRole('button', { name: '标记已入群' })
    expect(busyButton).toHaveAttribute('aria-busy', 'true')
    expect(busyButton).toHaveAttribute('title', '标记已入群中…（周默）')
    // 同一行的另一颗按钮保持非 busy（只有被点的那颗转圈），但同样禁用。
    expect(within(firstRow).getByRole('button', { name: '标记邀请失败' })).toBeDisabled()
    expect(within(firstRow).getByRole('button', { name: '标记邀请失败' })).not.toHaveAttribute(
      'aria-busy',
    )
    // 别的行也只是禁用，不进入 busy 态。
    expect(within(secondRow).getByRole('button', { name: '标记已入群' })).toBeDisabled()
    expect(within(secondRow).getByRole('button', { name: '标记已入群' })).not.toHaveAttribute(
      'aria-busy',
    )

    resolveRequest({
      data: participant({ wechatStatus: WechatStatus.Joined, joinedAt: '2026-11-03T07:00:00.000Z' }),
      error: null,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('已记录为已加入')
  })

  it('surfaces the backend message on a state-machine conflict', async () => {
    vi.mocked(updateParticipantWechat).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        body: { error: { code: 'WECHAT_STATUS_INVALID', message: '微信状态跳转不合法' } },
      },
    })

    const user = userEvent.setup()
    renderView([participant({ wechatStatus: WechatStatus.Invited })])
    await user.click(screen.getByRole('button', { name: '标记已入群' }))

    expect(await screen.findByText('微信状态跳转不合法')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('surfaces the backend message when the participant already withdrew', async () => {
    vi.mocked(updateParticipantWechat).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        body: { error: { code: 'PARTICIPANT_WITHDRAW_LOCKED', message: '选手已退出赛季' } },
      },
    })

    const user = userEvent.setup()
    renderView([participant()])
    await user.click(screen.getByRole('button', { name: '邀请' }))

    expect(await screen.findByText('选手已退出赛季')).toBeInTheDocument()
  })

  it('disables every action on a withdrawn participant and says why', () => {
    renderView([
      participant({
        status: SeasonParticipantStatus.Withdrawn,
        wechatStatus: WechatStatus.Invited,
        withdrawnAt: '2026-11-01T00:00:00.000Z',
      }),
    ])
    expect(screen.queryByRole('button', { name: '标记已入群' })).not.toBeInTheDocument()
    // 姓名下方标「已退出赛季」，操作列给一句短说明而不是空白。
    expect(screen.getAllByText('已退出赛季').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('选手已退出赛季')).toBeInTheDocument()
  })

  it('explains a terminal joined row instead of leaving the action column blank', () => {
    renderView([
      participant({
        wechatStatus: WechatStatus.Joined,
        joinedAt: '2026-10-24T12:00:00.000Z',
        wechatInvitedBy: '2',
        wechatInvitedByUser: { userId: '2', name: '李想', avatarUrl: null },
      }),
    ])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('已加入为终态')).toBeInTheDocument()
  })

  it('explains the empty roster instead of rendering a bare table', () => {
    renderView([])
    expect(screen.getByText('NO PARTICIPANTS')).toBeInTheDocument()
    expect(
      screen.getByText(/先在「报名审核」里接受报名/),
    ).toBeInTheDocument()
  })
})
