import Link from 'next/link'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'text'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'ui-btn--primary',
  secondary: 'ui-btn--secondary',
  tertiary: 'ui-btn--tertiary',
  ghost: 'ui-btn--ghost',
  text: 'ui-btn--text',
}

export function buttonClass({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
} = {}): string {
  return cn(
    'ui-btn',
    VARIANT[variant],
    size === 'sm' && 'ui-btn--small',
    block && 'ui-btn--block',
    className,
  )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}

export function Button({
  variant,
  size,
  block,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    />
  )
}

type ButtonLinkProps = React.ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}

/** 站内导航用的按钮样式链接。 */
export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...rest} />
  )
}

/**
 * 外部链接按钮（Demo、官网等）。与 ButtonLink 视觉一致，
 * 但用原生 <a> 以便 target/rel 生效。
 */
export function ButtonAnchor({
  variant,
  size,
  block,
  className,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}) {
  return (
    <a className={buttonClass({ variant, size, block, className })} {...rest} />
  )
}
