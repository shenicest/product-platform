import { cache } from "react";
import { cookies } from "next/headers";
import { ProjectStatus } from "@shenicest/shared";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { DEMO_MODE, DEMO_TALENT_PROFILE } from "@/lib/demo-mode";
import type {
  ConnectionParty,
  TalentConnection,
  TalentManagement,
  TalentProfile,
  TalentProject,
} from "@/lib/talent";

function normalizeTalentProfile(profile: TalentProfile): TalentProfile {
  // 线上旧版 API 还没有 seasonBadges 字段；补成空数组，避免前端读 .length 崩。
  return { ...profile, seasonBadges: profile.seasonBadges ?? [] };
}

function publicConnectionParty(party: ConnectionParty): ConnectionParty {
  return {
    userId: party.userId,
    identity: party.identity,
    hasPublishedTalentProfile: party.hasPublishedTalentProfile,
    talentProfile:
      party.hasPublishedTalentProfile && party.talentProfile
        ? normalizeTalentProfile(party.talentProfile)
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
export const getTalents = cache(async (query: string) => {
  const result = await serverRequest<{ data: TalentProfile[]; total: number }>(
    `/talents${query ? `?${query}` : ""}`,
  );
  if (!result.data) {
    return DEMO_MODE
      ? { data: { data: [DEMO_TALENT_PROFILE], total: 1 }, status: 200 }
      : result;
  }
  const data = result.data.data
    .filter((profile) => profile.userId !== DEMO_TALENT_PROFILE.userId)
    .map(normalizeTalentProfile);
  const merged = DEMO_MODE ? [DEMO_TALENT_PROFILE, ...data] : data;
  return {
    ...result,
    data: {
      ...result.data,
      data: merged,
      total: DEMO_MODE ? result.data.total + 1 : result.data.total,
    },
  };
});
export const getTalent = cache(async (userId: string) => {
  if (DEMO_MODE && userId === DEMO_TALENT_PROFILE.userId) {
    return { data: DEMO_TALENT_PROFILE, status: 200 };
  }
  const result = await serverRequest<TalentProfile>(`/talents/${encodeURIComponent(userId)}`);
  return result.data ? { ...result, data: normalizeTalentProfile(result.data) } : result;
});
export const getMyTalent = cache(() =>
  serverRequest<TalentManagement>("/talents/me"),
);
export const getTalentConnections = cache(async () => {
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
