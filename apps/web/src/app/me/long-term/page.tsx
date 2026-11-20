import { redirect } from 'next/navigation'
import { LongTermWorks } from '@/components/me/long-term-works'
import { workbenchTabBySlug } from '@/lib/me'
import { getWorkbenchHeader } from '@/server/me'

export const metadata = {
  title: workbenchTabBySlug('long-term')?.label ?? '长期作品',
}

export const dynamic = 'force-dynamic'

/**
 * 长期作品的入口对所有登录用户开放：普通用户、赛季选手、评委、企业都可能
 * 是某个长期项目的发起人或长期成员。真正的写权限按项目归属判断（演示数据
 * 里由 `LongTermWorks` 过滤我的项目）。
 */
export default async function Page() {
  const header = await getWorkbenchHeader()
  if (!header) redirect(`/login?returnTo=${encodeURIComponent('/me/long-term')}`)

  return (
    <LongTermWorks
      userId={header.userId}
      nickname={header.nickname}
    />
  )
}
