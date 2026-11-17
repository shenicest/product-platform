import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TalentDetail } from '@/components/talent/talent-ui'
import { NO_INDEX_ROBOTS, pageMetadata } from '@/lib/site-metadata'
import { getConnectionProjectOptions, getTalent } from '@/server/talent'

export const dynamic = 'force-dynamic'

/** 分享卡片：昵称（没有则用 headline）作为标题，headline + 简介作为描述。 */
export async function generateMetadata(props: {
  params: Promise<{ userId: string }>
}): Promise<Metadata> {
  const { userId } = await props.params
  const result = await getTalent(userId).catch(() => null)
  const profile = result?.data
  if (!profile) return { title: '人才档案不可用', robots: NO_INDEX_ROBOTS }

  const nickname = profile.founder?.nickname?.trim()
  return pageMetadata({
    title: nickname || profile.headline,
    description: [profile.headline, profile.bio].filter(Boolean).join('｜'),
    path: `/talents/${encodeURIComponent(profile.userId)}`,
  })
}

export default async function TalentPage(props: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await props.params;
  const [result, projectOptions] = await Promise.all([
    getTalent(userId),
    getConnectionProjectOptions(),
  ]);
  if (!result.data) {
    if (result.status === 404) notFound();
    throw new Error(`Failed to load talent profile (${result.status})`);
  }
  return <TalentDetail profile={result.data} projectOptions={projectOptions} />;
}
