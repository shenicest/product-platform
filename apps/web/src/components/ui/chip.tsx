import { cn } from '@/lib/utils'

export type ChipTone =
  | 'neutral'
  | 'accent'
  | 'sky'
  | 'seeking'
  | 'success'
  | 'warning'
  | 'danger'

const TONE: Record<ChipTone, string> = {
  neutral: '',
  accent: 'ui-chip--active',
  sky: 'ui-chip--blue',
  // 虚线 + 更浅的底：表示「我还在找的」而不是「我已经有的」。
  seeking: 'ui-chip--seeking',
  success: 'ui-chip--success',
  warning: 'ui-chip--warning',
  danger: 'ui-chip--danger',
}

export function chipClass({
  tone = 'neutral',
  dot = false,
  interactive = false,
  className,
}: {
  tone?: ChipTone
  dot?: boolean
  interactive?: boolean
  className?: string
} = {}): string {
  return cn(
    'ui-chip',
    TONE[tone],
    dot && 'ui-chip--dot',
    interactive && 'ui-chip--interactive',
    className,
  )
}

export function Chip({
  tone,
  dot,
  interactive,
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone
  dot?: boolean
  interactive?: boolean
}) {
  return (
    <span className={chipClass({ tone, dot, interactive, className })} {...rest} />
  )
}

export function ChipButton({
  tone,
  dot,
  className,
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ChipTone
  dot?: boolean
}) {
  return (
    <button
      type={type}
      className={chipClass({ tone, dot, interactive: true, className })}
      {...rest}
    />
  )
}
