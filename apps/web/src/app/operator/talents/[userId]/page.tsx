import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AvailabilityBadge, OperatorTalentActions, SkillChip } from '@/components/talent/talent-ui'
import { orderSkillsByGroup } from '@/lib/talent'
import { getOperatorTalent, getTalentAudit } from '@/server/talent'

export const dynamic = 'force-dynamic'
export default async function OperatorTalentPage(props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params
  const [profile, audit] = await Promise.all([getOperatorTalent(userId), getTalentAudit(userId)])
  if (!profile.data) notFound()
  const data = profile.data
  return <section><Link href="/operator/talents" className="font-mono text-xs text-primary">← 人才档案</Link><div className="mt-8 border border-border bg-card p-6"><p className="eyebrow">USER / {data.userId}</p><h2 className="mt-3 text-3xl font-bold">{data.headline}</h2><div className="mt-3"><AvailabilityBadge availability={data.availability} /></div><p className="mt-5 whitespace-pre-wrap text-muted-foreground">{data.bio}</p><div className="mt-5"><p className="font-mono text-xs font-bold tracking-[0.12em] text-primary">我能提供</p><div className="mt-2 flex flex-wrap gap-2">{orderSkillsByGroup(data.skills).map((item) => <SkillChip key={item} skill={item} skillState="provide" />)}</div></div>{(data.seekingSkills ?? []).length > 0 && <div className="mt-4"><p className="font-mono text-xs font-bold tracking-[0.12em] text-secondary">我想寻找</p><div className="mt-2 flex flex-wrap gap-2">{orderSkillsByGroup(data.seekingSkills ?? []).map((item) => <SkillChip key={item} skill={item} skillState="seeking" />)}</div></div>}<OperatorTalentActions profile={data} /></div><h3 className="mt-10 text-xl font-bold">停用审计</h3><div className="mt-3 space-y-2">{(audit.data ?? []).map((record, index) => <pre key={index} className="overflow-auto border border-border bg-card p-3 text-xs text-muted-foreground">{JSON.stringify(record, null, 2)}</pre>)}</div></section>
}
