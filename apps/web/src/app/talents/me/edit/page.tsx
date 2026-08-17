import { redirect } from "next/navigation";
import { TalentEditor } from "@/components/talent/talent-ui";
import { getSessionUser } from "@/server/auth";
import { getMyTalent } from "@/server/talent";

export const dynamic = "force-dynamic";
export default async function EditTalentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?returnTo=/talents/me/edit");
  const profile = await getMyTalent();
  if (profile.status !== 200 && profile.status !== 404)
    throw new Error("Failed to load talent profile");
  return <TalentEditor initial={profile.data} userId={user.userId} />;
}
