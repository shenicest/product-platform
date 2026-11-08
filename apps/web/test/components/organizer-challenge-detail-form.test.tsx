import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChallengeDetailForm } from '@/components/organizer/challenges/challenge-detail-form'
import type { ChallengeDto } from '@/lib/organizer-challenges'
import { server } from '../msw/server'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn(), back: vi.fn(), preload: vi.fn() }),
  usePathname: () => '/organizer/challenges',
  useSearchParams: () => new URLSearchParams(),
}))

/**
 * 命题详情表单的组件测试。
 *
 * 与 `challenge-draft-form.test.tsx` 的区别：那里 `vi.mock` 掉 API 模块，
 * 这里**打桩真实 HTTP**（MSW `PATCH /api/challenges/:id`），所以「请求体到底
 * 长什么样」是被 `client-api` 真正序列化过的，而不是 mock 函数的入参。
 */

const DEFAULT_WEIGHTS = {
  commercial_result: 35,
  delivery_quality: 25,
  original_method: 15,
  action_evidence: 15,
  reuse_value: 10,
}

function challenge(overrides: Partial<ChallengeDto> = {}): ChallengeDto {
  return {
    id: 42,
    seasonId: 7,
    title: '储能站点数据预测',
    type: 'data_research',
    theme: '新型储能基建',
    enterpriseName: null,
    capacity: 8,
    realProblem: '现有方案成本高',
    targetCustomer: null,
    minimumDeliverable: null,
    resourceCommitment: '3 个站点数据',
    resultEvidenceRules: null,
    status: 'published',
    version: 2,
    selectedCount: 0,
    fivePieceComplete: false,
    missingFields: ['目标客户', '最小交付物', '结果证据规则'],
    resources: [],
    createdBy: 'u_organizer',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    // 详情字段（后端可能还没上线，所以类型上全部可选）。
    summary: '谁会为一台储能柜付第一笔钱？',
    background: '背景',
    industry: '储能集成商',
    scope: '范围',
    outOfScope: '不做什么',
    monthlyGoal: '一个月成果',
    suggestedSkills: ['储能系统', '数据分析'],
    teamCapacity: 6,
    ownerName: '王工',
    responseSla: '工作日 48 小时内',
    scoringWeights: { ...DEFAULT_WEIGHTS },
    singleWorkCap: 300,
    rightsPublicScope: '公开范围',
    rightsConfidentiality: '保密',
    rightsIp: '知识产权',
    rightsEnterpriseUsage: '企业使用权',
    rightsProcurement: '采购',
    rightsSpecialTerms: '特殊条件',
    rightsExclusivity: '排他',
    versions: [],
    projects: [],
    ...overrides,
  }
}

function renderForm(options: {
  initial?: ChallengeDto
  onCancel?: () => void
  onSaved?: () => void
} = {}) {
  const onCancel = options.onCancel ?? vi.fn()
  const onSaved = options.onSaved ?? vi.fn()
  render(
    <ChallengeDetailForm
      challenge={options.initial ?? challenge()}
      onCancel={onCancel}
      onSaved={onSaved}
    />,
  )
  return { onCancel, onSaved }
}

const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ChallengeDetailForm · fields', () => {
  it('renders the three contract sections', () => {
    renderForm()
    expect(screen.getByText('01 命题卡内容')).toBeInTheDocument()
    expect(screen.getByText('02 评分与奖励')).toBeInTheDocument()
    expect(screen.getByText('03 公开与权益')).toBeInTheDocument()
  })

  it('prefills the card content from the row', () => {
    renderForm()
    expect(field(/简介/)).toHaveValue('谁会为一台储能柜付第一笔钱？')
    expect(field(/背景/)).toHaveValue('背景')
    expect(field(/目标客户/)).toHaveValue('储能集成商')
    expect(field('范围')).toHaveValue('范围')
    expect(field(/不做什么/)).toHaveValue('不做什么')
    expect(field(/一个月最小成果/)).toHaveValue('一个月成果')
    expect(field(/建议技能/)).toHaveValue('储能系统、数据分析')
    expect(field(/团队容量/)).toHaveValue(6)
    expect(field(/负责人/)).toHaveValue('王工')
    expect(field(/响应时限/)).toHaveValue('工作日 48 小时内')
  })

  it('renders the five weight inputs and the seven rights fields', () => {
    renderForm()
    const names = [...document.querySelectorAll('form [name]')].map((node) =>
      node.getAttribute('name'),
    )
    for (const name of [
      'weight-commercial_result',
      'weight-delivery_quality',
      'weight-original_method',
      'weight-action_evidence',
      'weight-reuse_value',
      'rightsPublicScope',
      'rightsConfidentiality',
      'rightsIp',
      'rightsEnterpriseUsage',
      'rightsProcurement',
      'rightsSpecialTerms',
      'rightsExclusivity',
      'changeNote',
    ]) {
      expect(names).toContain(name)
    }
    expect(field(/单次评分上限/)).toHaveValue(300)
    expect(field('公开范围')).toHaveValue('公开范围')
    expect(field('独家或排他')).toHaveValue('排他')
  })

  it('shows the live total when the weights add up to 100', () => {
    renderForm()
    expect(screen.getByRole('status')).toHaveTextContent('五维权重合计 100 / 100')
    expect(screen.getByRole('button', { name: '保存详情' })).toBeEnabled()
  })

  it('treats a challenge without detail fields as an empty form', () => {
    renderForm({
      initial: challenge({
        summary: undefined,
        background: undefined,
        suggestedSkills: undefined,
        teamCapacity: undefined,
        scoringWeights: undefined,
        singleWorkCap: undefined,
        rightsIp: undefined,
      }),
    })
    expect(field(/简介/)).toHaveValue('')
    expect(field(/建议技能/)).toHaveValue('')
    expect(field(/团队容量/)).toHaveValue(null)
    expect(screen.getByRole('status')).toHaveTextContent('未配置权重（保存后按等权）')
    expect(screen.getByRole('button', { name: '保存详情' })).toBeEnabled()
  })
})

describe('ChallengeDetailForm · weight validation', () => {
  it('warns and disables saving when the total is not 100', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(field(/真实商业结果/))
    await user.type(field(/真实商业结果/), '20')

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('五维权重合计 85 / 100')
    expect(status).toHaveTextContent('还差 15 才到 100')
    expect(screen.getByRole('button', { name: '保存详情' })).toBeDisabled()
    expect(screen.getByText('五维权重合计需为 100 才能保存')).toBeInTheDocument()
  })

  it('re-enables saving once the total is back to 100', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(field(/真实商业结果/))
    await user.type(field(/真实商业结果/), '60')
    expect(screen.getByRole('button', { name: '保存详情' })).toBeDisabled()

    await user.clear(field(/真实商业结果/))
    await user.type(field(/真实商业结果/), '35')
    expect(screen.getByRole('button', { name: '保存详情' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('五维权重合计 100 / 100')
  })

  it('shows a per-dimension error for an out-of-range weight', async () => {
    const user = userEvent.setup()
    let patched: unknown
    server.use(
      http.patch('/api/challenges/42', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json(challenge())
      }),
    )
    renderForm()

    await user.clear(field(/真实商业结果/))
    await user.type(field(/真实商业结果/), '150')
    await user.click(screen.getByRole('button', { name: '保存详情' }))

    expect(screen.getByText('权重必须在 0–100 之间')).toBeInTheDocument()
    expect(patched).toBeUndefined()
  })

  it('blocks saving a total that is over 100', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.clear(field(/真实商业结果/))
    await user.type(field(/真实商业结果/), '100')
    expect(screen.getByRole('status')).toHaveTextContent('五维权重合计 165 / 100')
    expect(screen.getByRole('status')).toHaveTextContent('超出 65')
    expect(screen.getByRole('button', { name: '保存详情' })).toBeDisabled()
  })
})

describe('ChallengeDetailForm · submission', () => {
  it('PATCHes the trimmed detail payload with the change note and refreshes', async () => {
    const user = userEvent.setup()
    let patched: unknown
    server.use(
      http.patch('/api/challenges/42', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json(challenge())
      }),
    )
    const { onSaved } = renderForm()

    await user.clear(field(/简介/))
    await user.type(field(/简介/), '  新简介  ')
    await user.clear(field(/建议技能/))
    await user.type(field(/建议技能/), '储能系统、数据分析、硬件集成')
    await user.type(field(/变更说明/), '补充建议技能')
    await user.click(screen.getByRole('button', { name: '保存详情' }))

    await waitFor(() => expect(patched).toBeDefined())
    expect(patched).toMatchObject({
      summary: '新简介',
      background: '背景',
      industry: '储能集成商',
      suggestedSkills: ['储能系统', '数据分析', '硬件集成'],
      teamCapacity: 6,
      singleWorkCap: 300,
      scoringWeights: { ...DEFAULT_WEIGHTS },
      rightsIp: '知识产权',
      changeNote: '补充建议技能',
    })
    expect(onSaved).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('sends nulls for blank optional fields and omits an empty change note', async () => {
    const user = userEvent.setup()
    let patched: Record<string, unknown> | undefined
    server.use(
      http.patch('/api/challenges/42', async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(challenge())
      }),
    )
    renderForm({
      initial: challenge({
        summary: null,
        background: null,
        industry: null,
        scope: null,
        outOfScope: null,
        monthlyGoal: null,
        suggestedSkills: [],
        teamCapacity: null,
        ownerName: null,
        responseSla: null,
        scoringWeights: null,
        singleWorkCap: null,
        rightsPublicScope: null,
        rightsConfidentiality: null,
        rightsIp: null,
        rightsEnterpriseUsage: null,
        rightsProcurement: null,
        rightsSpecialTerms: null,
        rightsExclusivity: null,
      }),
    })

    await user.click(screen.getByRole('button', { name: '保存详情' }))

    await waitFor(() => expect(patched).toBeDefined())
    expect(patched).toMatchObject({
      summary: null,
      background: null,
      suggestedSkills: [],
      teamCapacity: null,
      scoringWeights: null,
      singleWorkCap: null,
      rightsIp: null,
    })
    expect(patched).not.toHaveProperty('changeNote')
  })

  it('shows the backend message in a role="alert" and keeps the form open', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/challenges/42', () =>
        HttpResponse.json(
          { error: { code: 'CHALLENGE_STATUS_LOCKED', message: '命题已关闭，不能修改' } },
          { status: 409 },
        ),
      ),
    )
    const { onSaved } = renderForm()

    await user.click(screen.getByRole('button', { name: '保存详情' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('命题已关闭，不能修改')
    expect(onSaved).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('marks the matching control when the backend returns a field', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/challenges/42', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: '简介最多 200 个字符',
              field: 'summary',
            },
          },
          { status: 400 },
        ),
      ),
    )
    renderForm()

    await user.click(screen.getByRole('button', { name: '保存详情' }))

    expect(await screen.findByText('简介最多 200 个字符')).toBeInTheDocument()
    // 字段级错误挂在对应控件的 `aria-describedby` 上（与既有表单同一套 FormField 契约）。
    expect(field(/简介/).getAttribute('aria-describedby')).toContain('-summary-error')
  })

  it('surfaces a scoringWeights field error next to the weight inputs', async () => {
    const user = userEvent.setup()
    server.use(
      http.patch('/api/challenges/42', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: '五维权重合计必须等于 100',
              field: 'scoringWeights',
            },
          },
          { status: 400 },
        ),
      ),
    )
    renderForm()

    await user.click(screen.getByRole('button', { name: '保存详情' }))

    expect(await screen.findByText('五维权重合计必须等于 100')).toBeInTheDocument()
  })

  it('closes through the cancel button without calling the API', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderForm()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})
