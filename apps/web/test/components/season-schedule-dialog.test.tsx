import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SeasonSchedule } from '@shenicest/shared'
import { SeasonScheduleDialog } from '@/components/organizer/season-settings/season-schedule-dialog'
import { updateSeasonSchedule } from '@/lib/organizer-settings-api'

vi.mock('@/lib/organizer-settings-api', () => ({
  updateSeasonSchedule: vi.fn(),
}))

const SCHEDULE: SeasonSchedule = {
  applyOpen: '2035-01-01T02:00:00.000Z',
  applyClose: '2035-01-10T15:59:00.000Z',
  startAt: '2035-01-15T02:00:00.000Z',
  teamDeadline: '2035-01-20T15:59:00.000Z',
  challengeFreezeAt: '2035-01-19T15:59:00.000Z',
  workDeadline: '2035-02-10T15:59:00.000Z',
  scoreDeadline: '2035-02-20T15:59:00.000Z',
  settleDate: '2035-02-28T10:00:00.000Z',
}

/** 报名相关的两个节点已经过去，其余节点仍在未来。 */
const PAST_SCHEDULE: SeasonSchedule = {
  ...SCHEDULE,
  applyOpen: '2020-01-01T02:00:00.000Z',
  applyClose: '2020-01-10T15:59:00.000Z',
  startAt: '2020-01-15T02:00:00.000Z',
}

function renderDialog(schedule: SeasonSchedule | null = SCHEDULE) {
  const onCancel = vi.fn()
  const onSaved = vi.fn()
  render(
    <SeasonScheduleDialog
      seasonId={7}
      schedule={schedule}
      onCancel={onCancel}
      onSaved={onSaved}
    />,
  )
  return { onCancel, onSaved }
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(updateSeasonSchedule).mockResolvedValue({ data: {} as never, error: null })
})

describe('SeasonScheduleDialog', () => {
  it('prefills the eight milestones with Beijing wall time', () => {
    renderDialog()
    expect(screen.getAllByLabelText(/报名开放|报名截止|开赛|组队截止|命题冻结|作品截止|评分截止|结算日/))
      .toHaveLength(8)
    // 2035-01-01T02:00Z = 北京 10:00
    expect(field('报名开放')).toHaveValue('2035-01-01T10:00')
    // 2035-01-10T15:59Z = 北京 23:59
    expect(field('报名截止')).toHaveValue('2035-01-10T23:59')
  })

  it('locks the milestones that already passed and keeps the rest editable', () => {
    renderDialog(PAST_SCHEDULE)
    expect(field('报名开放')).toBeDisabled()
    expect(field('报名截止')).toBeDisabled()
    expect(field('开赛')).toBeDisabled()
    expect(field('结算日')).toBeEnabled()
    expect(screen.getAllByText('已经过去，不可修改').length).toBe(3)
  })

  it('submits only the changed milestone, together with the announcement', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderDialog()

    await user.clear(field('结算日'))
    await user.type(field('结算日'), '2035-03-02T10:00')
    await user.type(within(screen.getByRole('dialog')).getByLabelText('公告标题'), '赛程微调')
    await user.type(within(screen.getByRole('dialog')).getByLabelText('公告内容'), '结算顺延一天。')
    await user.click(screen.getByRole('button', { name: '保存赛程' }))

    expect(updateSeasonSchedule).toHaveBeenCalledTimes(1)
    const [seasonId, body] = vi.mocked(updateSeasonSchedule).mock.calls[0]
    expect(seasonId).toBe(7)
    expect(body.announcement).toEqual({ title: '赛程微调', content: '结算顺延一天。' })
    // 北京 10:00 提交后仍是同一个绝对时刻；没改的节点一个都不发。
    expect(body.schedule).toEqual({ settleDate: '2035-03-02T02:00:00.000Z' })
    expect(onSaved).toHaveBeenCalled()
  })

  it('does not send locked milestones even when the rest changes', async () => {
    const user = userEvent.setup()
    renderDialog(PAST_SCHEDULE)

    await user.clear(field('组队截止'))
    await user.type(field('组队截止'), '2035-01-25T10:00')
    await user.click(screen.getByRole('button', { name: '保存赛程' }))

    const [, body] = vi.mocked(updateSeasonSchedule).mock.calls[0]
    expect(body.schedule).toEqual({ teamDeadline: '2035-01-25T02:00:00.000Z' })
    expect(body.announcement).toBeUndefined()
  })

  it('allows saving an announcement without changing any milestone', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(within(screen.getByRole('dialog')).getByLabelText('公告标题'), '赛程说明')
    await user.type(within(screen.getByRole('dialog')).getByLabelText('公告内容'), '本周不改时间。')
    await user.click(screen.getByRole('button', { name: '保存赛程' }))

    const [, body] = vi.mocked(updateSeasonSchedule).mock.calls[0]
    expect(body.schedule).toBeUndefined()
    expect(body.announcement).toEqual({ title: '赛程说明', content: '本周不改时间。' })
  })

  it('refuses to submit when nothing changed at all', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderDialog()

    await user.click(screen.getByRole('button', { name: '保存赛程' }))

    expect(updateSeasonSchedule).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByText('没有需要保存的改动：改一个时间，或填写一条公告')).toBeInTheDocument()
  })

  it('rejects an out-of-order milestone before calling the API', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderDialog()

    await user.clear(field('报名截止'))
    await user.type(field('报名截止'), '2034-12-01T00:00')
    await user.click(screen.getByRole('button', { name: '保存赛程' }))

    expect(updateSeasonSchedule).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByText('请先修正赛程里标红的字段')).toBeInTheDocument()
  })

  it('refuses to clear an already scheduled season instead of sending an empty patch', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: '重置' }))
    // 重置回到已保存版本，不会把输入框清空。
    expect(field('报名开放')).toHaveValue('2035-01-01T10:00')

    for (const label of ['报名开放', '报名截止', '开赛', '组队截止', '命题冻结', '作品截止', '评分截止', '结算日']) {
      await user.clear(field(label))
    }
    await user.click(screen.getByRole('button', { name: '保存赛程' }))

    expect(updateSeasonSchedule).not.toHaveBeenCalled()
    expect(screen.getByText('赛程不能全部留空：八个节点都需要填写时间')).toBeInTheDocument()
  })

  it('shows the backend message when a locked milestone is rejected', async () => {
    vi.mocked(updateSeasonSchedule).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        body: { error: { code: 'SCHEDULE_MILESTONE_LOCKED', message: '报名截止已经过去，不能再修改' } },
      },
    } as never)
    const user = userEvent.setup()
    renderDialog(PAST_SCHEDULE)

    await user.clear(field('结算日'))
    await user.type(field('结算日'), '2035-03-02T10:00')
    await user.click(screen.getByRole('button', { name: '保存赛程' }))

    await waitFor(() =>
      expect(screen.getByText('报名截止已经过去，不能再修改')).toBeInTheDocument(),
    )
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderDialog()

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
})
