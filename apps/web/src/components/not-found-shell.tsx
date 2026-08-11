import Link from 'next/link'

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
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-md text-base leading-[1.7] text-muted-foreground">
        {description}
      </p>
      <Link href={href} className="btn-hard btn-primary mt-8">
        {linkLabel} <span aria-hidden>→</span>
      </Link>
    </div>
  )
}
