import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OperatorTalentActions } from '@/components/talent/talent-ui'
import { getOperatorTalent, getTalentAudit } from '@/server/talent'

export const dynamic = 'force-dynamic'
export default async function OperatorTalentPage(props: { params: Promise<{ userId: string }> }) {
  const { userId } = await props.params
  const [profile, audit] = await Promise.all([getOperatorTalent(userId), getTalentAudit(userId)])
  if (!profile.data) notFound()
  return <section><Link href="/operator/talents" className="font-mono text-xs text-primary">← 人才档案</Link><div className="mt-8 border border-border bg-card p-6"><p className="eyebrow">USER / {profile.data.userId}</p><h2 className="mt-3 text-3xl font-bold">{profile.data.headline}</h2><p className="mt-5 whitespace-pre-wrap text-muted-foreground">{profile.data.bio}</p><div className="mt-5 flex flex-wrap gap-2">{profile.data.skills.map((item) => <span className="chip-hard" key={item}>{item}</span>)}</div><OperatorTalentActions profile={profile.data} /></div><h3 className="mt-10 text-xl font-bold">停用审计</h3><div className="mt-3 space-y-2">{(audit.data ?? []).map((record, index) => <pre key={index} className="overflow-auto border border-border bg-card p-3 text-xs text-muted-foreground">{JSON.stringify(record, null, 2)}</pre>)}</div></section>
}
