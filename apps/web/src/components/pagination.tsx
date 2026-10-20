import Link from 'next/link'
import type { SearchParams } from '@/lib/project-filters'
import { buttonClass } from '@/components/ui/button'
import { chipClass } from '@/components/ui/chip'

interface PaginationProps {
  page: number
  totalPages: number
  searchParams: SearchParams
  basePath?: string
}

function getPageWindow(page: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const pages = new Set<number>([
    1,
    2,
    totalPages - 1,
    totalPages,
    page - 1,
    page,
    page + 1,
  ])
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)

  const result: (number | string)[] = []
  let previous = 0
  for (const value of sorted) {
    if (previous && value - previous > 1) result.push(`ellipsis-${value}`)
    result.push(value)
    previous = value
  }
  return result
}

/** 上一页 / 下一步这类边缘导航：幽灵按钮。 */
const EDGE = buttonClass({ variant: 'ghost', size: 'sm', className: 'font-mono' })
/** 不可点时的同一枚外观。`.ui-btn[aria-disabled]` 负责淡出，这里只挡掉悬浮态。 */
const EDGE_DISABLED = `${EDGE} pointer-events-none`

export function Pagination({ page, totalPages, searchParams, basePath = '/' }: PaginationProps) {
  if (totalPages <= 1) return null

  const hrefFor = (target: number): string => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue
      const resolved = Array.isArray(value) ? value[0] : value
      if (resolved) params.set(key, resolved)
    }
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    const path = basePath.replace(/\/$/, '') || '/'
    return qs ? `${path}?${qs}` : path
  }

  return (
    <nav aria-label="分页" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={EDGE}>
          ← PREV
        </Link>
      ) : (
        <span aria-disabled="true" className={EDGE_DISABLED}>
          ← PREV
        </span>
      )}

      {getPageWindow(page, totalPages).map((item) =>
        typeof item === 'number' ? (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? 'page' : undefined}
            className={chipClass({
              tone: item === page ? 'accent' : 'neutral',
              interactive: true,
              className: 'h-9 min-w-9 justify-center font-mono',
            })}
          >
            {String(item).padStart(2, '0')}
          </Link>
        ) : (
          <span
            key={item}
            className="px-1 font-mono text-label text-muted-foreground"
          >
            …
          </span>
        )
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={EDGE}>
          NEXT →
        </Link>
      ) : (
        <span aria-disabled="true" className={EDGE_DISABLED}>
          NEXT →
        </span>
      )}
    </nav>
  )
}
