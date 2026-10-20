import { cn } from '@/lib/utils'

/** 分区小标：英文大写等宽字 + 中文标题的组合。 */
export function Eyebrow({
  children,
  tone = 'muted',
  className,
}: {
  children: React.ReactNode
  tone?: 'muted' | 'accent'
  className?: string
}) {
  return (
    <p className={cn('eyebrow', tone === 'accent' && 'eyebrow--accent', className)}>
      {children}
    </p>
  )
}

/** 等宽元信息文本（编号、计数、状态标签）。 */
export function Mono({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn('mono', className)}>{children}</span>
}

/**
 * 分区标题：左侧 eyebrow + 中文大标题，右侧一段引导文案（设计稿 section-head）。
 */
export function SectionHead({
  eyebrow,
  title,
  lead,
  aside,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lead?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('section-head', className)}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="section-head__title">{title}</h2>
      </div>
      {aside ?? (lead ? <p className="section-head__lead">{lead}</p> : null)}
    </header>
  )
}
