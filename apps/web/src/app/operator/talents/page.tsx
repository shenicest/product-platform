import Link from 'next/link'
import { TalentProfileStatus } from '@shenicest/shared'
import { getOperatorTalents } from '@/server/talent'

export const dynamic = 'force-dynamic'
export default async function OperatorTalentsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await props.searchParams
  const q = typeof search.q === 'string' ? search.q : ''
  const status = typeof search.status === 'string' ? search.status : ''
  const page = Math.max(1, Number(search.page) || 1)
  const query = new URLSearchParams({ offset: String((page - 1) * 20), limit: '20' })
  if (q) query.set('q', q)
  if (status) query.set('status', status)
  const result = await getOperatorTalents(query.toString())
  return <section><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">TALENT MODERATION</p><h2 className="mt-2 text-3xl font-bold">人才档案</h2></div><form className="flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="用户 ID 或标题" className="h-11 border border-input bg-card px-3" /><select name="status" defaultValue={status} className="h-11 border border-input bg-card px-3"><option value="">全部状态</option><option value={TalentProfileStatus.Published}>已发布</option><option value={TalentProfileStatus.Paused}>已暂停</option><option value={TalentProfileStatus.Suspended}>已停用</option></select><button className="btn-hard btn-primary py-2">搜索</button></form></div><div className="mt-8 space-y-3">{(result.data ?? []).map((profile) => <Link key={profile.userId} href={`/operator/talents/${profile.userId}`} className="flex flex-col justify-between gap-2 border border-border bg-card p-4 hover:border-primary sm:flex-row"><div><b>{profile.headline}</b><p className="mt-1 font-mono text-xs text-muted-foreground">USER #{profile.userId}</p></div><span className="chip-hard">{profile.status === 0 ? '已发布' : profile.status === 1 ? '已暂停' : '已停用'}</span></Link>)}</div><div className="mt-8 flex gap-3">{page > 1 && <Link className="btn-hard btn-ghost" href={`/operator/talents?${new URLSearchParams({ q, status, page: String(page - 1) })}`}>上一页</Link>}{result.data?.length === 20 && <Link className="btn-hard btn-ghost" href={`/operator/talents?${new URLSearchParams({ q, status, page: String(page + 1) })}`}>下一页</Link>}</div></section>
}
