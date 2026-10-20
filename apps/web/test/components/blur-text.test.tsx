import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BlurText } from '@/components/ui/blur-text'

/**
 * jsdom 没有 IntersectionObserver，而 `trigger="view"`（默认值）的入场完全
 * 依赖它。这里装一个最小的可手动驱动的替身：把回调存起来，测试里想让它
 * 「滚进视口」时调用 `triggerIntersect()`。
 */
type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void
let observerCallback: ObserverCallback | null = null

class FakeIntersectionObserver {
  constructor(cb: ObserverCallback) {
    observerCallback = cb
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

function triggerIntersect() {
  act(() => {
    observerCallback?.([{ isIntersecting: true }])
  })
}

beforeEach(() => {
  observerCallback = null
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * 组件里 `out → in → 完成回调` 是一串由 timer 串起来的 phase 迁移，每一段
 * 定时器都要等 React 提交完、effect 重跑之后才会被排上。所以用假定时器时
 * 必须小步推进并逐步 flush，一把 `advanceTimersByTime(4000)` 只会跑掉第一段。
 */
async function advance(totalMs: number, stepMs = 100) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    await act(async () => {
      vi.advanceTimersByTime(stepMs)
    })
  }
}

describe('BlurText', () => {
  it('exposes the whole text once to assistive tech and hides the animated pieces', () => {
    const { container } = render(<BlurText text="Hello big world" />)

    // 可见的逐词 span 全是 aria-hidden，读屏器只会读到开头那段隐藏文本。
    const srOnly = container.querySelector('p > span')
    expect(srOnly).toHaveTextContent('Hello big world')
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })

  it('splits into one piece per word by default', () => {
    const { container } = render(<BlurText text="one two three" />)
    const animated = container.querySelectorAll('[aria-hidden="true"]')
    expect(animated).toHaveLength(3)
  })

  it('splits into letters plus preserved spaces when animateBy is letters', () => {
    const { container } = render(<BlurText text="ab cd" animateBy="letters" />)
    // a b + 空格 + c d = 5 个 piece
    const animated = container.querySelectorAll('[aria-hidden="true"]')
    expect(animated).toHaveLength(5)
  })

  it('applies className to the paragraph', () => {
    const { container } = render(<BlurText text="hi" className="cover__tagline" />)
    expect(container.querySelector('p')).toHaveClass('cover__tagline')
  })

  it('fires onAnimationComplete after the staggered entrance finishes', async () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      render(<BlurText text="a b" trigger="load" delay={100} onAnimationComplete={onComplete} />)

      // 入场总时长 = (0.35 * 2 * max(1, 0.5*2.2) + 1 * 0.1) * 1000 ≈ 870ms
      expect(onComplete).not.toHaveBeenCalled()
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      expect(onComplete).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for the element to scroll into view before animating', async () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      render(<BlurText text="a b" trigger="view" onAnimationComplete={onComplete} />)

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      // 还没滚进视口，不该开始入场。
      expect(onComplete).not.toHaveBeenCalled()

      triggerIntersect()
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      expect(onComplete).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts sharp for hover/click triggers and replays on hover', async () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      const { container } = render(
        <BlurText text="a b" trigger="hover" onAnimationComplete={onComplete} />,
      )
      const paragraph = container.querySelector('p')!

      // rest 起始：没有入场动画在跑。
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      expect(onComplete).not.toHaveBeenCalled()

      // 悬停一次 → 出场再入场，结束时回调一次。
      act(() => {
        fireEvent.pointerEnter(paragraph)
      })
      await advance(4000)
      expect(onComplete).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('replays on click when trigger is click', async () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      const { container } = render(
        <BlurText text="a b" trigger="click" onAnimationComplete={onComplete} />,
      )
      act(() => {
        fireEvent.click(container.querySelector('p')!)
      })
      await advance(4000)
      expect(onComplete).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps looping when loop is enabled', async () => {
    vi.useFakeTimers()
    try {
      const onComplete = vi.fn()
      render(
        <BlurText
          text="a b"
          trigger="load"
          loop
          loopDelay={0.1}
          onAnimationComplete={onComplete}
        />,
      )

      // 每轮「入场 → 停 → 出场」都要经过一次 React 提交才会排下一段定时器，
      // 所以按小步推进、每步 flush 一次，而不是一把 advance 到底。
      for (let i = 0; i < 12; i++) {
        await act(async () => {
          vi.advanceTimersByTime(500)
        })
      }

      expect(onComplete.mock.calls.length).toBeGreaterThan(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('honours a custom animationFrom/animationTo pair', () => {
    const { container } = render(
      <BlurText
        text="x y"
        animationFrom={{ opacity: 0, y: 20 }}
        animationTo={[{ opacity: 1, y: 0 }]}
        easing="easeOut"
      />,
    )
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })

  it('renders without an IntersectionObserver crash when the API is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    // 缺少 IntersectionObserver 的浏览器里不应该抛错 —— 组件应当退化成
    // 直接渲染文本（这里只断言挂载不炸，且文本仍可读）。
    expect(() => render(<BlurText text="safe" />)).not.toThrow()
    // 文本出现两次（隐藏的整句 + aria-hidden 的分片），所以用 AllBy。
    expect(screen.getAllByText('safe').length).toBeGreaterThan(0)
  })
})
