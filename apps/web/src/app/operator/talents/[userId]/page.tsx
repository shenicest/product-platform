import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AvailabilityBadge, OperatorTalentActions, SkillChip } from '@/components/talent/talent-ui'
import { orderSkillsByGroup } from '@/lib/talent'
import { getOperatorTalent, getTalentAudit } from '@/server/talent'
import { Card } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'

export const dynamic = 'force-dynamic'

export default async function OperatorTalentPage(props: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await props.params
  const [profile, audit] = await Promise.all([getOperatorTalent(userId), getTalentAudit(userId)])
  if (!profile.data) notFound()
  const data = profile.data

  return (
    <section>
      <Link href="/operator/talents" className="mono text-brand-text hover:text-brand">
        ← 人才档案
      </Link>

      <Card static className="mt-8 p-6">
        <Eyebrow>USER / {data.userId}</Eyebrow>
        <h2 className="mt-3 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
          {data.headline}
        </h2>
        <div className="mt-3">
          <AvailabilityBadge availability={data.availability} />
        </div>
        <p className="mt-5 whitespace-pre-wrap text-muted-foreground">{data.bio}</p>
        <div className="mt-5">
          <p className="font-mono text-meta font-bold tracking-[0.12em] text-brand-text">
            我能提供
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {orderSkillsByGroup(data.skills).map((item) => (
              <SkillChip key={item} skill={item} skillState="provide" />
            ))}
          </div>
        </div>
        {(data.seekingSkills ?? []).length > 0 && (
          <div className="mt-4">
            <p className="font-mono text-meta font-bold tracking-[0.12em] text-sky-text">
              我想寻找
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {orderSkillsByGroup(data.seekingSkills ?? []).map((item) => (
                <SkillChip key={item} skill={item} skillState="seeking" />
              ))}
            </div>
          </div>
        )}
        <OperatorTalentActions profile={data} />
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
