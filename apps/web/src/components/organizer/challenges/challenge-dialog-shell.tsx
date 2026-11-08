'use client'

import { useEffect, useId, useRef } from 'react'

/**
 * 命题与资源 tab 的弹窗外壳。
 *
 * 与 `season-settings` / `organizer-header` 同款：`fixed inset-0 bg-overlay` 遮罩、
 * `ui-panel` 内容、Esc 关闭、`role="dialog" aria-modal aria-labelledby`。
 *
 * 单独抽一份而不是复用赛季设置那个（那边是 `season-settings-view.tsx` 里的私有
 * 组件）：两个 tab 由不同的人维护，互相 import 私有组件会让任一侧的重构都得
 * 先看另一侧的脸色。样式契约写在 `ui-panel` / `bg-overlay` 上，复制的是外壳
 * 不是逻辑。
 *
 * 不做焦点陷阱（与全站一致）：Esc 与「关闭」都能退出，关闭后焦点回到触发按钮
 * 由调用方负责。
 */
export function ChallengeDialogShell({
  title,
  description,
  onCancel,
  children,
}: {
  title: string
  description?: string
  onCancel: () => void
  children: React.ReactNode
}) {
  const uid = useId()
  const titleId = `${uid}-title`
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="ui-panel my-8 w-full max-w-3xl">
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
      </div>
    </div>
  )
}
