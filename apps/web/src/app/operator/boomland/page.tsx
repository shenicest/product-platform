import { redirect } from 'next/navigation'

/**
 * `/operator/boomland` 没有自己的内容：平台后台的第一屏是「赛季治理」。
 * 用重定向而不是把 tab 内容复制一份到根路径 —— 复制会让根路径和 tab 路径
 * 变成两个入口，深链、面包屑和「当前 tab」都要各判一次。
 */
export default function PlatformConsoleIndexPage() {
  redirect('/operator/boomland/seasons')
}
