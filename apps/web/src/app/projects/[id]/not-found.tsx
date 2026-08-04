import { NotFoundShell } from '@/components/not-found-shell'

export default function ProjectNotFound() {
  return (
    <NotFoundShell
      title="该项目暂不可用"
      description="项目可能尚未通过审核、已被下架，或者不存在。你可以回到列表浏览其他正在展示的项目。"
      href="/"
      linkLabel="返回项目列表"
    />
  )
}
