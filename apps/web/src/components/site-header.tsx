import Link from 'next/link'
import { UserMenu } from '@/components/user-menu'
import { SheNicestLogo } from '@/components/brand-logos'

const NAV = [
  { href: '/', label: '产品共生' },
  { href: '/talents', label: '共鸣之地' },
  { href: '/hackathon', label: '黑客松' },
  { href: '/following', label: '我的关注' },
]

/**
 * 站点头部：左侧 SheNicest 品牌标、中间主导航、右侧操作区。
 *
 * 左侧**只保留 SheNicest 字标** —— BoomLand 是产品线的视觉语言（颜色、
 * 花朵、像素天空），不是公司品牌，所以不占导航栏的品牌位。BoomLand 的
 * 识别由首屏巨型字标承担，那里才是它的位置。
 *
 * 布局全部用 Tailwind 工具类，没有新增 `.site-header__*` 类 ——
 * `patterns.css` 里的 `.site-header__row` 只提供 >=900px 的三栏骨架
 * （`auto minmax(0,1fr) auto`），窄屏下由这里的 flex 布局接管：
 *
 * - <900px：一行放不下「品牌标 + 四个导航项 + 两个按钮」，所以换成两行 ——
 *   第一行左标右按钮，第二行导航整宽（`.site-nav` 自带 overflow-x: auto，
 *   极窄屏时横向滚动，而不是把页面撑出横向滚动条）。
 * - >=900px：恢复 CSS 里的三栏 grid，导航回到中间。
 *
 * 断点用 `min-[900px]:` 而不是 `lg:`（1024px），是为了和
 * patterns.css 里那条 `@media (min-width: 900px)` 严格对齐，
 * 避免 900–1023px 区间出现「grid 列模板已生效但 display 还是 flex」的错位。
 *
 * logo 的颜色来自 currentColor + 语义类（text-foreground / text-brand），
 * 所以 night 皮肤的深底上不会出现「黑字消失」。
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__row flex flex-wrap items-center gap-x-4 gap-y-2 min-[900px]:grid">
        <Link
          href="/"
          aria-label="SheNicest 首页"
          className="flex min-w-0 items-center gap-2 sm:gap-3"
        >
          <SheNicestLogo className="h-4 shrink-0 text-foreground sm:h-5" />
        </Link>

        <nav
          className="site-nav order-last w-full min-[900px]:order-none min-[900px]:w-auto"
          aria-label="主导航"
        >
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/submit" className="ui-btn ui-btn--primary ui-btn--small">
            <span aria-hidden>＋</span> 提交产品
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
