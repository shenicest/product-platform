'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'

interface Stats {
  totalProjects: number
  byStatus: Record<string, number>
  byStage: Record<string, number>
  byCategory: Record<string, number>
}

/** 状态 → 语义色。只用 token 派生的工具类，不引入任何裸色值。 */
const STATUS_STAT_KEYS: { key: string; label: string; tone: string }[] = [
  { key: 'Draft', label: '草稿', tone: 'text-muted-foreground' },
  { key: 'PendingReview', label: '待审核', tone: 'text-warning-text' },
  { key: 'RevisionRequired', label: '需修改', tone: 'text-warning-text' },
  { key: 'Live', label: '已上线', tone: 'text-success-text' },
  { key: 'Delisted', label: '已下架', tone: 'text-danger-text' },
  { key: 'Rejected', label: '已驳回', tone: 'text-subtle-foreground' },
]

export function OperatorDashboard({ stats }: { stats: Stats }) {
  const pendingReview = stats.byStatus['PendingReview'] ?? 0

  const quickActions = [
    {
      href: '/operator/projects?status=1',
      eyebrow: 'REVIEW QUEUE',
      title: '待审核项目',
      hint: `${pendingReview} 个项目等待审核`,
    },
    {
      href: '/operator/proposals',
      eyebrow: 'PROPOSALS',
      title: '提案审核',
      hint: '查看待审核的编辑提案',
    },
    {
      href: '/operator/audit-records',
      eyebrow: 'AUDIT LOG',
      title: '审计记录',
      hint: '查看操作历史日志',
    },
  ]

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-6">
          <Eyebrow>OVERVIEW</Eyebrow>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
            平台总览
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ui-metric">
            <span className="ui-metric__label">TOTAL</span>
            <span className="ui-metric__value">{stats.totalProjects}</span>
            <p className="ui-metric__hint">全部项目</p>
          </div>
          <div className="ui-metric">
            <span className="ui-metric__label">LIVE</span>
            <span className="ui-metric__value text-success-text">
              {stats.byStatus['Live'] ?? 0}
            </span>
            <p className="ui-metric__hint">已上线</p>
          </div>
          <div className="ui-metric">
            <span className="ui-metric__label">PENDING REVIEW</span>
            <span className="ui-metric__value text-warning-text">{pendingReview}</span>
            <p className="ui-metric__hint">等待审核</p>
          </div>
          <div className="ui-metric">
            <span className="ui-metric__label">REJECTED</span>
            <span className="ui-metric__value text-danger-text">
              {stats.byStatus['Rejected'] ?? 0}
            </span>
            <p className="ui-metric__hint">已驳回</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="ui-panel">
          <span className="ui-panel__label">BY STATUS</span>
          <div className="flex flex-col gap-3">
            {STATUS_STAT_KEYS.map((item) => {
              const count = stats.byStatus[item.key] ?? 0
              const pct = stats.totalProjects > 0 ? (count / stats.totalProjects) * 100 : 0
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="mono w-20 shrink-0">{item.label}</span>
                  <div className="ui-progress flex-1">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`font-digits text-lg leading-none ${item.tone}`}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ui-panel">
          <span className="ui-panel__label">BY STAGE</span>
          <div className="flex flex-col gap-2">
            {[
              { key: 'MVP', label: 'MVP 阶段' },
              { key: 'Growth', label: '成长阶段' },
            ].map((item) => {
              const count = stats.byStage[item.key] ?? 0
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-soft px-3 py-2"
                >
                  <span className="mono">{item.label}</span>
                  <span className="font-digits text-2xl leading-none text-brand-text">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>

          <h3 className="ui-panel__label mt-8">BY CATEGORY</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(stats.byCategory).length === 0 ? (
              <p className="mono">暂无数据</p>
            ) : (
              Object.entries(stats.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between gap-3 rounded-md border border-border-soft px-3 py-2"
                  >
                    <span className="text-body-sm">{category}</span>
                    <span className="font-digits text-lg leading-none text-brand-text">
                      {count}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6">
          <Eyebrow>QUICK ACTIONS</Eyebrow>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
            快捷入口
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Card key={action.href} className="group">
              <Link
                href={action.href}
                className="flex flex-1 flex-col gap-1.5 p-5 outline-none"
              >
                <Eyebrow tone="accent">{action.eyebrow}</Eyebrow>
                <span className="text-body-lg font-bold transition-colors group-hover:text-brand-text">
                  {action.title}
                </span>
                <span className="mono">{action.hint}</span>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
