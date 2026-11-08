import { redirect } from 'next/navigation'
import { DEFAULT_WORKBENCH_TAB } from '@/lib/me'

/**
 * `/me` 本身没有内容：个人中心的第一屏是「报名」。
 *
 * 用 redirect 而不是把 `/me` 做成一个 tab 列表页 —— 这样地址栏始终指向
 * 具体某一屏，刷新、分享、从菜单点进来都落在同一个地方。
 */
export default function MeIndexPage() {
  redirect(`/me/${DEFAULT_WORKBENCH_TAB.slug}`)
}
