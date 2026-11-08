import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChallengeDraftForm } from '@/components/organizer/challenges/challenge-draft-form'
import type { ChallengeDto } from '@/lib/organizer-challenges'
import { createChallenge, updateChallenge } from '@/lib/organizer-challenges-api'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn(), back: vi.fn(), preload: vi.fn() }),
  usePathname: () => '/organizer/challenges',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/organizer-challenges-api', () => ({
  createChallenge: vi.fn(),
  updateChallenge: vi.fn(),
}))

const THEMES = ['新型储能基建', '全球 AI 基建']

function challenge(overrides: Partial<ChallengeDto> = {}): ChallengeDto {
  return {
    id: 42,
    seasonId: 7,
    title: '储能站点数据预测',
    type: 'data_research',
    theme: THEMES[0],
    enterpriseName: null,
    capacity: 8,
    realProblem: '现有方案成本高',
    targetCustomer: null,
    minimumDeliverable: null,
    resourceCommitment: '3 个站点数据',
    resultEvidenceRules: null,
    status: 'draft',
    version: 1,
    selectedCount: 0,
    fivePieceComplete: false,
    missingFields: ['目标客户', '最小交付物', '结果证据规则'],
    resources: [],
    createdBy: 'u_organizer',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  }
}

function renderForm(options: {
  mode?: 'create' | 'edit'
  initial?: ChallengeDto | null
  themes?: string[]
  onCancel?: () => void
  onSaved?: () => void
} = {}) {
  const onCancel = options.onCancel ?? vi.fn()
  const onSaved = options.onSaved ?? vi.fn()
  render(
    <ChallengeDraftForm
      seasonId={7}
      seasonName="2027 春季赛季"
      themes={options.themes ?? THEMES}
      mode={options.mode ?? 'create'}
      initial={options.initial ?? null}
      onCancel={onCancel}
      onSaved={onSaved}
    />,
  )
  return { onCancel, onSaved }
}

const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createChallenge).mockResolvedValue({ data: challenge(), error: null })
  vi.mocked(updateChallenge).mockResolvedValue({ data: challenge(), error: null })
})

describe('ChallengeDraftForm · fields', () => {
  it('shows the season name read-only and cannot be edited', () => {
    renderForm()
    const season = field('赛季名称')
    expect(season).toHaveValue('2027 春季赛季')
    expect(season).toHaveAttribute('readonly')
    expect(season).toHaveAttribute('aria-readonly', 'true')
  })

  it('renders the fields in the contract order', () => {
    renderForm()
    // 按 DOM 顺序取表单里所有具名控件（`capacity` 是 number，role 不是 textbox）。
    const names = [...document.querySelectorAll('form [name]')].map((node) =>
      node.getAttribute('name'),
    )
    expect(names).toEqual([
      'seasonName',
      'title',
      'type',
      'capacity',
      'theme',
      'realProblem',
      'resourceCommitment',
    ])
  })

  it('offers the four challenge types plus 未分类', () => {
    renderForm()
    const select = screen.getByLabelText('类型') as HTMLSelectElement
    expect([...select.options].map((option) => option.value)).toEqual([
      '',
      'commercial_validation',
      'upstream_downstream',
      'solution_poc',
      'data_research',
    ])
    expect([...select.options].map((option) => option.textContent)).toEqual([
      '未分类',
      '商单验证型',
      '上下游合作型',
      '解决方案 / POC 型',
      '数据 / 研究验证型',
    ])
  })

  it('shows the CHALLENGE_TYPE_HINTS copy for the chosen type', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.selectOptions(screen.getByLabelText('类型'), 'commercial_validation')
    expect(
      screen.getByText('验证目标：找到客户并形成付费；典型结果：订单、交付、回款、复购'),
    ).toBeInTheDocument()
  })

  it('fills the theme select from the season themes', () => {
    renderForm()
    const select = screen.getByLabelText('赛季主题') as HTMLSelectElement
    expect([...select.options].map((option) => option.value)).toEqual(['', ...THEMES])
    expect([...select.options].map((option) => option.textContent)).toEqual([
      '不指定主题',
      ...THEMES,
    ])
  })

  it('disables the theme select and points at 赛季设置 when the season has no themes', () => {
    renderForm({ themes: [] })
    const select = screen.getByLabelText('赛季主题') as HTMLSelectElement
    expect(select).toBeDisabled()
    expect([...select.options].map((option) => option.textContent)).toEqual(['本赛季还没有主题'])
    expect(screen.getByText('先到「赛季设置」里添加赛季主题')).toBeInTheDocument()
  })
})

describe('ChallengeDraftForm · validation', () => {
  it('blocks submission when the title is empty', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    await user.click(screen.getByRole('button', { name: '创建草稿' }))

    expect(createChallenge).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByText('请填写命题标题')).toBeInTheDocument()
    expect(screen.getByText('请先补全表单中标红的字段')).toBeInTheDocument()
  })

  it('rejects a one-character title', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText(/命题标题/), '储')
    await user.click(screen.getByRole('button', { name: '创建草稿' }))
    expect(createChallenge).not.toHaveBeenCalled()
    expect(screen.getByText('命题标题至少 2 个字符')).toBeInTheDocument()
  })

  it('rejects an out-of-range capacity before calling the API', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText(/命题标题/), '储能命题')
    await user.type(screen.getByLabelText(/命题容量/), '1000')
    await user.click(screen.getByRole('button', { name: '创建草稿' }))

    expect(createChallenge).not.toHaveBeenCalled()
    expect(screen.getByText('命题容量必须在 1–999 之间')).toBeInTheDocument()
  })

  it('surfaces the backend field error on the matching control', async () => {
    vi.mocked(createChallenge).mockResolvedValue({
      data: null,
      error: {
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: '赛季主题不存在', field: 'theme' } },
      },
    })
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    await user.type(screen.getByLabelText(/命题标题/), '储能命题')
    await user.click(screen.getByRole('button', { name: '创建草稿' }))

    expect(await screen.findByText('赛季主题不存在')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('ChallengeDraftForm · submission', () => {
  it('posts the trimmed payload for a new draft and refreshes', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    await user.type(screen.getByLabelText(/命题标题/), '  储能站点数据预测  ')
    await user.selectOptions(screen.getByLabelText('类型'), 'data_research')
    await user.selectOptions(screen.getByLabelText('赛季主题'), THEMES[1])
    await user.type(screen.getByLabelText(/命题容量/), '12')
    await user.type(screen.getByLabelText(/真实问题/), '现有方案成本高')
    await user.type(screen.getByLabelText(/资源需求/), '3 个站点历史数据')
    await user.click(screen.getByRole('button', { name: '创建草稿' }))

    await waitFor(() => expect(createChallenge).toHaveBeenCalledTimes(1))
    expect(createChallenge).toHaveBeenCalledWith(7, {
      title: '储能站点数据预测',
      type: 'data_research',
      theme: THEMES[1],
      capacity: 12,
      realProblem: '现有方案成本高',
      resourceCommitment: '3 个站点历史数据',
    })
    expect(updateChallenge).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('sends nulls for the optional fields left blank', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/命题标题/), '储能命题')
    await user.click(screen.getByRole('button', { name: '创建草稿' }))

    await waitFor(() => expect(createChallenge).toHaveBeenCalled())
    expect(createChallenge).toHaveBeenCalledWith(7, {
      title: '储能命题',
      type: null,
      theme: null,
      capacity: null,
      realProblem: null,
      resourceCommitment: null,
    })
  })

  it('prefills from the row in edit mode and PATCHes the same challenge', async () => {
    const user = userEvent.setup()
    renderForm({ mode: 'edit', initial: challenge() })

    expect(field(/命题标题/)).toHaveValue('储能站点数据预测')
    expect(field(/命题容量/)).toHaveValue(8)
    expect(screen.getByLabelText('赛季主题')).toHaveValue(THEMES[0])

    await user.clear(field(/命题标题/))
    await user.type(field(/命题标题/), '储能站点数据预测（二版）')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => expect(updateChallenge).toHaveBeenCalledTimes(1))
    expect(updateChallenge).toHaveBeenCalledWith(42, expect.objectContaining({
      title: '储能站点数据预测（二版）',
      type: 'data_research',
      theme: THEMES[0],
      capacity: 8,
      realProblem: '现有方案成本高',
      resourceCommitment: '3 个站点数据',
    }))
    expect(createChallenge).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('keeps the dialog open and shows the backend message on failure', async () => {
    vi.mocked(createChallenge).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        body: { error: { code: 'CHALLENGE_FROZEN', message: '命题已冻结，不能新增命题' } },
      },
    })
    const user = userEvent.setup()
    const { onSaved } = renderForm()

    await user.type(screen.getByLabelText(/命题标题/), '储能命题')
    await user.click(screen.getByRole('button', { name: '创建草稿' }))

    expect(await screen.findByText('命题已冻结，不能新增命题')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('closes through the cancel button', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderForm()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalled()
    expect(createChallenge).not.toHaveBeenCalled()
  })
})
