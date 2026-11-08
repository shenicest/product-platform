'use client'

import { useRef, useState } from 'react'
import { CHALLENGE_DETAIL_TABS } from '@shenicest/shared'

/**
 * 命题详情页的 tab 条。
 *
 * 无障碍口径（WAI-ARIA tabs pattern）：
 *   · `role="tablist"` 上只有**一个** tab 落在 tab 序里（roving tabindex），
 *     左右箭头 / Home / End 在 tab 之间移动并**同时**切换面板 —— 这是
 *     "automatic activation"，六张面板都是静态内容，切换没有代价；
 *   · `aria-controls` 指向面板 id，面板 `aria-labelledby` 指回来；
 *   · 未选中的面板用 `hidden` 移出无障碍树，而不是只靠 CSS 隐藏。
 *
 * 面板内容由服务端组件预先渲染好、作为 `content` 传进来：
 * tab 切换只是显示/隐藏，不会重新取数，也不会让用户丢掉页面滚动位置。
 */
export function ChallengeDetailTabs({
  panels,
}: {
  panels: Array<{ key: string; content: React.ReactNode }>
}) {
  const tabs = CHALLENGE_DETAIL_TABS.filter((tab) =>
    panels.some((panel) => panel.key === tab.key),
  )
  const [active, setActive] = useState<string>(tabs[0]?.key ?? 'card')
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  const focusTab = (key: string) => {
    setActive(key)
    buttons.current.get(key)?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.key === active)
    if (index < 0) return
    const last = tabs.length - 1
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusTab(tabs[index === last ? 0 : index + 1].key)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusTab(tabs[index === 0 ? last : index - 1].key)
        break
      case 'Home':
        event.preventDefault()
        focusTab(tabs[0].key)
        break
      case 'End':
        event.preventDefault()
        focusTab(tabs[last].key)
        break
      default:
        break
    }
  }

  return (
    <div className="challenge-tabs">
      <div
        className="challenge-tabs__list"
        role="tablist"
        aria-label="命题详情"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`challenge-tab-${tab.key}`}
              className="challenge-tabs__tab"
              aria-selected={selected}
              aria-controls={`challenge-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                if (node) buttons.current.set(tab.key, node)
                else buttons.current.delete(tab.key)
              }}
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => {
        const selected = tab.key === active
        const panel = panels.find((item) => item.key === tab.key)
        return (
          <div
            key={tab.key}
            role="tabpanel"
            id={`challenge-panel-${tab.key}`}
            className="challenge-tabs__panel"
            aria-labelledby={`challenge-tab-${tab.key}`}
            hidden={!selected}
          >
            {panel?.content ?? null}
          </div>
        )
      })}
    </div>
  )
}
