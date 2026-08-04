import Link from 'next/link'

export function NotFoundShell({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string
  description: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {linkLabel}
      </Link>
    </div>
  )
}
