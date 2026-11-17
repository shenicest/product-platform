import Link from 'next/link'
import { TalentProfileStatus } from '@shenicest/shared'
import { getOperatorTalents } from '@/server/talent'
import { Card, EmptyState } from '@/components/ui/surface'
import { Chip, type ChipTone } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'

export const dynamic = 'force-dynamic'

/** 人才档案状态 → 标签色调（只映射语义，不写颜色）。 */
const STATUS_TONES: Record<number, ChipTone> = {
  [TalentProfileStatus.Published]: 'success',
  [TalentProfileStatus.Paused]: 'warning',
  [TalentProfileStatus.Suspended]: 'danger',
}

const STATUS_LABELS: Record<number, string> = {
  [TalentProfileStatus.Published]: '已发布',
  [TalentProfileStatus.Paused]: '已暂停',
  [TalentProfileStatus.Suspended]: '已停用',
}

export default async function OperatorTalentsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const search = await props.searchParams
  const q = typeof search.q === 'string' ? search.q : ''
  const status = typeof search.status === 'string' ? search.status : ''
  const page = Math.max(1, Number(search.page) || 1)
  const query = new URLSearchParams({ offset: String((page - 1) * 20), limit: '20' })
  if (q) query.set('q', q)
  if (status) query.set('status', status)
  const result = await getOperatorTalents(query.toString())

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>TALENT MODERATION</Eyebrow>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
            人才档案
          </h2>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <div className="sm:w-56">
            <input
              name="q"
              defaultValue={q}
              placeholder="用户 ID 或标题"
              aria-label="用户 ID 或标题"
              className="ui-input"
            />
          </div>
          <div className="sm:w-40">
            <select name="status" defaultValue={status} aria-label="档案状态" className="ui-select">
              <option value="">全部状态</option>
              <option value={TalentProfileStatus.Published}>已发布</option>
              <option value={TalentProfileStatus.Paused}>已暂停</option>
              <option value={TalentProfileStatus.Suspended}>已停用</option>
            </select>
          </div>
          <button type="submit" className="ui-btn ui-btn--primary ui-btn--small">
            搜索
          </button>
        </form>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {(result.data ?? []).length === 0 ? (
          <EmptyState title="NO TALENTS" description="暂无人才档案" />
        ) : (
          (result.data ?? []).map((profile) => (
            <Card key={profile.userId} className="group">
              <Link
                href={`/operator/talents/${profile.userId}`}
                className="flex flex-col justify-between gap-2 p-4 outline-none sm:flex-row sm:items-center"
              >
                <div>
                  <b className="text-body-lg transition-colors group-hover:text-brand-text">
                    {profile.headline}
                  </b>
                  <p className="mono mt-1">USER #{profile.userId}</p>
                </div>
                <Chip tone={STATUS_TONES[profile.status] ?? 'neutral'} dot>
                  {STATUS_LABELS[profile.status] ?? '未知'}
                </Chip>
              </Link>
            </Card>
          ))
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {page > 1 ? (
          <Link
            className="ui-btn ui-btn--ghost ui-btn--small"
            href={`/operator/talents?${new URLSearchParams({ q, status, page: String(page - 1) })}`}
          >
            上一页
          </Link>
        ) : null}
        {result.data?.length === 20 ? (
          <Link
            className="ui-btn ui-btn--ghost ui-btn--small"
            href={`/operator/talents?${new URLSearchParams({ q, status, page: String(page + 1) })}`}
          >
            下一页
          </Link>
        ) : null}
      </div>
    </section>
  )
}
