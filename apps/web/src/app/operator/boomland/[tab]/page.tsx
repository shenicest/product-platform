import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { platformTab } from '@/lib/platform-console'
import { PlatformTabPlaceholder } from '@/components/operator/platform/tab-placeholder'

/**
 * 平台后台里「还没接入数据」的 tab（积分池总览、评委授权、评分流水与冲正、
 * 全局权限、异议、审计）。
 *
 * 用一个动态段承接，而不是复制六个只有标题不同的 `page.tsx`：
 * 这些页面当前的内容完全由 `PLATFORM_TABS` 的静态定义驱动，六个文件只会
 * 让「加一个 tab」变成改七处。已经实现的 tab（`seasons` / `orgs`）是静态路由，
 * 按 Next 的优先级会先于这个动态段命中。
 *
 * 未知 slug（拼错、或未来删掉的 tab）一律 404，不渲染一个误导性的占位。
 */
export async function generateMetadata(
  props: PageProps<'/operator/boomland/[tab]'>,
): Promise<Metadata> {
  const { tab: slug } = await props.params
  const tab = platformTab(slug)
  if (!tab || tab.implemented) return { title: '平台后台' }
  return { title: `${tab.label} · 平台后台` }
}

export default async function PlatformTabPlaceholderPage(
  props: PageProps<'/operator/boomland/[tab]'>,
) {
  const { tab: slug } = await props.params
  const tab = platformTab(slug)
  if (!tab || tab.implemented) notFound()

  return <PlatformTabPlaceholder tab={tab.slug} title={tab.label} scope={tab.scope} />
}
