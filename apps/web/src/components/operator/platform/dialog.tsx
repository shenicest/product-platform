'use client'

import { useEffect, useId, useRef } from 'react'

/**
 * 平台后台通用的弹窗外壳（驳回原因 / 新建组织 / 新增成员共用）。
 *
 * 样式契约与 `season-draft-dialog`、`challenge-dialog-shell` 一致：
 * `fixed inset-0 bg-overlay` 遮罩 + `ui-panel` 内容 + Esc 关闭 +
 * `role="dialog" aria-modal aria-labelledby`。
 *
 * 不做焦点陷阱（与全站一致）：打开时聚焦「关闭」，Esc 与「取消」都能退出，
 * 关闭后由调用方把焦点还给触发按钮。
 */
export function PlatformDialog({
  title,
  description,
  onCancel,
  children,
  footer,
  maxWidth = 'max-w-lg',
}: {
  title: string
  description?: string
  onCancel: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
}) {
  const uid = useId()
  const titleId = `${uid}-title`
  const closeRef = useRef<HTMLButtonElement | null>(null)

  // Esc 绑定只跑一次：`onCancel` 常是内联箭头函数，放进依赖会让 effect
  // 每次渲染都重新聚焦「关闭」按钮，把焦点从输入框抢走。
  const cancelRef = useRef(onCancel)
  useEffect(() => {
    cancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className={`ui-panel my-8 w-full ${maxWidth}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-h3 font-bold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-body-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            className="ui-btn ui-btn--ghost ui-btn--small"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}
