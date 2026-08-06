import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SearchParams } from '@/lib/project-filters'

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

  const edgeLink =
    'flex h-9 items-center border border-border px-3.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary'
  const edgeDisabled =
    'flex h-9 items-center border border-border px-3.5 font-mono text-xs text-muted-foreground/40'

  return (
    <nav aria-label="分页" className="mt-12 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={edgeLink}>
          ← PREV
        </Link>
      ) : (
        <span aria-disabled="true" className={edgeDisabled}>
          ← PREV
        </span>
      )}

      {getPageWindow(page, totalPages).map((item) =>
        typeof item === 'number' ? (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              'flex h-9 w-9 items-center justify-center border font-mono text-xs transition-colors',
              item === page
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
            )}
          >
            {String(item).padStart(2, '0')}
          </Link>
        ) : (
          <span key={item} className="px-1 font-mono text-xs text-muted-foreground">
            …
          </span>
        )
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={edgeLink}>
          NEXT →
        </Link>
      ) : (
        <span aria-disabled="true" className={edgeDisabled}>
          NEXT →
        </span>
      )}
    </nav>
  )
}
