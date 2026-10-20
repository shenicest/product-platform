'use client'

import { motion, MotionConfig, type Easing } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * BlurText —— 来自 React Bits 的逐词/逐字「对焦入场」文字组件。
 *
 * 上游是 JavaScript 版本（`reactbits.dev` 的 BlurText），这里移植成 TSX：
 * 逻辑逐行保留，只是补上类型、把 `className` 交给 `cn()` 合并，并额外
 * 导出一个默认导出，方便按上游文档直接 `import BlurText from …`。
 *
 * 工作原理：
 * 1. `pieces` 把文本切成「词」或「字」，每个 piece 是一个 `motion.span`，
 *    各自带一份延迟（`rank * delay`）错峰入场。
 * 2. 每个 effect 编译成「起始帧 + 若干中间帧 + 退出帧」，再用
 *    `buildKeyframes` 拼成 motion 的多关键帧数组。
 * 3. `phase` 是这台状态机的唯一状态：`from`（未触发）→ `in`（入场）→
 *    `rest`（静止）→ `out`（出场，仅 loop / hover / click 用）。
 *
 * 无障碍：可见的那堆 span 全是 `aria-hidden`，真正的文本由开头那个
 * 视觉隐藏的 `<span style={SR_ONLY}>` 提供给读屏器 —— 否则读屏器会把
 * 一个句子按词拆开、逐个朗读，听感支离破碎。
 *
 * 动效降级：整棵子树包在 `<MotionConfig reducedMotion="user">` 里，
 * 用户开启「减少动态效果」时 motion 会跳过位移/缩放类动画，只保留透明度，
 * 文字依然会正常出现，不会卡在看不见的初始帧。
 */

export type BlurTextEffect = 'blur' | 'zoom' | 'tilt' | 'focus' | 'drift'
export type BlurTextAnimateBy = 'words' | 'letters'
export type BlurTextDirection = 'top' | 'bottom' | 'left' | 'right'
export type BlurTextStaggerFrom = 'start' | 'center' | 'end' | 'random'
export type BlurTextTrigger = 'view' | 'load' | 'hover' | 'click'

/** 单帧样式：CSS 属性名 → 值。 */
type Keyframe = Record<string, string | number>
/** 多关键帧轨道：CSS 属性名 → 按时间排列的值序列。 */
type KeyframeTrack = Record<string, (string | number)[]>

/** 一种 effect 编译后的完整描述。 */
interface Effect {
  from: Keyframe
  steps: Keyframe[]
  exit: Keyframe
  /** 中间帧的时间点（0~1）。 */
  times: number[]
  fade: Easing
  /** 位移属性用的 spring 回弹系数；`null` 表示不加 spring。 */
  bounce: number | null
  settle: number
  exitEase: Easing
  origin?: Record<string, number>
}

const AXES: Record<BlurTextDirection, readonly [string, number]> = {
  top: ['y', -1],
  bottom: ['y', 1],
  left: ['x', -1],
  right: ['x', 1],
}

// motion 的贝塞尔曲线必须是 readonly 四元组，所以这里用 `as const`
// 而不是普通数组 —— 否则 `number[]` 匹配不上 `Easing`。
const EASE_OUT = [0.33, 1, 0.68, 1] as const
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const
const EASE_IN = [0.55, 0, 0.9, 0.45] as const
const CSS_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const MOVE_KEYS = ['x', 'y', 'scale', 'rotateX', 'rotateY', 'skewX']
const INSTANT = { duration: 0 }

const SR_ONLY = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
  userSelect: 'none',
} as const

const PIECE_STYLE = {
  display: 'inline-block',
  willChange: 'transform, filter, opacity',
} as const
const WORD_STYLE = { display: 'inline-flex' } as const

const blurTo = (px: number) => `blur(${Math.max(0, px)}px)`

const buildEffect = (
  effect: BlurTextEffect,
  direction: BlurTextDirection,
  blur: number,
  distance: number,
): Effect => {
  const [axis, sign] = AXES[direction] ?? AXES.top
  const b = Math.max(0, blur)
  const d = distance

  if (effect === 'zoom') {
    return {
      from: {
        filter: blurTo(b * 1.2),
        opacity: 0,
        scale: 1.4,
        [axis]: sign * d * 0.35,
      },
      steps: [
        {
          filter: blurTo(b * 0.2),
          opacity: 0.9,
          scale: 0.97,
          [axis]: -sign * d * 0.03,
        },
        { filter: blurTo(0), opacity: 1, scale: 1, [axis]: 0 },
      ],
      exit: {
        filter: blurTo(b),
        opacity: 0,
        scale: 0.82,
        [axis]: -sign * d * 0.2,
      },
      times: [0, 0.6, 1],
      fade: EASE_OUT,
      bounce: 0.25,
      settle: 0.5,
      exitEase: EASE_IN,
    }
  }

  if (effect === 'tilt') {
    const rotate = axis === 'y' ? 'rotateX' : 'rotateY'
    const lean = axis === 'y' ? -sign : sign
    return {
      from: {
        filter: blurTo(b),
        opacity: 0,
        [rotate]: lean * 55,
        [axis]: sign * d * 0.5,
        transformPerspective: 600,
      },
      steps: [
        {
          filter: blurTo(b * 0.15),
          opacity: 0.95,
          [rotate]: -lean * 8,
          [axis]: -sign * d * 0.04,
          transformPerspective: 600,
        },
        {
          filter: blurTo(0),
          opacity: 1,
          [rotate]: 0,
          [axis]: 0,
          transformPerspective: 600,
        },
      ],
      exit: {
        filter: blurTo(b),
        opacity: 0,
        [rotate]: -lean * 40,
        [axis]: -sign * d * 0.3,
        transformPerspective: 600,
      },
      times: [0, 0.6, 1],
      fade: EASE_OUT,
      bounce: 0.3,
      settle: 0.8,
      origin: {
        originX: axis === 'x' ? (sign < 0 ? 0 : 1) : 0.5,
        originY: axis === 'y' ? (sign < 0 ? 0 : 1) : 0.5,
      },
      exitEase: EASE_IN,
    }
  }

  if (effect === 'focus') {
    const soft = { filter: blurTo(b * 1.4), opacity: 0.32, scale: 1.12 }
    return {
      from: soft,
      steps: [
        { filter: blurTo(b * 0.1), opacity: 0.95, scale: 0.995 },
        { filter: blurTo(0), opacity: 1, scale: 1 },
      ],
      exit: soft,
      times: [0, 0.72, 1],
      fade: EASE_IN_OUT,
      bounce: null,
      settle: 1,
      exitEase: EASE_IN_OUT,
    }
  }

  if (effect === 'drift') {
    const h = direction === 'right' ? 1 : -1
    const v = axis === 'y' ? sign : 0
    return {
      from: {
        filter: blurTo(b),
        opacity: 0,
        x: h * d * 1.6,
        y: v * d * 0.3,
        skewX: h * 28,
      },
      steps: [
        {
          filter: blurTo(b * 0.15),
          opacity: 0.95,
          x: -h * d * 0.06,
          y: 0,
          skewX: -h * 7,
        },
        { filter: blurTo(0), opacity: 1, x: 0, y: 0, skewX: 0 },
      ],
      exit: {
        filter: blurTo(b),
        opacity: 0,
        x: -h * d * 1.2,
        y: -v * d * 0.2,
        skewX: h * 20,
      },
      times: [0, 0.62, 1],
      fade: EASE_OUT,
      bounce: 0.3,
      settle: 0.55,
      exitEase: EASE_IN,
    }
  }

  return {
    from: { filter: blurTo(b), opacity: 0, [axis]: sign * d },
    steps: [
      { filter: blurTo(b / 2), opacity: 0.5, [axis]: (-sign * d) / 10 },
      { filter: blurTo(0), opacity: 1, [axis]: 0 },
    ],
    exit: { filter: blurTo(b), opacity: 0, [axis]: -sign * d * 0.6 },
    times: [0, 0.5, 1],
    fade: 'linear',
    bounce: 0.35,
    settle: 0.5,
    exitEase: EASE_IN,
  }
}

const buildKeyframes = (from: Keyframe, steps: Keyframe[]): KeyframeTrack => {
  const keys = new Set([
    ...Object.keys(from),
    ...steps.flatMap((s) => Object.keys(s)),
  ])

  const keyframes: KeyframeTrack = {}
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])]
  })
  return keyframes
}

/**
 * 给每个 piece 算一个「入场序号」：序号越小越先动。
 * `random` 用文本自身做种子的伪随机洗牌 —— 同一段文案每次刷新顺序一致，
 * 不会出现每次加载都乱跳的情况。
 */
const buildRanks = (
  count: number,
  staggerFrom: BlurTextStaggerFrom,
  seedText: string,
): number[] => {
  const ranks = Array.from({ length: count }, (_, i) => i)
  if (staggerFrom === 'end') return ranks.map((i) => count - 1 - i)
  if (staggerFrom === 'center') {
    const mid = (count - 1) / 2
    const offset = count % 2 === 0 ? 0.5 : 0
    return ranks.map((i) => Math.abs(i - mid) - offset)
  }
  if (staggerFrom === 'random') {
    let seed = 2166136261
    for (let i = 0; i < seedText.length; i++)
      seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619) >>> 0
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const order = ranks.slice()
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    order.forEach((piece, rank) => {
      ranks[piece] = rank
    })
  }
  return ranks
}

type Phase = 'from' | 'in' | 'rest' | 'out'

const startPhase = (trigger: BlurTextTrigger): Phase =>
  trigger === 'load'
    ? 'in'
    : trigger === 'hover' || trigger === 'click'
      ? 'rest'
      : 'from'

export interface BlurTextProps {
  /** 要动画的文本。 */
  text?: string
  /** 每个 piece 的入场方式。 */
  effect?: BlurTextEffect
  /** 按词还是按字切分。 */
  animateBy?: BlurTextAnimateBy
  /** 入场方向（drift 固定横向，只有 right 会改向）。 */
  direction?: BlurTextDirection
  /** 错峰起点：第一个 / 中间 / 最后一个 / 打乱。 */
  staggerFrom?: BlurTextStaggerFrom
  /** 触发方式。 */
  trigger?: BlurTextTrigger
  /** 每个 piece 之间的延迟（ms）。 */
  delay?: number
  /** 单步动画时长（s）。 */
  stepDuration?: number
  /** 循环：停住 → 模糊退出 → 再入场。 */
  loop?: boolean
  /** 循环时保持清晰的时间（s）。 */
  loopDelay?: number
  /** 起始模糊半径（px）。 */
  blur?: number
  /** 位移距离（px）；0 表示只对焦不位移。 */
  distance?: number
  /** 文字颜色，默认继承当前文本色。 */
  color?: string
  /** 入场前的起始颜色（配合 color 做一次染色过渡）。 */
  fromColor?: string
  /** 悬停某个词时，其余词变模糊变淡。 */
  focusOnHover?: boolean
  /** IntersectionObserver 阈值。 */
  threshold?: number
  /** IntersectionObserver 的 rootMargin。 */
  rootMargin?: string
  /** 自定义起始帧，会顶掉 effect / blur / distance / direction。 */
  animationFrom?: Keyframe
  /** 自定义后续关键帧，接在 animationFrom 之后。 */
  animationTo?: Keyframe[]
  /** 每一步的 easing；留空则用各 effect 自带曲线。 */
  easing?: Easing | Easing[]
  /** 额外的类名，作用在 `<p>` 上。 */
  className?: string
  /** 每次入场结束时回调。 */
  onAnimationComplete?: () => void
}

export function BlurText({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing,
  onAnimationComplete,
  stepDuration = 0.35,
  blur = 10,
  distance = 50,
  effect = 'blur',
  staggerFrom = 'start',
  trigger = 'view',
  loop = false,
  loopDelay = 2,
  color,
  fromColor,
  focusOnHover = false,
}: BlurTextProps) {
  const ref = useRef<HTMLParagraphElement>(null)
  // 首个 phase 只在挂载时算一次，用来决定每个 piece 要不要跳过 initial
  // （`trigger="hover" | "click"` 时文字一开始就该是清晰的）。
  // 用 state 而不是 ref 保存：ref 的 `.current` 不允许在渲染期读取。
  const [firstPhase] = useState<Phase>(() => startPhase(trigger))
  const [phase, setPhase] = useState<Phase>(firstPhase)
  const [focusWord, setFocusWord] = useState(-1)
  const settledRef = useRef(phase === 'rest')
  // 回调放进 ref，避免它的身份变化触发下面那几个 effect 重新计时。
  const completeRef = useRef(onAnimationComplete)
  useEffect(() => {
    completeRef.current = onAnimationComplete
  }, [onAnimationComplete])

  const fx = useMemo(
    () => buildEffect(effect, direction, blur, distance),
    [effect, direction, blur, distance],
  )

  const custom = Boolean(animationFrom || animationTo || easing)
  const fromSnapshot = animationFrom ?? fx.from
  const toSnapshots = animationTo ?? fx.steps
  const exitSnapshot = animationFrom ?? fx.exit
  const restSnapshot = toSnapshots[toSnapshots.length - 1]
  const animateKeyframes = useMemo(
    () => buildKeyframes(fromSnapshot, custom ? toSnapshots : [restSnapshot]),
    [fromSnapshot, toSnapshots, restSnapshot, custom],
  )

  const stepCount = toSnapshots.length + 1
  const totalDuration = stepDuration * (stepCount - 1)
  const times = animationTo
    ? Array.from({ length: stepCount }, (_, i) =>
        stepCount === 1 ? 0 : i / (stepCount - 1),
      )
    : fx.times
  const stagger = Math.max(0, delay) / 1000
  const exitDuration = stepDuration * 1.3
  const exitStagger = stagger * 0.4

  const words = useMemo(() => text.split(' '), [text])

  const pieces = useMemo(() => {
    const list: { word: number; content: string; key: string }[] = []
    words.forEach((word, w) => {
      const isLast = w === words.length - 1
      if (animateBy === 'words') {
        list.push({
          word: w,
          content: isLast ? word : `${word}\u00A0`,
          key: `word-${w}`,
        })
        return
      }
      Array.from(word).forEach((char, c) =>
        list.push({ word: w, content: char, key: `char-${w}-${c}` }),
      )
      if (!isLast)
        list.push({ word: w, content: '\u00A0', key: `space-${w}` })
    })
    return list
  }, [words, animateBy])

  const groups = useMemo(() => {
    const list: number[][] = words.map(() => [])
    pieces.forEach((piece, index) => list[piece.word].push(index))
    return list
  }, [words, pieces])

  const ranks = useMemo(
    () => buildRanks(pieces.length, staggerFrom, text),
    [pieces.length, staggerFrom, text],
  )
  const maxRank = ranks.reduce((max, rank) => Math.max(max, rank), 0)
  const inTotal =
    (totalDuration * (custom ? 1 : Math.max(1, fx.settle * 2.2)) +
      maxRank * stagger) *
    1000
  const outTotal = (exitDuration + maxRank * exitStagger) * 1000

  // 只有 `trigger="view"` 会停在 'from' 等滚动（`load` 直接是 'in'，
  // `hover`/`click` 直接是 'rest'，都由 startPhase 在挂载时定好了），
  // 所以这里只可能是滚动触发这一条路径。
  useEffect(() => {
    if (phase !== 'from') return undefined
    const element = ref.current
    if (!element) return undefined
    // 老浏览器 / 测试环境可能没有 IntersectionObserver。此时没有「滚进视口」
    // 可等，直接放行入场 —— 宁可少一个入场延迟，也不能把文字永远留在
    // 不可见的起始帧里。推迟到下一个 tick 再做：React 19 的 lint 规则不允许
    // 在 effect 里同步 setState（会触发级联渲染）。
    if (typeof IntersectionObserver === 'undefined') {
      const fallback = window.setTimeout(() => setPhase('in'), 0)
      return () => window.clearTimeout(fallback)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase((current) => (current === 'from' ? 'in' : current))
          observer.disconnect()
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [phase, threshold, rootMargin])

  useEffect(() => {
    let timer = 0
    if (phase === 'in') {
      settledRef.current = false
      timer = window.setTimeout(() => {
        settledRef.current = true
        completeRef.current?.()
        if (loop)
          timer = window.setTimeout(
            () => setPhase('out'),
            Math.max(0, loopDelay) * 1000,
          )
      }, inTotal)
    } else if (phase === 'rest') {
      settledRef.current = true
      if (loop)
        timer = window.setTimeout(
          () => setPhase('out'),
          Math.max(0, loopDelay) * 1000,
        )
    } else if (phase === 'out') {
      settledRef.current = false
      timer = window.setTimeout(() => setPhase('in'), outTotal)
    }
    return () => window.clearTimeout(timer)
  }, [phase, loop, loopDelay, inTotal, outTotal])

  const replay = () => {
    if (phase === 'out' || phase === 'from') return
    setPhase('out')
  }

  const handleEnter = () => {
    if (settledRef.current) replay()
  }

  const inTransition = (rank: number) => {
    const delayed = rank * stagger
    if (custom)
      return {
        duration: totalDuration,
        times,
        delay: delayed,
        ease: easing ?? ('linear' as const),
      }
    const transition: Record<string, unknown> = {
      duration: totalDuration,
      delay: delayed,
      ease: fx.fade,
    }
    if (fx.bounce === null) return transition
    const move = {
      type: 'spring' as const,
      visualDuration: totalDuration * fx.settle,
      bounce: fx.bounce,
      delay: delayed,
    }
    MOVE_KEYS.forEach((key) => {
      if (key in fromSnapshot) transition[key] = move
    })
    return transition
  }

  const target: KeyframeTrack | Keyframe =
    phase === 'in'
      ? animateKeyframes
      : phase === 'out'
        ? exitSnapshot
        : phase === 'rest'
          ? restSnapshot
          : fromSnapshot
  const tinted = Boolean(fromColor) && (phase === 'from' || phase === 'out')
  const dim = Math.min(6, Math.max(2, blur * 0.3))
  const pieceStyle =
    fx.origin && !custom ? { ...PIECE_STYLE, ...fx.origin } : PIECE_STYLE

  const renderPiece = (index: number) => {
    const piece = pieces[index]
    const rank = ranks[index]
    const transition =
      phase === 'in'
        ? inTransition(rank)
        : phase === 'out'
          ? {
              duration: exitDuration,
              ease: fx.exitEase,
              delay: rank * exitStagger,
            }
          : INSTANT
    const style = fromColor
      ? {
          ...pieceStyle,
          color: tinted ? fromColor : undefined,
          transition:
            phase === 'in'
              ? `color ${totalDuration * 0.9}s ${CSS_EASE} ${rank * stagger}s`
              : phase === 'out'
                ? `color ${exitDuration}s ${CSS_EASE} ${rank * exitStagger}s`
                : 'none',
        }
      : pieceStyle

    return (
      <motion.span
        aria-hidden="true"
        key={piece.key}
        style={style}
        initial={firstPhase === 'rest' ? false : fromSnapshot}
        animate={target}
        transition={transition}
      >
        {piece.content}
      </motion.span>
    )
  }

  const wordStyle = (w: number) => {
    if (!focusOnHover) return WORD_STYLE
    const dimmed = focusWord !== -1 && focusWord !== w
    return {
      ...WORD_STYLE,
      filter: dimmed ? `blur(${dim}px)` : 'blur(0px)',
      opacity: dimmed ? 0.3 : 1,
      transition: `filter 0.45s ${CSS_EASE}, opacity 0.45s ${CSS_EASE}`,
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <p
        ref={ref}
        className={cn(className)}
        // 把状态机暴露给 CSS：页面层可以据此给文字配一层随入场一起出现的
        // 背板（首屏插画很花，tagline 需要一块磨砂玻璃才读得清）。
        // 组件本身不关心背板长什么样，只负责说出「我现在到哪一步了」。
        data-phase={phase}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          color,
          cursor: trigger === 'click' ? 'pointer' : undefined,
        }}
        onPointerEnter={trigger === 'hover' ? handleEnter : undefined}
        onClick={trigger === 'click' ? replay : undefined}
      >
        <span style={SR_ONLY}>{text}</span>
        {groups.map((indices, w) => (
          <span
            key={`word-${w}`}
            style={wordStyle(w)}
            onPointerEnter={focusOnHover ? () => setFocusWord(w) : undefined}
            onPointerLeave={focusOnHover ? () => setFocusWord(-1) : undefined}
          >
            {indices.map(renderPiece)}
          </span>
        ))}
      </p>
    </MotionConfig>
  )
}

export default BlurText
