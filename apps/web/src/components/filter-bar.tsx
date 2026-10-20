'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CATEGORIES, ProjectStage } from '@shenicest/shared'
import { SORTS, SORT_LABELS, STAGE_LABELS } from '@/lib/project-filters'
import { Button } from '@/components/ui/button'
import { ChipButton } from '@/components/ui/chip'

/** 页内筛选按钮：选中态用 accent chip，保留 aria-pressed 供测试与读屏使用。 */
function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <ChipButton
      tone={active ? 'accent' : 'neutral'}
      dot={active}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </ChipButton>
  )
}

export function FilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const category = searchParams.get('category') ?? ''
  const stage = searchParams.get('stage') ?? ''
  const sort = searchParams.get('sort') ?? 'latest'
  const q = searchParams.get('q') ?? ''

  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    mutate(params)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function toggleParam(key: string, value: string, current: string) {
    navigate((params) => {
      if (current === value) params.delete(key)
      else params.set(key, value)
    })
  }

  return (
    <div className="mb-10 flex flex-col gap-5">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault()
          const value = new FormData(event.currentTarget).get('q')
          navigate((params) => {
            const next = typeof value === 'string' ? value.trim() : ''
            if (next) params.set('q', next)
            else params.delete('q')
          })
        }}
      >
        <div className="ui-search flex-1">
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle
              cx="11"
              cy="11"
              r="6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="m16 16 4.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            name="q"
            type="search"
            defaultValue={q}
            aria-label="搜索项目名称、团队或负责人"
            placeholder="搜索项目名称、团队或负责人"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-36 shrink-0">
            <select
              value={sort}
              aria-label="排序方式"
              onChange={(event) => {
                const value = event.target.value
                navigate((params) => {
                  if (value === 'latest') params.delete('sort')
                  else params.set('sort', value)
                })
              }}
              className="ui-select"
            >
              {SORTS.map((value) => (
                <option key={value} value={value}>
                  {SORT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">搜索</Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((item) => (
          <FilterChip
            key={item}
            active={category === item}
            onClick={() => toggleParam('category', item, category)}
          >
            {item}
          </FilterChip>
        ))}
        <span className="mx-2 h-4 w-px bg-border" aria-hidden />
        {(Object.values(ProjectStage) as number[]).map((value) => (
          <FilterChip
            key={value}
            active={stage === String(value)}
            onClick={() => toggleParam('stage', String(value), stage)}
          >
            {STAGE_LABELS[value]}
          </FilterChip>
        ))}
      </div>
    </div>
  )
}
