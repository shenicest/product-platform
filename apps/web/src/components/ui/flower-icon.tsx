import { cn } from '@/lib/utils'

/** 六个花瓣的角度，与设计稿 `.bloom-pop` 的 ellipse 旋转序列一致。 */
const PETAL_ANGLES = [0, 60, 120, 180, 240, 300]

/**
 * 小花图标（✿）—— BoomLand 的装饰花，取自 UI 稿 `.bloom-pop`。
 *
 * 注意：它**不是**「喜欢」符号。设计稿里「点赞/收藏」用的是 `#heart-icon`
 * （见 heart-icon.tsx），花朵只出现在 `.bloom-label` 悬停绽开的装饰动画里。
 * 两处混用会让点赞看起来像装饰元素，所以两者分开维护。
 *
 * 颜色全部由语义类承载，组件本身不认识具体配色：
 *   · 未点亮：花瓣 `fill-none` + `stroke-current`；花心用底色挖空 + 描边，
 *     挖空盘盖住六片花瓣交汇的尖端 → 干净的空心花。
 *   · 已点亮：花瓣 `fill-current`（父级用 `text-brand` 给绽放粉），
 *     花瓣之间用 `stroke-background` 留出缝隙（对应设计稿的浅色描边），
 *     花心走 `fill-warning`（暖黄系），高光点用 `fill-warning-soft`。
 *
 * 纯展示组件，不读状态、不写状态；`aria-hidden` 由图标自己声明，
 * 语义交给外层按钮的 `aria-label` / `aria-pressed`。
 */
export function FlowerIcon({
  filled,
  className,
}: {
  filled: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      focusable="false"
      className={cn('block shrink-0', className)}
    >
      <g
        className={
          filled ? 'fill-current stroke-background' : 'fill-none stroke-current'
        }
        strokeWidth={filled ? 0.9 : 2.2}
      >
        {PETAL_ANGLES.map((angle) => (
          <ellipse
            key={angle}
            cx="20"
            cy="10.4"
            rx="5.7"
            ry="9"
            transform={`rotate(${angle} 20 20)`}
          />
        ))}
      </g>

      {/* 花心。点亮态是暖黄实心 + 高光点；未点亮态先用底色圆把六片花瓣
          交汇的尖端盖掉，再描一圈边 —— 否则空心花瓣的交叉线会糊成一团。 */}
      {filled ? (
        <>
          <circle cx="20" cy="20" r="5.2" className="fill-warning" />
          <circle cx="18.5" cy="18.5" r="1.4" className="fill-warning-soft" />
        </>
      ) : (
        <>
          <circle cx="20" cy="20" r="5.2" className="fill-background" />
          <circle
            cx="20"
            cy="20"
            r="5.2"
            className="fill-none stroke-current"
            strokeWidth={2.2}
          />
        </>
      )}
    </svg>
  )
}
