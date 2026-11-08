import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEASON_RULE_DEFAULTS } from '@shenicest/shared'
import { OrganizerHeader } from '@/components/organizer/organizer-header'
import { createSeasonDraft, getSeasonManageDetail } from '@/lib/organizer-api'

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, back: vi.fn(), replace: vi.fn(), preload: vi.fn() }),
  // Header 只通过 SeasonPicker 用到 useTransition/push，但保留 pathname
  // 的桩，避免将来加高亮时测试忽然报错。
  usePathname: () => '/organizer/overview',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/organizer-api', () => ({
  createSeasonDraft: vi.fn(),
  getSeasonManageDetail: vi.fn(),
}))

const ORGANIZER_ORG = { id: 3, name: '储能联盟', memberCount: 4, isMember: true, createdAt: '2026-01-01T00:00:00.000Z' }

const SEASONS = [
  { id: 21, name: '2026 春季赛季', code: 'BL2026A' },
  { id: 11, name: '2025 秋季赛季', code: 'BL2025B' },
]

const PREVIOUS_SEASON = {
  id: 21,
  code: 'BL2026A',
  name: '2026 春季赛季',
  type: 'season',
  city: '上海',
  intro: '储能方向',
  themes: ['储能', 'AI'],
  status: 'active',
  approvedAt: '2026-01-01T00:00:00.000Z',
  pinned: true,
  agreementVersion: 'v2',
  awardingEntity: 'SheNicest',
  participantCapacity: 120,
  organizerOrgIds: [3],
  rules: { ...SEASON_RULE_DEFAULTS, maxCoreMembers: 2 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
}

function renderHeader(overrides: Partial<React.ComponentProps<typeof OrganizerHeader>> = {}) {
  return render(
    <OrganizerHeader
      seasons={SEASONS}
      organizerOrgs={[ORGANIZER_ORG]}
      seasonId={null}
      tab="overview"
      {...overrides}
    />,
  )
}

const picker = () => screen.getByLabelText('赛季') as HTMLSelectElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createSeasonDraft).mockResolvedValue({
    data: { id: 77 } as never,
    error: null,
  })
  vi.mocked(getSeasonManageDetail).mockResolvedValue({ data: PREVIOUS_SEASON as never, error: null })
})

describe('OrganizerHeader season picker', () => {
  it('is disabled when the database has no season', () => {
    renderHeader({ seasons: [] })
    expect(picker()).toBeDisabled()
    expect(screen.getByRole('option', { name: '暂无赛季' })).toBeInTheDocument()
  })

  it('lists the seasons with an “all seasons” option and navigates on change', async () => {
    const user = userEvent.setup()
    renderHeader()
    expect(picker()).toBeEnabled()
    expect(within(picker()).getByRole('option', { name: '全部赛季' })).toBeInTheDocument()

    await user.selectOptions(picker(), '21')
    expect(push).toHaveBeenCalledWith('/organizer/overview?season=21')
  })

  it('keeps the current tab when switching season', async () => {
    const user = userEvent.setup()
    renderHeader({ tab: 'budget', seasonId: 21 })
    await user.selectOptions(picker(), '11')
    expect(push).toHaveBeenCalledWith('/organizer/budget?season=11')
  })
})

describe('OrganizerHeader actions', () => {
  it('disables “复制上季” when there is nothing to copy', () => {
    renderHeader({ seasons: [] })
    expect(screen.getByRole('button', { name: '复制上季' })).toBeDisabled()
  })

  it('opens a blank draft form and creates a draft without publishing anything', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: '发起赛季草稿' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: '发起赛季草稿' })).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/赛季编号/), 'BL2027A')
    await user.type(within(dialog).getByLabelText(/赛季名称/), '2027 春季赛季')
    await user.click(within(dialog).getByRole('button', { name: '创建草稿' }))

    await waitFor(() => expect(createSeasonDraft).toHaveBeenCalledTimes(1))
    const body = vi.mocked(createSeasonDraft).mock.calls[0][0]
    expect(body).toMatchObject({
      code: 'BL2027A',
      name: '2027 春季赛季',
      organizerOrgIds: [3],
      schedule: null,
    })
    // 提交体里没有任何“发布状态”字段。
    expect(body).not.toHaveProperty('status')
    expect(body).not.toHaveProperty('approvedAt')
    expect(push).toHaveBeenCalledWith('/organizer/season-settings?season=77&created=1')
  })

  it('reports a taken season code on the code field', async () => {
    vi.mocked(createSeasonDraft).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        body: { error: { code: 'SEASON_CODE_TAKEN', message: '赛季编号已存在', field: 'code' } },
      },
    } as never)

    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: '发起赛季草稿' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/赛季编号/), 'BL2026A')
    await user.type(within(dialog).getByLabelText(/赛季名称/), '2027 春季赛季')
    await user.click(within(dialog).getByRole('button', { name: '创建草稿' }))

    expect(await within(dialog).findByText('赛季编号已被占用')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('prefills the form from the previous season', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: '复制上季' }))
    const dialog = await screen.findByRole('dialog')

    expect(getSeasonManageDetail).toHaveBeenCalledWith(21)
    expect(within(dialog).getByRole('heading', { name: '复制上季' })).toBeInTheDocument()

    // 编号被换掉、名称进一年；内容字段照搬。
    expect(await within(dialog).findByLabelText(/赛季编号/)).toHaveValue('BL2026B')
    expect(within(dialog).getByLabelText(/赛季名称/)).toHaveValue('2027 春季赛季')
    expect(within(dialog).getByLabelText(/城市/)).toHaveValue('上海')
    expect(within(dialog).getByLabelText(/协议版本/)).toHaveValue('v2')
    expect(within(dialog).getByLabelText(/选手名额/)).toHaveValue(120)
  })

  it('submits the copied draft as a new season', async () => {
    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: '复制上季' }))
    const dialog = await screen.findByRole('dialog')
    await screen.findByLabelText(/赛季编号/)

    await user.click(within(dialog).getByRole('button', { name: '创建草稿' }))
    await waitFor(() => expect(createSeasonDraft).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createSeasonDraft).mock.calls[0][0]).toMatchObject({
      code: 'BL2026B',
      name: '2027 春季赛季',
      type: 'season',
      city: '上海',
      themes: ['储能', 'AI'],
      agreementVersion: 'v2',
      participantCapacity: 120,
    })
    expect(push).toHaveBeenCalledWith('/organizer/season-settings?season=77&created=1')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: '发起赛季草稿' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('explains when the previous season cannot be read', async () => {
    vi.mocked(getSeasonManageDetail).mockResolvedValue({
      data: null,
      error: { status: 403, body: { error: { code: 'NOT_SEASON_ORGANIZER', message: '你没有该赛季的管理权限' } } },
    } as never)

    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: '复制上季' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('你没有该赛季的管理权限')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
