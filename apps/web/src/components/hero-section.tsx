import Link from 'next/link'
import { BloomPop } from '@/components/ui/bloom-pop'
import { BlurText } from '@/components/ui/blur-text'
import { BoomLandLogo } from '@/components/brand-logos'


/**
 * 首屏。
 *
 * 结构照搬设计稿的 banner：游乐园插画铺底，中央一根排版轴线 ——
 * 顶栏同款 BoomLand 字标 SVG + 右侧竖排「产品 / 生长之地」，
 * tagline 从字标左缘起排；两个操作按钮沉在首屏底部、落在「向下探索」上方。
 *
 * 三件事值得留意：
 * 1. 插画通过 CSS 变量 `--cover-art` 注入，而不是写死 background-image ——
 *    换皮肤时可以在皮肤文件里换掉整张插画，组件不需要改。
 * 2. 字标直接复用顶栏的 `BoomLandLogo`：同一枚 SVG、同一套 currentColor，
 *    首屏与导航栏的字形与品牌粉点缀因此永远一致，不再维护两份字形。
 * 3. 导航栏是实心吸顶的，首屏高度在 CSS 里扣掉了导航栏高度，
 *    折叠线才和设计稿落在同一条线上。
 *
 * 「好想法，正在开花」这枚浮标带 `.bloom-label`，必须挂一个 BloomPop ——
 * 设计稿靠页面脚本注入那朵小花，本站由组件显式渲染，否则悬停绽开的
 * 动效完全没有落点（只剩一枚静态标签）。
 */
export function HeroSection() {
  return (
    <section className="cover" aria-label="BoomLand 产品生长之地">
      <div className="cover__art" aria-hidden />
      <div className="cover__light" aria-hidden />

      <div className="cover__inner">
        <div className="cover__brand">
          <h1 className="cover__lockup" aria-label="BoomLand，产品生长之地">
            <span className="cover__logo">
              <BoomLandLogo className="h-auto w-full" />
            </span>
            <span className="cover__chinese" aria-hidden>
              <span>产品</span>
              <span>生长之地</span>
            </span>
          </h1>

          <BlurText
            /* 文案不写空格：banner 里每个字之间是等距的，字距由 CSS 的
             * letter-spacing 给（见 .cover__tagline），否则「·」与「AI」
             * 两侧会比字间空得多。 */
            text="新产品·新世界·早期AI产品社区"
            effect="blur"
            animateBy="letters"
            direction="top"
            staggerFrom="start"
            trigger="load"
            delay={40}
            stepDuration={0.45}
            blur={6}
            distance={16}
            className="cover__tagline"
          />
        </div>

        <div className="cover__actions">
          <Link href="#all-projects" className="ui-btn ui-btn--primary">
            探索产品{' '}
            <span className="ui-btn__arrow" aria-hidden>
              →
            </span>
          </Link>
          <Link href="/talents" className="ui-btn ui-btn--secondary">
            加入社区{' '}
            <span className="ui-btn__arrow" aria-hidden>
              ↗
            </span>
          </Link>
        </div>
      </div>

      <span className="cover__bloom-tag bloom-label" tabIndex={0}>
        <span className="flower" aria-hidden>
          ✿
        </span>{' '}
        好想法，正在开花
        <BloomPop />
      </span>

      <a className="cover__scroll" href="#all-projects">
        <span>向下探索 · 生长界面系统</span>
        <span className="cover__scroll-line" aria-hidden />
      </a>

      <span className="cover__index">BOOMLAND / V0.2</span>
    </section>
  )
}
