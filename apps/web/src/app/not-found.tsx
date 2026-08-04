import { NotFoundShell } from '@/components/not-found-shell'

export default function NotFound() {
  return (
    <NotFoundShell
      title="页面未找到"
      description="你访问的页面不存在，或者已经被移除。"
      href="/"
      linkLabel="返回首页"
    />
  )
}
