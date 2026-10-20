import { STAGE_LABELS } from '@/lib/project-filters'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/ui/chip'

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
      {stageLabel ? <Chip tone="accent">{stageLabel}</Chip> : null}
      {categories?.map((category) => (
        <Chip key={category}>{category}</Chip>
      ))}
    </div>
  )
}
