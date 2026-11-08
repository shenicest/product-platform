import { cn } from '@/lib/utils'
import type { ApplicationReviewTarget } from '@/lib/organizer-applications'

/**
 * 审核动作的图标。
 *
 * 与 `components/ui/heart-icon.tsx` 同一套约定：24×24 网格、1.5 描边、
 * 圆角连接、`fill-none` + `stroke-current`，颜色完全交给父级 —— 图标自己
 * 不认识皮肤，也不读状态。
 *
 * 为什么是图标而不是文字按钮：审核队列的操作列只有四个动作，用文字时
 * 每个按钮至少 60px 宽，四个并排会把整张表挤到别的列只剩一个字；
 * 而「通过 / 待定 / 候补 / 不通过」在列表里是可以靠形状区分的 ——
 * 勾、钟、队列、叉。完整语义留在按钮的 `aria-label` 与 `title` 上，
 * 键盘和读屏用户拿到的是文字，视觉用户拿到的是形状。
 *
 * 形状选择：
 *   · accepted   → 勾：最普遍的正向确认；
 *   · pending    → 时钟：待定 = 先放着，等条件成熟；
 *   · waitlisted → 沙漏：候补 = 排着队等位置（与「待定」的圆形时钟在
 *                  15px 下形状差异足够大：一个圆、一个双三角，不会看混）；
 *   · rejected   → 叉：与勾构成一对，扫一眼就能分辨。
 */
export function ReviewActionIcon({
  target,
  className,
}: {
  target: ApplicationReviewTarget
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={cn('block shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {target === 'accepted' ? (
        <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
      ) : target === 'pending' ? (
        <>
          <circle cx="12" cy="12" r="8.25" />
          <path d="M12 7.5V12l3.25 2" />
        </>
      ) : target === 'waitlisted' ? (
        <>
          <path d="M7 3.5h10M7 20.5h10" />
          <path d="M7.75 3.5c0 4 4.25 5.75 4.25 8.5s-4.25 4.5-4.25 8.5" />
          <path d="M16.25 3.5c0 4-4.25 5.75-4.25 8.5s4.25 4.5 4.25 8.5" />
        </>
      ) : (
        <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
      )}
    </svg>
  )
}
