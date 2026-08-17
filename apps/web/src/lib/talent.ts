import {
  CATEGORIES,
  COLLABORATION_DURATIONS,
  TALENT_ROLES,
  TALENT_SKILLS,
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
export const CONNECTION_PURPOSES = [
  "共同创业",
  "加入项目",
  "短期协作",
  "专业咨询",
  "认识交流",
  "其他",
] as const;
export function connectionStatusLabel(status: number, sent: boolean) {
  if (sent && status === ConnectionRequestStatus.Ignored) return "暂未建立连接";
  if (sent && status === ConnectionRequestStatus.Cancelled)
    return "连接请求已结束";
  return CONNECTION_STATUS_LABELS[status] ?? "未知状态";
}

export type TalentBody = {
  headline: string;
  bio: string;
  city?: string;
  roles: string[];
  skills: string[];
  seekingSkills?: string[];
  domains: string[];
  durations: string[];
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
  roles: TALENT_ROLES,
  skills: TALENT_SKILLS,
  domains: CATEGORIES,
  durations: COLLABORATION_DURATIONS,
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
    role: value("role") || undefined,
    skills: value("skills") || undefined,
    duration: value("duration") || undefined,
    sort,
    page,
  };
}

export function validateTalentBody(body: TalentBody) {
  const errors: Record<string, string> = {};
  if (body.headline.trim().length < 2 || body.headline.trim().length > 30)
    errors.headline = "请输入 2-30 个字符";
  if (body.bio.trim().length < 30 || body.bio.trim().length > 500)
    errors.bio = "请输入 30-500 个字符";
  if (body.roles.length < 1 || body.roles.length > 3)
    errors.roles = "请选择 1-3 个方向";
  if (body.skills.length < 3 || body.skills.length > 10)
    errors.skills = "请选择 3-10 项技能";
  if (body.seekingSkills && body.seekingSkills.length > 5)
    errors.seekingSkills = "最多选择 5 项";
  if (body.domains.length < 1 || body.domains.length > 3)
    errors.domains = "请选择 1-3 个领域";
  if (body.durations.length < 1 || body.durations.length > 3)
    errors.durations = "请选择 1-3 种合作时长";
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
  if (body.message.trim().length < 30 || body.message.trim().length > 500)
    errors.message = "留言请输入 30-500 个字符";
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
  return (
    (body.headline === undefined || typeof body.headline === "string") &&
    (body.bio === undefined || typeof body.bio === "string") &&
    (body.city === undefined || typeof body.city === "string") &&
    (body.roles === undefined ||
      (Array.isArray(body.roles) &&
        body.roles.every((item) => typeof item === "string"))) &&
    (body.skills === undefined ||
      (Array.isArray(body.skills) &&
        body.skills.every((item) => typeof item === "string"))) &&
    (body.seekingSkills === undefined ||
      (Array.isArray(body.seekingSkills) &&
        body.seekingSkills.every((item) => typeof item === "string"))) &&
    (body.domains === undefined ||
      (Array.isArray(body.domains) &&
        body.domains.every((item) => typeof item === "string"))) &&
    (body.durations === undefined ||
      (Array.isArray(body.durations) &&
        body.durations.every((item) => typeof item === "string")))
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
    return isTalentBody(parsed) ? parsed : null;
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
