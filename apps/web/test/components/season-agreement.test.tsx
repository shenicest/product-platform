import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonStatus, SeasonType } from '@shenicest/shared'
import { SeasonAgreementPage } from '@/components/boomland/season-agreement'
import type { SeasonDetail } from '@/lib/boomland'

/**
 * 公开协议页是纯展示 Server Component：正文按空行分段、规则卡紧跟在后面。
 * 这里只断言用户能看到什么（分段后的段落、规则卡标题与条目、空正文提示）。
 */
function detail(overrides: Partial<SeasonDetail> = {}): SeasonDetail {
  return {
    id: 502,
    code: '502',
    name: 'A4BBS 产业商业赛季',
    type: SeasonType.Season,
    city: '上海',
    status: SeasonStatus.Active,
    themes: ['AI 应用'],
    schedule: null,
    organizerOrgs: [{ id: 1, name: 'A4BBS' }],
    pinned: false,
    approvedAt: '2026-09-01T00:00:00.000Z',
    participantCapacity: 20,
    participantCount: 19,
    publishedChallengeCount: 3,
    intro: '把真实问题做成可交付的服务',
    ruleCard: [
      {
        id: 1,
        key: 'max_project_challenges',
        label: '项目命题',
        value: '每个项目最多 2 个命题',
        required: true,
        visible: true,
        sortOrder: 0,
      },
      {
        id: 2,
        key: 'custom_note',
        label: '自定义说明',
        value: '请勿在作品中使用未授权素材',
        required: false,
        visible: true,
        sortOrder: 1,
      },
    ],
    rulesVersion: 3,
    awardingEntity: 'A4BBS',
    agreementVersion: 'v2',
    agreementContent: '第一条 参赛资格\n\n第二条 作品要求',
    startedAt: null,
    applicationWindow: { opensAt: null, closesAt: null, isOpen: false },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('SeasonAgreementPage', () => {
  it('renders the agreement paragraphs and the rule card', () => {
    render(<SeasonAgreementPage season={detail()} />)

    expect(screen.getByRole('heading', { name: '本赛季协议与规则卡' })).toBeInTheDocument()
    expect(screen.getByText('第一条 参赛资格')).toBeInTheDocument()
    expect(screen.getByText('第二条 作品要求')).toBeInTheDocument()
    expect(screen.getByText('项目命题')).toBeInTheDocument()
    expect(screen.getByText('每个项目最多 2 个命题')).toBeInTheDocument()
    expect(screen.getByText('请勿在作品中使用未授权素材')).toBeInTheDocument()
    // 版本信息同时出现在头部与页脚，必须来自赛季字段而不是硬编码。
    expect(screen.getAllByText(/v2/).length).toBeGreaterThan(0)
  })

  it('explains the missing agreement instead of inventing text', () => {
    render(<SeasonAgreementPage season={detail({ agreementContent: null })} />)
    expect(screen.getByText(/主办方还没有填写协议正文/)).toBeInTheDocument()
    // 正文缺失不影响规则卡展示。
    expect(screen.getByText('项目命题')).toBeInTheDocument()
  })

  it('hides the apply CTA for a cancelled season', () => {
    render(
      <SeasonAgreementPage
        season={detail({ status: SeasonStatus.Cancelled, approvedAt: '2026-09-01T00:00:00.000Z' })}
      />,
    )
    expect(screen.queryByRole('link', { name: /去报名/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回赛季详情' })).toBeInTheDocument()
  })

  it('links back to the season detail and to the application form', () => {
    render(<SeasonAgreementPage season={detail()} />)
    expect(screen.getByRole('link', { name: /← A4BBS 产业商业赛季/ })).toHaveAttribute(
      'href',
      '/seasons/502',
    )
    expect(screen.getByRole('link', { name: /去报名/ })).toHaveAttribute(
      'href',
      '/seasons/502/apply',
    )
  })
})
