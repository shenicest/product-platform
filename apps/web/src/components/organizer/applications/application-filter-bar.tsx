'use client'

import { useRouter } from 'next/navigation'
import { useId, useTransition } from 'react'
import {
  ALL_REVIEW_STATUS_FILTER,
  REVIEW_STATUS_FILTER_OPTIONS,
  applicationReviewHref,
  type ApplicationReviewParams,
} from '@/lib/organizer-applications'

/**
 * 报名审核的筛选栏。
 *
 * 只有「显示」一个下拉：审核队列真正需要切换的维度就是状态（待处理 / 全部 /
 * 待定 / 候补 / 已通过 / 未通过 / 已撤回），关键词搜索交给详情抽屉里的扫读 ——
 * 报名表本身字段不多，多一个搜索框反而让表头挤。
 *
 * 状态写进 URL（`?status=`），服务端按它取数：刷新、分享、后退都落在同一屏。
 * 默认值（待处理）不写进 URL，保持地址干净。
 */
export function ApplicationFilterBar({
  seasonId,
  params,
}: {
  seasonId: number
  params: ApplicationReviewParams
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const selectId = useId()

  function onChange(next: string) {
    // 切换筛选时丢掉页码：第 3 页在「待处理」下有意义，在「全部」下可能不存在。
    const href = applicationReviewHref({ statusFilter: next, seasonId })
    startTransition(() => router.replace(href, { scroll: false }))
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={selectId} className="ui-label mb-0">
        显示
      </label>
      <select
        id={selectId}
        name="status"
        className="ui-select w-auto min-w-32"
        value={params.statusFilter}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
      >
        {REVIEW_STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {params.statusFilter !== ALL_REVIEW_STATUS_FILTER ? (
        <button
          type="button"
          className="ui-btn ui-btn--text ui-btn--small"
          onClick={() => onChange(ALL_REVIEW_STATUS_FILTER)}
          disabled={pending}
        >
          查看全部报名
        </button>
      ) : null}
    </div>
  )
}
