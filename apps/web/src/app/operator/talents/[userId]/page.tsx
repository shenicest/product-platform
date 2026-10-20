import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OperatorTalentActions } from '@/components/talent/talent-ui'
import { getOperatorTalent, getTalentAudit } from '@/server/talent'
import { Chip } from '@/components/ui/chip'
import { Card } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'

export const dynamic = 'force-dynamic'

export default async function OperatorTalentPage(props: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await props.params
  const [profile, audit] = await Promise.all([getOperatorTalent(userId), getTalentAudit(userId)])
  if (!profile.data) notFound()

  return (
    <section>
      <Link href="/operator/talents" className="mono text-brand-text hover:text-brand">
        ← 人才档案
      </Link>

      <Card static className="mt-8 p-6">
        <Eyebrow>USER / {profile.data.userId}</Eyebrow>
        <h2 className="mt-3 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
          {profile.data.headline}
        </h2>
        <p className="mt-5 whitespace-pre-wrap text-muted-foreground">{profile.data.bio}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {profile.data.skills.map((item) => (
            <Chip key={item}>{item}</Chip>
          ))}
        </div>
        <OperatorTalentActions profile={profile.data} />
      </Card>

      <h3 className="mt-10 text-h3 font-bold">停用审计</h3>
      <div className="mt-3 flex flex-col gap-2">
        {(audit.data ?? []).map((record, index) => (
          <pre
            key={index}
            className="overflow-auto rounded-md border border-border bg-card p-3 font-mono text-meta text-muted-foreground"
          >
            {JSON.stringify(record, null, 2)}
          </pre>
        ))}
      </div>
    </section>
  )
}
