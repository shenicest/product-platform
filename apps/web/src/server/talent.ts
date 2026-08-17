import { cache } from "react";
import { cookies } from "next/headers";
import { ProjectStatus } from "@shenicest/shared";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import type {
  ConnectionParty,
  TalentConnection,
  TalentManagement,
  TalentProfile,
  TalentProject,
} from "@/lib/talent";

function publicConnectionParty(party: ConnectionParty): ConnectionParty {
  return {
    userId: party.userId,
    identity: party.identity,
    hasPublishedTalentProfile: party.hasPublishedTalentProfile,
    talentProfile:
      party.hasPublishedTalentProfile && party.talentProfile
        ? party.talentProfile
        : null,
  };
}

async function serverRequest<T>(
  path: string,
): Promise<{ data: T | null; status: number }> {
  const token = (await cookies()).get("shenicest_token")?.value;
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { cookie: `shenicest_token=${token}` } : {},
    cache: "no-store",
  });
  return {
    data: response.ok ? ((await response.json()) as T) : null,
    status: response.status,
  };
}
export const getTalents = cache((query: string) =>
  serverRequest<{ data: TalentProfile[]; total: number }>(
    `/talents${query ? `?${query}` : ""}`,
  ),
);
export const getTalent = cache((userId: string) =>
  serverRequest<TalentProfile>(`/talents/${encodeURIComponent(userId)}`),
);
export const getMyTalent = cache(() =>
  serverRequest<TalentManagement>("/talents/me"),
);
export const getConnections = cache(async () => {
  const result = await serverRequest<{
    data: TalentConnection[];
    total: number;
    pendingReceived: number;
  }>("/talents/connections");
  if (!result.data) return result;
  return {
    ...result,
    data: {
      ...result.data,
      data: result.data.data.map((connection) => ({
        ...connection,
        sender: publicConnectionParty(connection.sender),
        receiver: publicConnectionParty(connection.receiver),
      })),
    },
  };
});
export const getOperatorTalents = cache((query: string) =>
  serverRequest<TalentManagement[]>(
    `/operator/talents${query ? `?${query}` : ""}`,
  ),
);
export const getOperatorTalent = cache((userId: string) =>
  serverRequest<TalentManagement>(
    `/operator/talents/${encodeURIComponent(userId)}`,
  ),
);
export const getTalentAudit = cache((userId: string) =>
  serverRequest<Array<Record<string, unknown>>>(
    `/operator/talents/${encodeURIComponent(userId)}/suspension-audit`,
  ),
);

export const getConnectionProjectOptions = cache(
  async (): Promise<TalentProject[]> => {
    const token = (await cookies()).get("shenicest_token")?.value;
    if (!token) return [];

    const { data, error } = await api.founder.projects.get({
      query: { status: ProjectStatus.Live, limit: 100 },
      headers: { cookie: `shenicest_token=${token}` },
    });
    if (error?.status === 401 || error?.status === 403) return [];
    if (error || !data)
      throw new Error("Failed to load connection project options");

    return data.data.map(({ id, name, tagline }) => ({ id, name, tagline }));
  },
);
