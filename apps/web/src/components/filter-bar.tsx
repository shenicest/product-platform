'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CATEGORIES, ProjectStage } from '@shenicest/shared'
import { cn } from '@/lib/utils'
import { SORTS, SORT_LABELS, STAGE_LABELS } from '@/lib/project-filters'

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'chip-hard cursor-pointer transition-colors',
        active
          ? 'chip-active'
          : 'hover:border-primary/60 hover:text-foreground'
      )}
    >
      {active ? <i aria-hidden /> : null}
      {children}
    </button>
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
        className="flex flex-col gap-3 sm:flex-row"
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
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索项目名称、团队或负责人"
          className="h-11 flex-1 border border-input bg-card px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="flex gap-3">
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
            className="h-11 cursor-pointer border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
          >
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-hard btn-primary px-6 py-3">
            搜索
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((item) => (
          <Chip
            key={item}
            active={category === item}
            onClick={() => toggleParam('category', item, category)}
          >
            {item}
          </Chip>
        ))}
        <span className="mx-2 h-4 w-px bg-border" aria-hidden />
        {[ProjectStage.MVP, ProjectStage.Growth].map((value) => (
          <Chip
            key={value}
            active={stage === String(value)}
            onClick={() => toggleParam('stage', String(value), stage)}
          >
            {STAGE_LABELS[value]}
          </Chip>
        ))}
      </div>
    </div>
  )
}
