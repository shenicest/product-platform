import { ButtonLink } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

export function NotFoundShell({
  title,
  description,
  href,
  linkLabel,
  eyebrow = 'ERROR / 404',
}: {
  title: string
  description: string
  href: string
  linkLabel: string
  eyebrow?: string
}) {
  return (
    <div className="shell shell--text flex flex-col items-start py-24">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-md text-body-lg leading-[1.7] text-muted-foreground">
        {description}
      </p>
      <ButtonLink href={href} variant="primary" className="mt-8">
        {linkLabel} <span className="ui-btn__arrow" aria-hidden>→</span>
      </ButtonLink>
    </div>
  )
}
