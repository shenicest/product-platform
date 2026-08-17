import { notFound } from "next/navigation";
import { TalentDetail } from "@/components/talent/talent-ui";
import { getConnectionProjectOptions, getTalent } from "@/server/talent";

export const dynamic = "force-dynamic";
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
