import type { Metadata } from 'next'
import { NO_INDEX_ROBOTS } from '@/lib/site-metadata'

/**
 * 作者后台的公共元数据。
 *
 * 三个 founder 页面各自有自己的标题，但都不应该被收录、也不该被分享成卡片，
 * 所以 `robots` 放在这一层统一声明（页面级元数据不覆盖它就不会丢）。
 */
export const metadata: Metadata = {
  title: '创始人后台',
  robots: NO_INDEX_ROBOTS,
}

export default function FounderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
