'use client'

import { createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

/**
 * 表单基础件。
 *
 * 全部样式来自新体系：字段容器用 `.ui-field` / `.ui-label` / `.ui-hint`，
 * 控件用 `.ui-input` / `.ui-select` / `.ui-textarea`，按钮用 `.ui-btn*`。
 * 控件自己不带颜色知识，全部走语义 token。
 *
 * 无障碍契约：
 *   · 每个控件都有可关联的 `<label htmlFor>`（分组控件用 role="group" + aria-labelledby）。
 *   · 错误态给控件 `aria-invalid`，并把 hint / error 的 id 拼进 `aria-describedby`。
 *     这一步由 FormField 通过 context 下发，调用方不需要多传任何 prop。
 */

type FieldDescription = {
  /** hint / error 元素的 id，控件据此拼出 aria-describedby。 */
  ids: string[]
  invalid: boolean
}

const FieldDescriptionContext = createContext<FieldDescription | null>(null)

/**
 * 供控件使用：拿到 FormField 下发的描述性元素 id，并在自身报错时标记 invalid。
 * 必须在组件内无条件调用（hook 规则）。
 *
 * `invalid` 用于「组级约束」：例如「电话/邮箱/微信至少填一项」这种一条错误
 * 同时约束多个控件的情形，需要由调用方显式告诉每个控件它也不合格。
 */
export function useFieldDescription(errorId?: string, invalid?: boolean) {
  const context = useContext(FieldDescriptionContext)
  const ids = [...(context?.ids ?? [])]
  // 独立使用时（没有 FormField 包裹）才自报错误 id，避免指向不存在的元素。
  if (context === null && errorId) ids.push(errorId)
  return {
    'aria-invalid': errorId || invalid ? true : undefined,
    'aria-describedby': ids.length > 0 ? ids.join(' ') : undefined,
  }
}

/**
 * 供「整块即一个控件」的自定义控件（如上传器）使用：
 * 没有独立错误 prop，直接继承 FormField 的 invalid 与描述 id。
 */
export function useFieldGroupDescription() {
  const context = useContext(FieldDescriptionContext)
  return {
    'aria-invalid': context?.invalid ? true : undefined,
    'aria-describedby': context && context.ids.length > 0 ? context.ids.join(' ') : undefined,
  }
}

/** 必填标记：纯装饰，不参与可访问名。 */
function RequiredMark() {
  return (
    <span aria-hidden className="ml-1 text-brand">
      *
    </span>
  )
}

export function FieldLabel({
  htmlFor,
  id,
  required,
  children,
}: {
  htmlFor: string
  id?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} id={id} className="ui-label">
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  )
}

export function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="ui-hint">
      {children}
    </p>
  )
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="ui-field-error">
      {children}
    </p>
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
  min,
  max,
  invalid,
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
  min?: number
  max?: number
  /** 组级约束下的 invalid（本控件自己没错，但整组不合格）。 */
  invalid?: boolean
}) {
  const describedBy = useFieldDescription(error ? `${id}-error` : undefined, invalid)
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
      min={type === 'number' ? min : undefined}
      max={type === 'number' ? max : undefined}
      className="ui-input"
      {...describedBy}
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
  const describedBy = useFieldDescription(error ? `${id}-error` : undefined)
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
      className="ui-textarea"
      {...describedBy}
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
  const describedBy = useFieldDescription(error ? `${id}-error` : undefined)
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="ui-select"
      {...describedBy}
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
        className="size-4 cursor-pointer accent-brand"
      />
      <span className="text-body-sm font-bold text-foreground">{children}</span>
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
    <section className="ui-panel">
      <h2 className="flex items-baseline gap-3 text-h3 font-bold">
        <span className="eyebrow eyebrow--accent">{String(index).padStart(2, '0')}</span>
        {title}
      </h2>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  )
}

/**
 * 一个字段 = 标签 + 控件 + hint/error。
 *
 * `group` 用于非单一控件的字段（多选胶囊墙、三合一联系方式）：
 * 标签改用 `role="group" + aria-labelledby` 关联整组，而不是错误地
 * 指向一个不可 label 的 div。
 */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  group = false,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string
  group?: boolean
  children: React.ReactNode
}) {
  const labelId = `${htmlFor}-label`
  const isInvalid = Boolean(error)
  const showHint = Boolean(hint) && !isInvalid
  const hintId = showHint ? `${htmlFor}-hint` : undefined
  const errorId = isInvalid ? `${htmlFor}-error` : undefined
  const ids = [hintId, errorId].filter((value): value is string => Boolean(value))

  return (
    <FieldDescriptionContext.Provider value={{ ids, invalid: isInvalid }}>
      <div
        className={cn('ui-field', group && 'gap-3')}
        role={group ? 'group' : undefined}
        aria-labelledby={group ? labelId : undefined}
        aria-describedby={group && ids.length > 0 ? ids.join(' ') : undefined}
      >
        {group ? (
          <span id={labelId} className="ui-label">
            {label}
            {required ? <RequiredMark /> : null}
          </span>
        ) : (
          <FieldLabel htmlFor={htmlFor} required={required}>
            {label}
          </FieldLabel>
        )}
        {children}
        {showHint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
        <FieldError id={errorId}>{error}</FieldError>
      </div>
    </FieldDescriptionContext.Provider>
  )
}
