import { cn } from '@/lib/utils'

/**
 * 爱心图标（♥ / ♡）—— 「喜欢」控件的状态符号，形状取自设计稿 `#heart-icon`
 * （24×24 网格，描边 1.5，圆角连接）。
 *
 * 为什么是爱心而不是品牌花：设计稿里 `.icon-button[data-save]` 用的就是
 * 这颗 `#heart-icon`，花瓣图形只出现在 `.bloom-label` 的装饰绽开动画里。
 * 两者混用会让「点赞」看起来像装饰元素，所以这里换回设计稿的语义。
 * （FlowerIcon 仍然保留 —— BloomPop 的装饰花还在用它。）
 *
 * 状态只用两个 Tailwind 类表达，组件本身不认识皮肤：
 *   · 未点赞：`fill-none` + `stroke-current` → 空心描边爱心；
 *   · 已点赞：`fill-current` → 实心爱心（父级用 `text-brand` 给绽放粉），
 *     描边保留，保证实心状态下边缘依然和空心态对齐。
 *
 * 纯展示组件，不读状态、不写状态；`aria-hidden` 由图标自己声明，
 * 语义交给外层按钮的 `aria-label` / `aria-pressed`。
 */
export function HeartIcon({
  filled,
  className,
}: {
  filled: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={cn('block shrink-0', className)}
    >
      <path
        d="M12 20S3 14.5 3 8.7A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.7C21 14.5 12 20 12 20Z"
        className={cn(filled ? 'fill-current' : 'fill-none', 'stroke-current')}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}
