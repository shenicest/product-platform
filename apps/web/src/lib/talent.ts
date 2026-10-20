import {
  CATEGORIES,
  COLLABORATION_DURATIONS,
  CONNECTION_PURPOSES,
  TALENT_AVAILABILITY_LABELS,
  TALENT_SKILL_GROUPS,
  TALENT_SKILLS,
  MAX_SEEKING_SKILLS,
  MAX_TALENT_SKILLS,
  TalentProfileStatus,
  ConnectionRequestStatus,
} from "@shenicest/shared";

export const TALENT_PAGE_SIZE = 20;
export const TALENT_STATUS_LABELS: Record<number, string> = {
  [TalentProfileStatus.Published]: "已发布",
  [TalentProfileStatus.Paused]: "已暂停",
  [TalentProfileStatus.Suspended]: "已停用",
};
export const CONNECTION_STATUS_LABELS: Record<number, string> = {
  [ConnectionRequestStatus.Pending]: "待处理",
  [ConnectionRequestStatus.Accepted]: "已接受",
  [ConnectionRequestStatus.Ignored]: "已忽略",
  [ConnectionRequestStatus.Cancelled]: "已取消",
};
export function connectionStatusLabel(status: number, sent: boolean) {
  if (sent && status === ConnectionRequestStatus.Ignored) return "暂未建立连接";
  if (sent && status === ConnectionRequestStatus.Cancelled)
    return "连接请求已结束";
  return CONNECTION_STATUS_LABELS[status] ?? "未知状态";
}

export type TalentBody = {
  headline: string;
  bio?: string;
  links: string[];
  city?: string;
  skills: string[];
  seekingSkills?: string[];
  domains: string[];
  durations: string[];
  availability: number;
};
export type TalentIdentity = {
  nickname?: string | null;
  avatar_url?: string | null;
} | null;
export type TalentProject = {
  id: number;
  name: string;
  tagline: string | null;
};
export type TalentProfile = TalentBody & {
  id: number;
  userId: string;
  status: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  founder: TalentIdentity;
  projects: TalentProject[];
  match?: { score: number; reasons: string[] };
};
export type TalentManagement = TalentBody & {
  id: number;
  userId: string;
  status: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  suspensionAudit: Array<Record<string, unknown>>;
};
export type ConnectionParty = {
  userId: string;
  identity: TalentIdentity;
  hasPublishedTalentProfile: boolean;
  talentProfile: TalentProfile | null;
};
export type TalentConnection = {
  id: number;
  senderUserId: string;
  receiverUserId: string;
  projectId: number | null;
  purpose: string;
  message: string;
  status: number;
  sender: ConnectionParty;
  receiver: ConnectionParty;
  project: TalentProject | { unavailable: true; id: number } | null;
  contacts?: {
    mine: { wechat: string | null; email: string | null };
    other: { wechat: string | null; email: string | null };
  };
  createdAt: string;
  acceptedAt: string | null;
  handledAt: string | null;
};

export const talentCatalog = {
  skills: TALENT_SKILLS,
  domains: CATEGORIES,
  durations: COLLABORATION_DURATIONS,
  availabilityLabels: TALENT_AVAILABILITY_LABELS,
} as const;

export function parseTalentParams(
  params: Record<string, string | string[] | undefined>,
) {
  const value = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, Number(value("page")) || 1);
  const sort = value("sort") === "active" ? "active" : "new";
  return {
    q: value("q")?.trim() || undefined,
    skills: value("skills") || undefined,
    duration: value("duration") || undefined,
    sort,
    page,
  };
}

// Sort wall values by the skill-wall group order (ADR-0013); skills outside
// the wall vocabulary keep their original order at the end.
export function orderSkillsByGroup(skills: string[]): string[] {
  const rank = new Map<string, number>();
  TALENT_SKILL_GROUPS.forEach((group) =>
    group.skills.forEach((skill) => {
      if (!rank.has(skill)) rank.set(skill, rank.size);
    }),
  );
  return skills
    .map((skill, index) => ({ skill, index, rank: rank.get(skill) }))
    .sort(
      (a, b) =>
        (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
    .map((entry) => entry.skill);
}

export function isValidHttpUrl(value: string) {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function talentRequirementChecks(body: TalentBody) {
  const bio = body.bio?.trim() || "";
  const workLinks = body.links.map((link) => link.trim()).filter(Boolean);
  const headline = body.headline.trim();
  return [
    headline.length >= 4 && headline.length <= 50,
    (bio.length >= 30 && bio.length <= 500) ||
      workLinks.some((link) => isValidHttpUrl(link)),
    body.skills.length >= 3 && body.skills.length <= MAX_TALENT_SKILLS,
    body.domains.length >= 1 && body.domains.length <= 3,
    body.durations.length >= 1 && body.durations.length <= 3,
    body.availability in TALENT_AVAILABILITY_LABELS,
  ];
}

export function validateTalentBody(body: TalentBody) {
  const errors: Record<string, string> = {};
  const bio = body.bio?.trim() || "";
  const links = body.links.map((link) => link.trim()).filter(Boolean);
  if (body.headline.trim().length < 4 || body.headline.trim().length > 50)
    errors.headline = "请输入 4-50 个字符";
  if (bio && (bio.length < 30 || bio.length > 500))
    errors.bio = "关于我请输入 30-500 个字符";
  if (links.length > 3) errors.links = "最多添加 3 个链接";
  else if (links.length > 0 && links.some((link) => !isValidHttpUrl(link)))
    errors.links = "链接必须是正确的 http(s) 地址";
  if (!bio && links.length === 0)
    errors.bioOrLinks = "关于我和作品链接至少填写其一";
  if (
    body.skills.length < 3 ||
    body.skills.length > MAX_TALENT_SKILLS
  )
    errors.skills = "请选择 3-10 项技能";
  if (body.seekingSkills && body.seekingSkills.length > MAX_SEEKING_SKILLS)
    errors.seekingSkills = "最多选择 5 项";
  if (
    body.seekingSkills &&
    body.seekingSkills.some((skill) => body.skills.includes(skill))
  )
    errors.seekingSkills = "同一技能不能同时处于两个状态";
  if (body.domains.length < 1 || body.domains.length > 3)
    errors.domains = "请选择 1-3 个领域";
  if (body.durations.length < 1 || body.durations.length > 3)
    errors.durations = "请选择 1-3 种合作时长";
  if (
    !(body.availability in TALENT_AVAILABILITY_LABELS)
  )
    errors.availability = "请选择当前状态";
  return errors;
}

export function validateConnectionBody(body: {
  purpose: string;
  message: string;
  wechat?: string;
  email?: string;
}) {
  const errors: Record<string, string> = {};
  if (
    !CONNECTION_PURPOSES.includes(
      body.purpose as (typeof CONNECTION_PURPOSES)[number],
    )
  )
    errors.purpose = "请选择交流方向";
  if (body.message.trim().length < 10 || body.message.trim().length > 500)
    errors.message = "留言请输入 10-500 个字符";
  if (!body.wechat?.trim() && !body.email?.trim())
    errors.contact = "至少提供微信或邮箱";
  return errors;
}

const DRAFT_KEY_PREFIX = "shenicest_talent_profile_draft";
export function talentDraftKey(userId: string) {
  return `${DRAFT_KEY_PREFIX}:${userId}`;
}
function isTalentBody(value: unknown): value is Partial<TalentBody> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const stringArray = (item: unknown) =>
    item === undefined ||
    (Array.isArray(item) && item.every((entry) => typeof entry === "string"));
  return (
    (body.headline === undefined || typeof body.headline === "string") &&
    (body.bio === undefined || typeof body.bio === "string") &&
    (body.city === undefined || typeof body.city === "string") &&
    (body.links === undefined ||
      (Array.isArray(body.links) &&
        body.links.every((item) => typeof item === "string"))) &&
    stringArray(body.skills) &&
    stringArray(body.seekingSkills) &&
    stringArray(body.domains) &&
    stringArray(body.durations) &&
    (body.availability === undefined || typeof body.availability === "number")
  );
}
export function loadTalentDraft(
  userId: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): Partial<TalentBody> | null {
  try {
    const raw = storage.getItem(talentDraftKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isTalentBody(parsed)) return null;
    // Drop stale keys (e.g. v1 drafts still carrying `roles`) so they never
    // leak back into the submit payload.
    const draft = parsed as Record<string, unknown>;
    const fields: Array<keyof TalentBody> = [
      "headline",
      "bio",
      "city",
      "links",
      "skills",
      "seekingSkills",
      "domains",
      "durations",
      "availability",
    ];
    const picked: Partial<TalentBody> = {};
    for (const field of fields) {
      if (draft[field] !== undefined) {
        (picked as Record<string, unknown>)[field] = draft[field];
      }
    }
    return picked;
  } catch {
    return null;
  }
}
export function saveTalentDraft(
  userId: string,
  body: Partial<TalentBody>,
  storage: Pick<Storage, "setItem"> = window.localStorage,
) {
  storage.setItem(talentDraftKey(userId), JSON.stringify(body));
}
export function clearTalentDraft(
  userId: string,
  storage: Pick<Storage, "removeItem"> = window.localStorage,
) {
  storage.removeItem(talentDraftKey(userId));
}
