'use client'

import Link from 'next/link'

interface Stats {
  totalProjects: number
  byStatus: Record<string, number>
  byStage: Record<string, number>
  byCategory: Record<string, number>
}

const STATUS_STAT_KEYS: { key: string; label: string; color: string }[] = [
  { key: 'Draft', label: '草稿', color: 'text-muted-foreground' },
  { key: 'PendingReview', label: '待审核', color: 'text-primary' },
  { key: 'RevisionRequired', label: '需修改', color: 'text-amber-600' },
  { key: 'Live', label: '已上线', color: 'text-emerald-600' },
  { key: 'Delisted', label: '已下架', color: 'text-rose-600' },
  { key: 'Rejected', label: '已驳回', color: 'text-slate-500' },
]

export function OperatorDashboard({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-6">
          <p className="eyebrow">OVERVIEW</p>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
            平台总览
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-border bg-card p-5">
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              TOTAL
            </p>
            <p className="mt-2 font-digits text-[clamp(32px,5vw,48px)] leading-none text-primary">
              {stats.totalProjects}
            </p>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              LIVE
            </p>
            <p className="mt-2 font-digits text-[clamp(32px,5vw,48px)] leading-none text-emerald-600">
              {stats.byStatus['Live'] ?? 0}
            </p>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              PENDING REVIEW
            </p>
            <p className="mt-2 font-digits text-[clamp(32px,5vw,48px)] leading-none text-amber-600">
              {stats.byStatus['PendingReview'] ?? 0}
            </p>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              REJECTED
            </p>
            <p className="mt-2 font-digits text-[clamp(32px,5vw,48px)] leading-none text-slate-500">
              {stats.byStatus['Rejected'] ?? 0}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <h3 className="mb-4 font-mono text-xs tracking-[0.12em] text-primary">
            BY STATUS
          </h3>
          <div className="space-y-3">
            {STATUS_STAT_KEYS.map((item) => {
              const count = stats.byStatus[item.key] ?? 0
              const pct = stats.totalProjects > 0 ? (count / stats.totalProjects) * 100 : 0
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="w-20 font-mono text-xs text-muted-foreground">
                    {item.label}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 w-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`font-digits text-lg leading-none ${item.color}`}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <h3 className="mb-4 font-mono text-xs tracking-[0.12em] text-primary">
            BY STAGE
          </h3>
          <div className="space-y-3">
            {[
              { key: 'MVP', label: 'MVP 阶段' },
              { key: 'Growth', label: '成长阶段' },
            ].map((item) => {
              const count = stats.byStage[item.key] ?? 0
              return (
                <div key={item.key} className="flex items-center justify-between border border-border p-3">
                  <span className="font-mono text-xs text-muted-foreground">{item.label}</span>
                  <span className="font-digits text-2xl leading-none text-primary">{count}</span>
                </div>
              )
            })}
          </div>

          <h3 className="mb-4 mt-8 font-mono text-xs tracking-[0.12em] text-primary">
            BY CATEGORY
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byCategory).length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">暂无数据</p>
            ) : (
              Object.entries(stats.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between border border-border p-3">
                    <span className="text-sm">{category}</span>
                    <span className="font-digits text-lg leading-none text-primary">{count}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6">
          <p className="eyebrow">QUICK ACTIONS</p>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
            快捷入口
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/operator/projects?status=1"
            className="group border border-border bg-card p-5 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)]"
          >
            <p className="font-mono text-[10px] tracking-[0.12em] text-primary">REVIEW QUEUE</p>
            <p className="mt-2 text-lg font-bold">待审核项目</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {stats.byStatus['PendingReview'] ?? 0} 个项目等待审核
            </p>
          </Link>
          <Link
            href="/operator/proposals"
            className="group border border-border bg-card p-5 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)]"
          >
            <p className="font-mono text-[10px] tracking-[0.12em] text-primary">PROPOSALS</p>
            <p className="mt-2 text-lg font-bold">提案审核</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              查看待审核的编辑提案
            </p>
          </Link>
          <Link
            href="/operator/audit-records"
            className="group border border-border bg-card p-5 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)]"
          >
            <p className="font-mono text-[10px] tracking-[0.12em] text-primary">AUDIT LOG</p>
            <p className="mt-2 text-lg font-bold">审计记录</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              查看操作历史日志
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
