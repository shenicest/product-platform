'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/pagination'
import type { AuditRecord } from '@/server/operator'
import {
  OPERATOR_PAGE_SIZE,
  AUDIT_ACTION_LABELS,
  type AuditRecordListParams,
} from '@/lib/operator-filters'
import { projectIdLabel } from '@/lib/utils'

function ActionBadge({ action }: { action: string }) {
  const label = AUDIT_ACTION_LABELS[action] ?? action
  const isNegative = action === 'reject' || action === 'delist' || action === 'reject_proposal'
  const isPositive = action === 'approve' || action === 'restore' || action === 'approve_proposal'

  return (
    <span
      className={`inline-flex items-center px-2 py-1 font-mono text-[10px] tracking-[0.08em] ${
        isNegative
          ? 'bg-rose-500/10 text-rose-600'
          : isPositive
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-amber-500/10 text-amber-600'
      }`}
    >
      {label}
    </span>
  )
}

export function OperatorAuditRecordsClient({
  initialRecords,
  total,
  params,
}: {
  initialRecords: AuditRecord[]
  total: number
  params: AuditRecordListParams
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const page = params.page
  const totalPages = Math.max(1, Math.ceil(total / OPERATOR_PAGE_SIZE))

  function navigate(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    mutate(next)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="eyebrow">AUDIT LOG</p>
        <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
          审计记录
        </h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          共 {total} 条操作记录
        </p>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          navigate((params) => {
            const projectId = formData.get('projectId')
            if (projectId && typeof projectId === 'string' && projectId.trim()) {
              const n = Number(projectId.trim())
              if (Number.isInteger(n) && n > 0) params.set('projectId', String(n))
              else params.delete('projectId')
            } else {
              params.delete('projectId')
            }

            const from = formData.get('from')
            if (from && typeof from === 'string' && from.trim()) {
              params.set('from', from.trim())
            } else {
              params.delete('from')
            }

            const to = formData.get('to')
            if (to && typeof to === 'string' && to.trim()) {
              params.set('to', to.trim())
            } else {
              params.delete('to')
            }
          })
        }}
      >
        <input
          name="projectId"
          defaultValue={params.projectId ?? ''}
          placeholder="项目 ID"
          className="h-11 w-28 border border-input bg-card px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="flex items-center gap-2">
          <label className="font-mono text-[10px] text-muted-foreground">FROM</label>
          <input
            name="from"
            type="date"
            defaultValue={params.from ?? ''}
            className="h-11 border border-input bg-card px-3.5 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-mono text-[10px] text-muted-foreground">TO</label>
          <input
            name="to"
            type="date"
            defaultValue={params.to ?? ''}
            className="h-11 border border-input bg-card px-3.5 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <button type="submit" className="btn-hard btn-primary px-6 py-3">
          筛选
        </button>
      </form>

      {initialRecords.length === 0 ? (
        <div className="border border-dashed border-border py-24 text-center">
          <p className="font-mono text-xs tracking-[0.12em] text-primary">
            NO RECORDS
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            暂无审计记录
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {initialRecords.map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-2 border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <ActionBadge action={record.action} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary">
                      {projectIdLabel(record.projectId)}
                    </span>
                    {record.proposalId ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        提案 #{record.proposalId}
                      </span>
                    ) : null}
                  </div>
                  {record.reason ? (
                    <p className="text-sm text-muted-foreground">{record.reason}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    操作人 #{record.operatorId}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(record.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            searchParams={Object.fromEntries(searchParams.entries())}
            basePath="/operator/audit-records"
          />
        </>
      )}
    </div>
  )
}
