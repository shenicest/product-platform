import { Chip } from '@/components/ui/chip'
import { seasonStatusMeta } from '@/lib/boomland'

export function SeasonStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const meta = seasonStatusMeta(status)
  return (
    <Chip tone={meta.tone} dot className={className}>
      {meta.label}
    </Chip>
  )
}
