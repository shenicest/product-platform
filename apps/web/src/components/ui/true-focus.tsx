'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, type Transition } from 'motion/react'
import { cn } from '@/lib/utils'
import './true-focus.css'

/**
 * TrueFocus —— 来自 React Bits 的「取景框」焦点文字组件。
 *
 * 上游是 JavaScript 版本（`reactbits.dev` 的 TrueFocus），这里移植成 TSX：
 * 行为逐行保留，只补类型、把 `className` 交给 `cn()` 合并，并按上游文档
 * 同时给出具名导出与默认导出。与 `ui/blur-text.tsx` 是同一套移植约定。
 *
 * 工作原理：
 * 1. 句子按 `separator` 切成词，每个词是一个 `span`，非焦点的词加模糊/降透明。
 * 2. 焦点框的位置来自 `offsetLeft/offsetTop/offsetWidth/offsetHeight` ——
 *    也就是词在容器里的**布局盒**，不是 `getBoundingClientRect()`。这一点
 *    很关键：`focusScale` 会给词加 `transform: scale()`，而 transform 不参与
 *    布局，所以量到的始终是未缩放的尺寸，再把 frame 按 `focusScale` 手工放大，
 *    边框就不会随着词缩放而被二次放大、也不会在动画中途抖动。
 * 3. 容器与每个词都挂 `ResizeObserver`，窗口缩放、字体加载完成后重新量一次。
 *
 * 无障碍：与 `blur-text.tsx` 同样的处理 —— 视觉上的词全部 `aria-hidden`，
 * 整句文本由一个视觉隐藏的 `span` 提供给读屏器。否则读屏器会按词拆开逐词
 * 朗读，而且读到的还是「正在被模糊/放大」的那一堆 span。
 *
 * 动效降级：`useReducedMotion()` 为真时把时长压到 0，并禁用 spring 与
 * 自动轮播的位移观感，文字直接落位，不会卡在看不见的初始帧。
 */

/** 四个角。上游用字符串数组 + 拼接类名，这里保留顺序以便稳定渲染。 */
const CORNERS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const

type Corner = (typeof CORNERS)[number]

/** 取景框到词的间距（px）。上游写死的常量，不对外暴露。 */
const FRAME_GAP = 10

// motion 的贝塞尔曲线必须是 readonly 四元组，普通 number[] 匹配不上 Easing。
const SMOOTH_EASE = [0.65, 0, 0.35, 1] as const
const SMOOTH_CSS = 'cubic-bezier(0.65, 0, 0.35, 1)'
const SPRING_CSS = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export type TrueFocusStyle = 'brackets' | 'box' | 'underline' | 'highlight'
export type TrueFocusEasing = 'smooth' | 'spring'
export type TrueFocusOrder = 'sequential' | 'random'

export interface TrueFocusProps {
  /** 要显示的文本，按 `separator` 切成词。 */
  sentence?: string
  /** 切词用的分隔符。 */
  separator?: string
  /** 焦点标记的形态：取景角 / 整框 / 下划线 / 高亮块。 */
  focusStyle?: TrueFocusStyle
  /** 角、框、下划线的颜色。 */
  borderColor?: string
  /** `highlight` 样式的高亮块颜色，未设时取 `borderColor`。 */
  highlightColor?: string
  /** 取景框周围的柔光颜色，默认不发光。 */
  glowColor?: string
  /** 焦点词的放大倍数，取景框同步放大。 */
  focusScale?: number
  /** 非焦点词的模糊半径（px）。 */
  blurAmount?: number
  /** 非焦点词的透明度（0~1）。 */
  unfocusedOpacity?: number
  /** 取景框移动方式：平滑滑行 / 弹簧回弹。 */
  easing?: TrueFocusEasing
  /** 焦点推进顺序：按阅读顺序 / 随机跳。 */
  order?: TrueFocusOrder
  /** 悬停切换焦点，而不是自动轮播。 */
  manualMode?: boolean
  /** 取景框移动到下一个词的时长（秒）。 */
  animationDuration?: number
  /** 焦点在每个词上停留的时长（秒）。 */
  pauseBetweenAnimations?: number
  /** 每个取景角的边长（px）。 */
  cornerSize?: number
  /** 角、框、下划线的粗细（px）。 */
  borderWidth?: number
  className?: string
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function TrueFocus({
  sentence = 'True Focus',
  separator = ' ',
  manualMode = false,
  focusStyle = 'brackets',
  order = 'sequential',
  easing = 'smooth',
  blurAmount = 5,
  focusScale = 1,
  borderColor,
  highlightColor,
  glowColor = 'transparent',
  animationDuration = 0.5,
  pauseBetweenAnimations = 1,
  cornerSize = 16,
  borderWidth = 3,
  unfocusedOpacity = 1,
  className,
}: TrueFocusProps) {
  // 切词放进渲染里而不是 useMemo：上游如此，且 sentence 通常字面量，
  // 这层开销可以忽略，换掉 useMemo 反而少一个依赖数组要维护。
  const words = sentence.split(separator).filter((word) => word.trim() !== '')

  const [currentIndex, setCurrentIndex] = useState(0)
  const [focusRect, setFocusRect] = useState<Rect | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const reduceMotion = useReducedMotion()

  const duration = reduceMotion ? 0 : animationDuration
  const activeIndex = words.length ? currentIndex % words.length : -1
  const spring = easing === 'spring' && !reduceMotion

  const transition: Transition = spring
    ? { type: 'spring', visualDuration: duration, bounce: 0.38 }
    : { duration, ease: SMOOTH_EASE }

  // 自动轮播。manualMode 或只有一个词时不需要。
  useEffect(() => {
    if (manualMode || words.length < 2) return

    const interval = setInterval(
      () => {
        // 随机序在 setState 外面先摇一次：updater 必须是纯函数，
        // 在它内部调 Math.random() 会在 StrictMode 的双次调用下前后不一致。
        const roll = Math.random()
        setCurrentIndex((prev) => {
          const current = prev % words.length
          if (order !== 'random') return (current + 1) % words.length
          const next = Math.floor(roll * (words.length - 1))
          return next >= current ? next + 1 : next
        })
      },
      (animationDuration + pauseBetweenAnimations) * 1000,
    )

    return () => clearInterval(interval)
  }, [
    manualMode,
    animationDuration,
    pauseBetweenAnimations,
    words.length,
    order,
  ])

  // 量取焦点词的布局盒。用 useLayoutEffect 是为了在绘制前就拿到尺寸，
  // 避免首帧出现「框在左上角闪一下」。
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current
    const word = wordRefs.current[activeIndex]
    if (!container || !word) return

    const measure = () => {
      const next: Rect = {
        x: word.offsetLeft,
        y: word.offsetTop,
        width: word.offsetWidth,
        height: word.offsetHeight,
      }
      // 四个值都没变就返回原对象，省掉一次重渲染。
      setFocusRect((prev) =>
        prev &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      )
    }

    measure()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    for (const node of wordRefs.current) {
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [activeIndex, sentence, separator])

  // 焦点词放大后，框要跟着一起放大，并且仍然以词的中心为中心。
  const frame: Rect | null = focusRect && {
    x: focusRect.x - (focusRect.width * (focusScale - 1)) / 2,
    y: focusRect.y - (focusRect.height * (focusScale - 1)) / 2,
    width: focusRect.width * focusScale,
    height: focusRect.height * focusScale,
  }

  const corners: Record<Corner, { x: number; y: number }> | null = frame && {
    'top-left': { x: frame.x - FRAME_GAP, y: frame.y - FRAME_GAP },
    'top-right': {
      x: frame.x + frame.width + FRAME_GAP - cornerSize,
      y: frame.y - FRAME_GAP,
    },
    'bottom-left': {
      x: frame.x - FRAME_GAP,
      y: frame.y + frame.height + FRAME_GAP - cornerSize,
    },
    'bottom-right': {
      x: frame.x + frame.width + FRAME_GAP - cornerSize,
      y: frame.y + frame.height + FRAME_GAP - cornerSize,
    },
  }

  const shapes: {
    box: Rect
    underline: Rect
    highlight: Rect
  } | null = frame && {
    box: {
      x: frame.x - FRAME_GAP,
      y: frame.y - FRAME_GAP,
      width: frame.width + FRAME_GAP * 2,
      height: frame.height + FRAME_GAP * 2,
    },
    underline: {
      x: frame.x,
      y: frame.y + frame.height + FRAME_GAP * 0.4,
      width: frame.width,
      height: borderWidth,
    },
    highlight: {
      x: frame.x - frame.height * 0.14,
      y: frame.y + frame.height * 0.04,
      width: frame.width + frame.height * 0.28,
      height: frame.height * 0.92,
    },
  }

  // 颜色与尺寸都通过 CSS 自定义属性下发，样式表里只消费 --tf-*。
  const frameStyle = {
    '--tf-border-color': borderColor,
    '--tf-highlight-color': `color-mix(in srgb, ${
      highlightColor ?? borderColor ?? 'var(--brand)'
    } 30%, transparent)`,
    '--tf-glow-color': glowColor,
    '--tf-corner-size': `${cornerSize}px`,
    '--tf-border-width': `${borderWidth}px`,
  } as React.CSSProperties

  return (
    <div
      className={cn('true-focus', manualMode && 'true-focus--manual', className)}
      ref={containerRef}
      style={frameStyle}
    >
      {/* 读屏器只读这一句；下面那堆会变形/模糊的 span 全部 aria-hidden。 */}
      <span className="sr-only">{sentence}</span>

      {focusStyle === 'highlight' && shapes && (
        <motion.span
          className="true-focus__highlight"
          aria-hidden="true"
          initial={{ ...shapes.highlight, opacity: 0 }}
          animate={{ ...shapes.highlight, opacity: 1 }}
          transition={transition}
        />
      )}

      {words.map((word, index) => {
        const isActive = index === activeIndex
        return (
          <span
            key={`${word}-${index}`}
            ref={(el) => {
              wordRefs.current[index] = el
            }}
            aria-hidden="true"
            className={cn(
              'true-focus__word',
              isActive && !manualMode && 'true-focus__word--active',
            )}
            style={{
              filter: `blur(${isActive ? 0 : blurAmount}px)`,
              opacity: isActive ? 1 : unfocusedOpacity,
              transform:
                focusScale !== 1
                  ? `scale(${isActive ? focusScale : 1})`
                  : undefined,
              transition: `filter ${duration}s ease, opacity ${duration}s ease, transform ${duration}s ${
                spring ? SPRING_CSS : SMOOTH_CSS
              }`,
            }}
            onMouseEnter={() => {
              if (manualMode) setCurrentIndex(index)
            }}
          >
            {word}
          </span>
        )
      })}

      {shapes && corners && focusStyle !== 'highlight' && (
        <div className="true-focus__frame" aria-hidden="true">
          {focusStyle === 'box' && (
            <motion.span
              className="true-focus__box"
              initial={{ ...shapes.box, opacity: 0 }}
              animate={{ ...shapes.box, opacity: 1 }}
              transition={transition}
            />
          )}

          {focusStyle === 'underline' && (
            <motion.span
              className="true-focus__underline"
              initial={{ ...shapes.underline, opacity: 0 }}
              animate={{ ...shapes.underline, opacity: 1 }}
              transition={transition}
            />
          )}

          {focusStyle !== 'box' &&
            focusStyle !== 'underline' &&
            CORNERS.map((corner) => (
              <motion.span
                key={corner}
                className={cn('true-focus__corner', `true-focus__corner--${corner}`)}
                initial={{ ...corners[corner], opacity: 0 }}
                animate={{ ...corners[corner], opacity: 1 }}
                transition={transition}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default TrueFocus
