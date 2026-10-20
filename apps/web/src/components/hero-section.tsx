import Link from 'next/link'
import { BloomPop } from '@/components/ui/bloom-pop'
import { BlurText } from '@/components/ui/blur-text'


/**
 * 首屏。
 *
 * 结构照搬设计稿的 `cover-hero`：像素天空 + 山体花朵插画做背景，
 * 中央一根排版轴线（BoomLand 巨型字标 → 中文副标 → tagline → 操作），
 * 再挂三个浮件：绽放标签、向下探索、右下角的版本号。
 *
 * 三件事值得留意：
 * 1. 插画通过 CSS 变量 `--cover-art` 注入，而不是写死 background-image ——
 *    换皮肤时可以在皮肤文件里换掉整张插画，组件不需要改。
 * 2. 巨型字标拆成两个 `<span>`（Boom / Land），由 CSS 横向拉宽；
 *    字体在 CSS 里钉死为 Arial Black，不用 `--font-display`（字形差异明显）。
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
        <h1 className="cover__title" aria-label="BoomLand，产品生长之地">
          <span className="cover__word" aria-hidden>
            <span>Boom</span>
            <span>Land</span>
          </span>
          <span className="cover__chinese">产品生长之地</span>
        </h1>

        <BlurText
          text="新产品 · 新世界 · 早期 AI 产品社区"
          effect="blur"
          animateBy="words"
          direction="top"
          staggerFrom="start"
          trigger="load"
          delay={110}
          stepDuration={0.5}
          blur={8}
          distance={24}
          className="cover__tagline"
        />
        {/* <p className="cover__description">让好想法被发现，让创造自然生长。</p> */}

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
