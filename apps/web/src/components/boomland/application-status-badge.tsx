import { Chip, type ChipTone } from '@/components/ui/chip'
import { applicationStatusMeta } from '@/lib/boomland'

/**
 * 报名状态胶囊。
 *
 * 默认按报名原始状态取文案；`label` / `tone` 可覆盖 —— 报名页的「已退赛」
 * 不是报名状态（报名仍是 `accepted`），而是选手行被置为 `withdrawn` 后
 * 派生出来的展示值，改由 `lib/me-applications.ts` 算好传进来。
 */
export function ApplicationStatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status: string
  label?: string
  tone?: ChipTone
  className?: string
}) {
  const meta = applicationStatusMeta(status)
  return (
    <Chip tone={tone ?? meta.tone} className={className}>
      {label ?? meta.label}
    </Chip>
  )
}
