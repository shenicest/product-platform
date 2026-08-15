'use client'

import { cn } from '@/lib/utils'

const fieldBase =
  'w-full border border-input bg-card px-3.5 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary'

export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-foreground">
      {children}
      {required ? <span className="ml-1 text-primary">*</span> : null}
    </label>
  )
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 font-mono text-[11px] text-muted-foreground">{children}</p>
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p className="mt-1 font-mono text-[11px] text-destructive">{children}</p>
  )
}

export function TextInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  error,
  maxLength,
}: {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  type?: string
  error?: string
  maxLength?: number
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      className={cn(fieldBase, error && 'border-destructive focus:border-destructive')}
    />
  )
}

export function TextArea({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
  rows = 4,
  error,
  maxLength,
}: {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  rows?: number
  error?: string
  maxLength?: number
}) {
  return (
    <textarea
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      rows={rows}
      maxLength={maxLength}
      className={cn(fieldBase, 'resize-y', error && 'border-destructive focus:border-destructive')}
    />
  )
}

export function SelectInput({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  error?: string
}) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(fieldBase, 'cursor-pointer', error && 'border-destructive focus:border-destructive')}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export function CheckboxInput({
  id,
  name,
  checked,
  onChange,
  children,
}: {
  id: string
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer accent-primary"
      />
      <span className="text-sm font-bold text-foreground">{children}</span>
    </label>
  )
}

export function FormSection({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-border bg-card p-6">
      <h2 className="flex items-baseline gap-3 text-lg font-bold">
        <span className="font-mono text-[11px] tracking-[0.08em] text-primary">
          {String(index).padStart(2, '0')}
        </span>
        {title}
      </h2>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  )
}

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <FieldLabel htmlFor={htmlFor} required={required}>
        {label}
      </FieldLabel>
      {children}
      {hint && !error ? <FieldHint>{hint}</FieldHint> : null}
      <FieldError>{error}</FieldError>
    </div>
  )
}
