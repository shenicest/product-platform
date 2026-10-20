import { cn } from '@/lib/utils'

/**
 * 卡片外壳。默认带悬浮抬升；需要静态时传 `static`。
 */
export function Card({
  className,
  static: isStatic = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { static?: boolean }) {
  return (
    <div
      className={cn('ui-card', isStatic && 'ui-card--static', className)}
      {...rest}
    />
  )
}

export function Panel({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-panel', className)} {...rest} />
}

export function PanelLabel({ children }: { children: React.ReactNode }) {
  return <span className="ui-panel__label">{children}</span>
}

/** 空状态：虚线框 + 说明文案。 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('ui-empty', className)}>
      <p className="mono text-brand-text">{title}</p>
      {description ? (
        <p className="mt-3 text-body-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}
