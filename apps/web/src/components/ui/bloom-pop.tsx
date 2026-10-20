import { cn } from '@/lib/utils'
import { FlowerIcon } from '@/components/ui/flower-icon'

/**
 * `.bloom-label` 的装饰花 —— 悬停 / 聚焦时从标签右侧旋转着绽开。
 *
 * 设计稿是在页面加载后用一小段脚本给每个 `.bloom-label` 追加这个 span：
 *
 *   document.querySelectorAll('.bloom-label').forEach(label => {
 *     const flower = document.createElement('span')
 *     flower.className = 'bloom-pop'
 *     flower.setAttribute('aria-hidden', 'true')
 *     flower.innerHTML = '<svg …>'
 *     label.append(flower)
 *   })
 *
 * 本站没有那层脚本，所以由组件显式渲染 —— 少了它，`.bloom-pop` 的
 * CSS（opacity 0 → 1、rotate(-145deg) scale(.08) → rotate(18deg) scale(1)）
 * 就作用在一个不存在的元素上，「好想法，正在开花」只剩静态标签。
 *
 * 花朵形状复用品牌花 FlowerIcon（纯装饰，与「点赞」的爱心图标分开维护），
 * 颜色走语义类：花瓣 `fill-current` + `stroke-background`（设计稿的浅色缝隙），
 * 花心 `fill-warning`，高光 `fill-warning-soft`。
 *
 * 纯装饰：`aria-hidden` 由外层 span 声明，不进无障碍树，也不吃指针事件
 * （`.bloom-pop` 自带 `pointer-events: none`）。
 */
export function BloomPop({ className }: { className?: string }) {
  return (
    <span className={cn('bloom-pop', className)} aria-hidden>
      <FlowerIcon filled className="text-brand" />
    </span>
  )
}
