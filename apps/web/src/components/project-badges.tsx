import { STAGE_LABELS } from '@/lib/project-filters'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/ui/chip'

export function ProjectBadges({
  stage,
  categories,
  source,
  className,
}: {
  stage: number | null
  categories: string[] | null | undefined
  source?: string | null
  className?: string
}) {
  const stageLabel = stage !== null ? STAGE_LABELS[stage] : undefined
  if (!stageLabel && !categories?.length && !source) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {source ? (
        <Chip tone="sky" dot>
          来源 · {source}
        </Chip>
      ) : null}
      {stageLabel ? <Chip tone="accent">{stageLabel}</Chip> : null}
      {categories?.map((category) => (
        <Chip key={category}>{category}</Chip>
      ))}
    </div>
  )
}
