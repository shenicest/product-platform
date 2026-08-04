import { STAGE_LABELS } from '@/lib/project-filters'
import { cn } from '@/lib/utils'

export function ProjectBadges({
  stage,
  categories,
  className,
}: {
  stage: number | null
  categories: string[] | null | undefined
  className?: string
}) {
  const stageLabel = stage !== null ? STAGE_LABELS[stage] : undefined
  if (!stageLabel && !categories?.length) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {stageLabel ? (
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
          {stageLabel}
        </span>
      ) : null}
      {categories?.map((category) => (
        <span
          key={category}
          className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
        >
          {category}
        </span>
      ))}
    </div>
  )
}
