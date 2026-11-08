'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ALL_SEASONS_VALUE, type SeasonPickerOption } from '@/lib/organizer'
import { DEFAULT_ORGANIZER_TAB, ORGANIZER_TABS } from '@/components/organizer/organizer-tabs'

/**
 * 赛季选择器。
 *
 * 选中赛季写进 URL（`?season=<id>`），由服务端按这个 id 取数 —— 选择器本身
 * 不持有数据，刷新/分享都会回到同一个赛季。
 *
 * 没有任何赛季时禁用：下拉框里只有一个“暂无赛季”，旁边的“发起赛季草稿”
 * 是此时唯一的出口。
 */
export function SeasonPicker({
  options,
  seasonId,
  tab,
  onSeasonChange,
}: {
  options: SeasonPickerOption[]
  seasonId: number | null
  /** 当前 tab 的 slug：切换赛季后要回到同一个 tab。 */
  tab: string
  /** 可选：外部还想知道选中了谁（比如草稿弹窗要跟着换源赛季）。 */
  onSeasonChange?: (seasonId: number | null) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const disabled = options.length === 0
  const value = seasonId === null ? ALL_SEASONS_VALUE : String(seasonId)

  // 受控值：路由跳转要等服务端 RSC 往返，期间如果直接回落到旧的 prop，
  // 下拉框会闪回上一个赛季。这里记住“自己刚选过什么”，并用导航状态作为
  // 过期条件 —— 一旦 `useTransition` 结束（或换了赛季），state 自动作废，
  // 不需要在 effect 里 setState。
  const [selection, setSelection] = useState<{ for: string; value: string } | null>(null)
  const selected = pending && selection?.for === value ? selection.value : value

  function onChange(next: string) {
    setSelection({ for: value, value: next })
    const nextSeasonId = next === ALL_SEASONS_VALUE ? null : Number(next)
    onSeasonChange?.(nextSeasonId)
    const slug = ORGANIZER_TABS.some((item) => item.slug === tab) ? tab : DEFAULT_ORGANIZER_TAB.slug
    const base = `/organizer/${slug}`
    const href = nextSeasonId === null ? base : `${base}?season=${nextSeasonId}`
    startTransition(() => router.push(href))
  }

  return (
    <div className="ui-field min-w-0">
      <label htmlFor="organizer-season-picker" className="ui-label">
        赛季
      </label>
      <select
        id="organizer-season-picker"
        name="season"
        className="ui-select"
        disabled={disabled || pending}
        value={disabled ? '' : selected}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={disabled ? 'organizer-season-picker-hint' : undefined}
      >
        {disabled ? (
          <option value="">暂无赛季</option>
        ) : (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        )}
      </select>
      {disabled ? (
        <p id="organizer-season-picker-hint" className="ui-hint">
          数据库中还没有赛季，先发起一个赛季草稿。
        </p>
      ) : null}
    </div>
  )
}
