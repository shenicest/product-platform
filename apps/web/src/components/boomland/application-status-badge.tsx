import { Chip } from '@/components/ui/chip'
import { applicationStatusMeta } from '@/lib/boomland'

export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const meta = applicationStatusMeta(status)
  return (
    <Chip tone={meta.tone} className={className}>
      {meta.label}
    </Chip>
  )
}
