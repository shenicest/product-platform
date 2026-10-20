'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Chip, type ChipTone } from '@/components/ui/chip'
import { Card, EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import type { AuditRecord } from '@/server/operator'
import {
  OPERATOR_PAGE_SIZE,
  AUDIT_ACTION_LABELS,
  type AuditRecordListParams,
} from '@/lib/operator-filters'
import { projectIdLabel } from '@/lib/utils'

/** 审计动作 → 标签色调（只映射语义，不写颜色）。 */
function actionTone(action: string): ChipTone {
  if (action === 'reject' || action === 'delist' || action === 'reject_proposal') return 'danger'
  if (action === 'approve' || action === 'restore' || action === 'approve_proposal') return 'success'
  return 'warning'
}

function ActionBadge({ action }: { action: string }) {
  return (
    <Chip tone={actionTone(action)}>
      {AUDIT_ACTION_LABELS[action] ?? action}
    </Chip>
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
    <div className="flex flex-col gap-6">
      <header>
        <Eyebrow>AUDIT LOG</Eyebrow>
        <h2 className="mt-2 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
          审计记录
        </h2>
        <p className="mono mt-1">共 {total} 条操作记录</p>
      </header>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
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
        <div className="sm:w-32">
          <input
            name="projectId"
            defaultValue={params.projectId ?? ''}
            placeholder="项目 ID"
            aria-label="项目 ID"
            className="ui-input"
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="audit-from">
            FROM
          </label>
          <input
            id="audit-from"
            name="from"
            type="date"
            defaultValue={params.from ?? ''}
            className="ui-input"
          />
        </div>
        <div className="ui-field">
          <label className="ui-label" htmlFor="audit-to">
            TO
          </label>
          <input
            id="audit-to"
            name="to"
            type="date"
            defaultValue={params.to ?? ''}
            className="ui-input"
          />
        </div>
        <Button type="submit">筛选</Button>
      </form>

      {initialRecords.length === 0 ? (
        <EmptyState title="NO RECORDS" description="暂无审计记录" />
      ) : (
        <>
          <Card static>
            <div className="overflow-x-auto">
              <table className="console-table">
                <thead>
                  <tr>
                    <th scope="col">动作</th>
                    <th scope="col">项目</th>
                    <th scope="col">提案</th>
                    <th scope="col">原因</th>
                    <th scope="col">操作人</th>
                    <th scope="col">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {initialRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <ActionBadge action={record.action} />
                      </td>
                      <td>
                        <span className="card-id">{projectIdLabel(record.projectId)}</span>
                      </td>
                      <td>
                        <span className="mono">
                          {record.proposalId ? `#${record.proposalId}` : '—'}
                        </span>
                      </td>
                      <td className="max-w-[42ch]">
                        <span className="mono">{record.reason ? record.reason : '—'}</span>
                      </td>
                      <td>
                        <span className="mono">#{record.operatorId}</span>
                      </td>
                      <td>
                        <span className="mono whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
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
