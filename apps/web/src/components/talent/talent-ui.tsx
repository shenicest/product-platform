"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CATEGORIES,
  COLLABORATION_DURATIONS,
  CONNECTION_PURPOSES,
  TALENT_ROLES,
  TALENT_SKILLS,
  ConnectionRequestStatus,
  TalentProfileStatus,
} from "@shenicest/shared";
import { useAuth } from "@/components/auth-provider";
import {
  acceptTalentConnection,
  getConnections,
  ignoreTalentConnection,
  pauseTalent,
  saveTalent,
  sendTalentConnection,
  suspendTalent,
} from "@/lib/client-api";
import {
  clearTalentDraft,
  loadTalentDraft,
  saveTalentDraft,
  validateTalentBody,
  validateConnectionBody,
  connectionStatusLabel,
  type TalentBody,
  type TalentConnection,
  type TalentManagement,
  type TalentProfile,
  type TalentProject,
} from "@/lib/talent";

const empty: TalentBody = {
  headline: "",
  bio: "",
  city: "",
  roles: [],
  skills: [],
  seekingSkills: [],
  domains: [],
  durations: [],
};
const TALENT_SKILL_GROUPS = [
  { direction: "产品", skills: TALENT_SKILLS.slice(0, 6) },
  { direction: "设计", skills: TALENT_SKILLS.slice(6, 12) },
  { direction: "开发", skills: TALENT_SKILLS.slice(12, 20) },
  { direction: "增长/内容", skills: TALENT_SKILLS.slice(20, 26) },
  { direction: "运营", skills: TALENT_SKILLS.slice(26, 31) },
  { direction: "数据", skills: TALENT_SKILLS.slice(31, 35) },
  { direction: "其他", skills: TALENT_SKILLS.slice(35) },
] as const;
const identityName = (party: TalentConnection["sender"]) =>
  party.identity?.nickname || `用户 #${party.userId}`;
function Chips({
  values,
  selected,
  onChange,
  max,
}: {
  values: readonly string[];
  selected: string[];
  onChange: (value: string[]) => void;
  max: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const isSelected = selected.includes(value);
        const isDisabled = !isSelected && selected.length >= max;
        return (
          <button
            type="button"
            key={value}
            disabled={isDisabled}
            aria-pressed={isSelected}
            onClick={() =>
              onChange(
                isSelected
                  ? selected.filter((item) => item !== value)
                  : [...selected, value],
              )
            }
            className={`chip-hard ${isSelected ? "chip-active" : ""} disabled:cursor-not-allowed`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
function SkillGroups({
  selected,
  onChange,
  max,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
  max: number;
}) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {TALENT_SKILL_GROUPS.map((group) => (
        <div
          key={group.direction}
          className="grid gap-3 py-4 sm:grid-cols-[96px_1fr] sm:items-start"
        >
          <span className="pt-1 font-mono text-xs font-bold text-primary">
            {group.direction}
          </span>
          <Chips
            values={group.skills}
            selected={selected}
            onChange={onChange}
            max={max}
          />
        </div>
      ))}
    </div>
  );
}
function ProfileCard({ profile }: { profile: TalentProfile }) {
  return (
    <Link
      href={`/talents/${profile.userId}`}
      className="group scan-frame flex min-h-64 flex-col justify-between border border-border bg-card p-5 transition-transform hover:-translate-y-1 hover:shadow-[5px_5px_0_var(--secondary)]"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className="eyebrow">PEOPLE / {profile.userId}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {profile.city || "REMOTE"}
          </span>
        </div>
        <h2 className="mt-5 text-xl font-bold group-hover:text-primary">
          {profile.founder?.nickname || `用户 #${profile.userId}`}
        </h2>
        <p className="mt-1 font-mono text-xs text-primary">
          {profile.headline}
        </p>
        <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">
          {profile.bio}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {profile.skills.slice(0, 4).map((skill) => (
          <span className="chip-hard" key={skill}>
            {skill}
          </span>
        ))}
      </div>
    </Link>
  );
}
export function TalentList({
  profiles,
  total,
  params,
}: {
  profiles: TalentProfile[];
  total: number;
  params: {
    q?: string;
    role?: string;
    skills?: string;
    duration?: string;
    sort: string;
    page: number;
  };
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q || "");
  function go(changes: Record<string, string>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...changes };
    Object.entries(merged).forEach(([key, value]) => {
      if (value && key !== "page") next.set(key, String(value));
    });
    router.push(`/talents?${next}`);
  }
  function pageHref(page: number) {
    const next = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && key !== "page") next.set(key, String(value));
    });
    if (page > 1) next.set("page", String(page));
    return `/talents?${next}`;
  }
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="mb-10 grid gap-8 border-b border-border pb-10 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
           <p className="eyebrow">PEOPLE / OPEN NETWORK</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(42px,8vw,84px)] font-black leading-[.9]">
            找到同路的人
            <br />
            <span className="text-primary">一起做事。</span>
          </h1>
          <p className="mt-6 max-w-xl text-muted-foreground">
            看看社区里正在做产品的人，了解他们能做什么、想参与什么，再决定是否开始一次沟通。
          </p>
        </div>
        <div className="scan-frame border border-border bg-card p-5">
          <p className="font-mono text-xs text-primary">
             {String(total).padStart(3, "0")} PEOPLE IN THE NETWORK
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
             让别人知道你能做什么，以及想参与什么。
          </p>
          <Link
            href="/talents/me/edit"
            className="btn-hard btn-primary mt-5 w-full"
          >
             展示我的能力
          </Link>
        </div>
      </header>
      <div className="mb-8 space-y-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            go({ q, page: "1" });
          }}
        >
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
             placeholder="搜索姓名、方向、技能或项目"
            className="h-12 flex-1 border border-input bg-card px-4 outline-none focus:border-primary"
          />
          <button className="btn-hard btn-primary">搜索</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <select
             aria-label="方向"
            value={params.role || ""}
            onChange={(event) => go({ role: event.target.value, page: "1" })}
            className="h-10 border border-input bg-card px-3 text-sm"
          >
             <option value="">所有方向</option>
            {TALENT_ROLES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
             aria-label="合作方式"
            value={params.duration || ""}
            onChange={(event) =>
              go({ duration: event.target.value, page: "1" })
            }
            className="h-10 border border-input bg-card px-3 text-sm"
          >
             <option value="">所有合作方式</option>
            {COLLABORATION_DURATIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            aria-label="技能"
            defaultValue={params.skills || ""}
            onBlur={(event) => go({ skills: event.target.value, page: "1" })}
             placeholder="技能（逗号分隔）"
            className="h-10 min-w-52 border border-input bg-card px-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() =>
              go({
                sort: params.sort === "active" ? "new" : "active",
                page: "1",
              })
            }
            className="chip-hard"
          >
             {params.sort === "active" ? "最近活跃" : "最近加入"} · 排序
          </button>
        </div>
      </div>
      {profiles.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ProfileCard key={profile.userId} profile={profile} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border py-24 text-center text-muted-foreground">
           还没有找到合适的人，换个条件试试
        </div>
      )}
      <div className="mt-12 flex items-center justify-center gap-4 font-mono text-xs">
        {params.page > 1 && (
          <Link className="btn-hard btn-ghost" href={pageHref(params.page - 1)}>
            ← 上一页
          </Link>
        )}
        <span className="text-primary">
          PAGE {String(params.page).padStart(2, "0")}
        </span>
        {params.page * 20 < total && (
          <Link className="btn-hard btn-ghost" href={pageHref(params.page + 1)}>
            下一页 →
          </Link>
        )}
      </div>
    </section>
  );
}
export function TalentDetail({
  profile,
  projectOptions = [],
}: {
  profile: TalentProfile;
  projectOptions?: TalentProject[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        sessionStorage.getItem("shenicest_pending_talent_connect") !==
        profile.userId
      )
        return;
      sessionStorage.removeItem("shenicest_pending_talent_connect");
      setOpen(true);
    });
    return () => window.clearTimeout(timer);
  }, [profile.userId]);
  const [form, setForm] = useState({
    purpose: "",
    message: "",
    wechat: "",
    email: "",
    projectId: "",
  });
  const [error, setError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const own = String(user?.user_id) === profile.userId;
  async function connect() {
    if (!user) {
      sessionStorage.setItem(
        "shenicest_pending_talent_connect",
        profile.userId,
      );
      router.push(`/login?returnTo=/talents/${profile.userId}`);
      return;
    }
    setOpen(true);
  }
  async function send() {
    const validation = validateConnectionBody(form);
    if (Object.keys(validation).length > 0) {
      setError(Object.values(validation)[0]);
      return;
    }
    setSending(true);
    const result = await sendTalentConnection({
      receiverUserId: profile.userId,
      purpose: form.purpose,
      message: form.message,
      wechat: form.wechat || undefined,
      email: form.email || undefined,
      projectId: form.projectId ? Number(form.projectId) : undefined,
    });
    setSending(false);
    if (result.error) setError(result.error.body.error.message);
    else {
      setOpen(false);
      setSendSuccess(true);
      setError("");
    }
  }
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <Link href="/talents" className="font-mono text-xs text-primary">
         ← PEOPLE / 人才广场
      </Link>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_280px]">
        <main>
           <p className="eyebrow">PEOPLE / PROFILE {profile.userId}</p>
          <h1 className="mt-4 text-[clamp(36px,7vw,72px)] font-black leading-none">
            {profile.founder?.nickname || `用户 #${profile.userId}`}
          </h1>
          <p className="mt-4 text-xl text-primary">{profile.headline}</p>
          <p className="mt-8 whitespace-pre-wrap text-lg leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span className="chip-hard" key={skill}>
                {skill}
              </span>
            ))}
          </div>
          {profile.match ? (
             <div className="mt-10 border border-primary/50 bg-primary/5 p-5">
               <p className="eyebrow">POSSIBLE OVERLAP</p>
              <p className="mt-2 text-2xl font-bold">
                {profile.match.score === 0
                   ? "暂时没有明显交集"
                   : `${profile.match.score}% 可能契合`}
              </p>
              {profile.match.reasons.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {profile.match.reasons.join(" · ")}
                </p>
              )}
            </div>
          ) : null}
          <h2 className="mt-14 border-t border-border pt-6 text-xl font-bold">
             已上线项目
          </h2>
          <div className="mt-4 space-y-3">
            {profile.projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex items-center justify-between gap-4 border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div>
                  <b className="transition-colors group-hover:text-primary">
                    {project.name}
                  </b>
                  {project.tagline ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.tagline}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-xs text-primary">
                  查看项目 →
                </span>
              </Link>
            ))}
          </div>
        </main>
        <aside>
          <div className="sticky top-24 border border-border bg-card p-5">
            <p className="font-mono text-xs text-muted-foreground">
              {profile.city || "REMOTE"} / {profile.durations.join(" · ")}
            </p>
            {!own && !sendSuccess && (
              <button
                onClick={connect}
                className="btn-hard btn-primary mt-6 w-full"
              >
                 发起一次连接
              </button>
            )}
            {sendSuccess && (
              <p className="mt-6 border border-primary/50 bg-primary/5 p-3 text-sm text-primary">
               连接请求已发送，等待对方回应。
              </p>
            )}
            {own && (
              <Link
                href="/talents/me/edit"
                className="btn-hard btn-secondary mt-6 w-full"
              >
               编辑我的档案
              </Link>
            )}
          </div>
        </aside>
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connection-dialog-title"
        >
          <div className="scan-frame max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto border border-border bg-card p-6">
            <h2 id="connection-dialog-title" className="text-xl font-bold">
               发起一次连接
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
               说说你为什么想认识对方。对方接受后，才能看到你授权的联系方式。
            </p>
            <div className="mt-5 space-y-3">
              {projectOptions.length > 0 ? (
                <label className="block font-mono text-xs text-muted-foreground">
                   关联我的已上线项目（可选）
                  <select
                    value={form.projectId}
                    onChange={(event) =>
                      setForm({ ...form, projectId: event.target.value })
                    }
                    className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm text-foreground"
                  >
                   <option value="">暂不关联项目</option>
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block font-mono text-xs text-muted-foreground">
                 想一起做什么
                <select
                  value={form.purpose}
                  onChange={(event) =>
                    setForm({ ...form, purpose: event.target.value })
                  }
                  className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm text-foreground"
                >
                   <option value="">请选择交流方向</option>
                  {CONNECTION_PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>
                      {purpose}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-mono text-xs text-muted-foreground">
                 留言（30-500 字）
                <textarea
                  required
                  minLength={30}
                  maxLength={500}
                  value={form.message}
                  onChange={(event) =>
                    setForm({ ...form, message: event.target.value })
                  }
                  className="mt-1 min-h-28 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                />
              </label>
              <label className="block font-mono text-xs text-muted-foreground">
                微信（微信或邮箱至少一项）
                <input
                  value={form.wechat}
                  onChange={(event) =>
                    setForm({ ...form, wechat: event.target.value })
                  }
                  className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                />
              </label>
              <label className="block font-mono text-xs text-muted-foreground">
                邮箱
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  className="mt-1 w-full border border-input bg-background px-3 py-2 font-sans text-sm"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={sending}
                  className="btn-hard btn-primary flex-1"
                >
                   {sending ? "发送中..." : "发送连接"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-hard btn-ghost"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  area,
  hint,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  const Tag = area ? "textarea" : "input";
  return (
    <label className="block text-sm">
      <span className="flex items-end justify-between gap-3">
        <span className="font-bold text-foreground">{label}</span>
        {maxLength ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {value.length} / {maxLength}
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      ) : null}
      <Tag
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-3 w-full border border-input bg-background px-4 py-3 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary ${area ? "min-h-36 resize-y leading-relaxed" : "min-h-12"}`}
      />
    </label>
  );
}

function EditorSection({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border border-border bg-card">
      <header className="grid gap-3 border-b border-border bg-muted/35 p-5 sm:grid-cols-[64px_1fr] sm:p-6">
        <span className="font-digits text-3xl text-primary">{number}</span>
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
export function TalentEditor({
  initial,
  userId,
}: {
  initial: TalentManagement | null;
  userId: string;
}) {
  const [body, setBody] = useState<TalentBody>(() =>
    initial
      ? {
          headline: initial.headline,
          bio: initial.bio,
          city: initial.city || "",
          roles: initial.roles,
          skills: initial.skills,
          seekingSkills: initial.seekingSkills,
          domains: initial.domains,
          durations: initial.durations,
        }
      : empty,
  );
  const [status, setStatus] = useState(initial?.status);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (initial) return;
    const timer = window.setTimeout(() => {
      const draft = loadTalentDraft(userId);
      if (draft) setBody({ ...empty, ...draft });
    });
    return () => window.clearTimeout(timer);
  }, [initial, userId]);
  function update<K extends keyof TalentBody>(key: K, value: TalentBody[K]) {
    const next = { ...body, [key]: value };
    setBody(next);
    if (!initial) saveTalentDraft(userId, next);
  }
  async function submit(mode: "publish" | "update" | "resume") {
    const errors = validateTalentBody(body);
    if (Object.keys(errors).length) {
      setError(Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    const result = await saveTalent(body, mode);
    setSaving(false);
    if (result.error) setError(result.error.body.error.message);
    else {
      setStatus(result.data?.status);
      clearTalentDraft(userId);
      setError("已保存");
    }
  }
  const suspensionReason = initial?.suspensionAudit?.find(
    (record) => typeof record.reason === "string",
  )?.reason;
  const requirements = [
    body.headline.trim().length >= 2,
    body.bio.trim().length >= 30,
    body.roles.length >= 1,
    body.skills.length >= 3,
    body.domains.length >= 1,
    body.durations.length >= 1,
  ];
  const completedRequirements = requirements.filter(Boolean).length;
  const completion = Math.round(
    (completedRequirements / requirements.length) * 100,
  );
  if (status === TalentProfileStatus.Suspended)
    return (
      <section className="mx-auto max-w-3xl px-4 py-20">
        <p className="eyebrow">PROFILE SUSPENDED</p>
        <h1 className="mt-4 text-4xl font-black">档案已停用</h1>
        <p className="mt-5 text-muted-foreground">
          这是终态，无法继续编辑或恢复。请联系运营处理。
        </p>
        {typeof suspensionReason === "string" && (
          <p className="mt-4 border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            停用原因：{suspensionReason}
          </p>
        )}
        {process.env.NEXT_PUBLIC_TALENT_OPERATIONS_EMAIL && (
          <a
            className="mt-6 inline-block text-primary underline"
            href={`mailto:${process.env.NEXT_PUBLIC_TALENT_OPERATIONS_EMAIL}`}
          >
            联系运营
          </a>
        )}
      </section>
    );
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <Link
            href="/talents"
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            ← PEOPLE / 人才广场
          </Link>
          <p className="eyebrow mt-8">PROFILE / SIGNAL BUILDER</p>
          <h1 className="mt-3 max-w-3xl text-[clamp(40px,7vw,72px)] font-black leading-[.95] tracking-[-0.04em] text-balance">
            {initial ? "让合适的人，更快看懂你。" : "告诉大家，你擅长做什么。"}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            一份清晰的人才档案，会出现在人才广场中。别人可以根据你的能力、关注方向和合作方式，判断是否值得发起连接。
          </p>
        </div>
        <div className="scan-frame border border-primary/50 bg-primary/5 p-5">
          <p className="font-mono text-xs text-primary">PUBLIC PROFILE</p>
          <p className="mt-3 font-bold">这里填写的内容会公开展示</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            联系方式不会公开，只有你接受连接请求后，对方才能看到你授权的信息。
          </p>
        </div>
      </header>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border border-border bg-card lg:sticky lg:top-24">
          <div className="border-b border-border p-5">
            <div className="flex items-end justify-between gap-3">
              <span className="font-bold">档案完成度</span>
              <span className="font-digits text-2xl text-primary">{completion}%</span>
            </div>
            <div className="mt-3 h-1 bg-muted" aria-hidden="true">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              {completedRequirements} / {requirements.length} REQUIRED ITEMS
            </p>
          </div>
          <nav aria-label="档案填写进度" className="p-3">
            {[
              { href: "#profile-basic", label: "01 基础介绍", done: requirements[0] && requirements[1] },
              { href: "#profile-capability", label: "02 我的能力", done: requirements[2] && requirements[3] },
              { href: "#profile-collaboration", label: "03 合作意向", done: requirements[4] && requirements[5] },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center justify-between border-b border-border/60 px-2 py-3 text-sm transition-colors last:border-0 hover:text-primary"
              >
                <span>{item.label}</span>
                <span
                  className={item.done ? "text-primary" : "text-muted-foreground"}
                  aria-label={item.done ? "已完成" : "未完成"}
                >
                  {item.done ? "●" : "○"}
                </span>
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">
          <EditorSection
            id="profile-basic"
            number="01"
            title="先让别人快速认识你"
            description="用一句清楚的定位抓住注意力，再用具体经历说明你做过什么、擅长解决什么问题。"
          >
            <div className="grid gap-7 sm:grid-cols-2">
              <Field
                label="一句话介绍"
                hint="2-30 字，建议使用「角色 + 擅长方向」"
                placeholder="例如：擅长从 0 到 1 的 AI 产品经理"
                maxLength={30}
                value={body.headline}
                onChange={(v) => update("headline", v)}
              />
              <Field
                label="所在城市（可选）"
                hint="远程协作也可以直接填写「远程」"
                placeholder="例如：上海 / 远程"
                value={body.city || ""}
                onChange={(v) => update("city", v)}
              />
              <div className="sm:col-span-2">
                <Field
                  label="关于我"
                  hint="30-500 字。写出你的经验、代表成果和想做的事，比泛泛的自我评价更有说服力。"
                  placeholder="例如：过去 4 年负责开发者工具产品，从用户研究到商业化落地都深度参与……"
                  maxLength={500}
                  area
                  value={body.bio}
                  onChange={(v) => update("bio", v)}
                />
              </div>
            </div>
          </EditorSection>

          <EditorSection
            id="profile-capability"
            number="02"
            title="标记你真正能交付的能力"
            description="方向决定别人如何找到你，技能帮助对方理解你能在项目中承担什么。少而准确，比全部选满更有效。"
          >
            <div className="space-y-9">
              <fieldset>
                <legend className="mb-3 flex w-full items-center justify-between gap-3 text-sm font-bold">
                  <span>方向（至少 1 个）</span>
                  <span className="font-mono text-xs font-normal text-primary">已选 {body.roles.length} / 3</span>
                </legend>
                <p className="mb-4 text-xs text-muted-foreground">选择你希望在合作中承担的主要角色。</p>
                <Chips values={TALENT_ROLES} selected={body.roles} onChange={(v) => update("roles", v)} max={3} />
              </fieldset>
              <fieldset>
                <legend className="mb-3 flex w-full items-center justify-between gap-3 text-sm font-bold">
                  <span>技能（至少 3 项）</span>
                  <span className="font-mono text-xs font-normal text-primary">已选 {body.skills.length} / 10</span>
                </legend>
                <p className="mb-4 text-xs text-muted-foreground">优先选择你有实际项目经验、可以独立完成的技能。</p>
                <SkillGroups selected={body.skills} onChange={(v) => update("skills", v)} max={10} />
              </fieldset>
            </div>
          </EditorSection>

          <EditorSection
            id="profile-collaboration"
            number="03"
            title="说明你想遇见怎样的合作"
            description="让别人知道你关注什么、缺少什么，以及你愿意投入多长时间，减少无效沟通。"
          >
            <div className="space-y-9">
              <fieldset>
                <legend className="mb-3 flex w-full items-center justify-between gap-3 text-sm font-bold">
                  <span>希望一起做什么（可选）</span>
                  <span className="font-mono text-xs font-normal text-primary">已选 {(body.seekingSkills || []).length} / 5</span>
                </legend>
                <p className="mb-4 text-xs text-muted-foreground">选择你希望在未来合作中补齐或遇见的能力。</p>
                <SkillGroups selected={body.seekingSkills || []} onChange={(v) => update("seekingSkills", v)} max={5} />
              </fieldset>
              <div className="grid gap-8 border-t border-border pt-8 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-3 flex w-full items-center justify-between gap-3 text-sm font-bold">
                    <span>关注领域（至少 1 个）</span>
                    <span className="font-mono text-xs font-normal text-primary">已选 {body.domains.length} / 3</span>
                  </legend>
                  <p className="mb-4 text-xs text-muted-foreground">你最想参与或持续探索的产品领域。</p>
                  <Chips values={CATEGORIES} selected={body.domains} onChange={(v) => update("domains", v)} max={3} />
                </fieldset>
                <fieldset>
                  <legend className="mb-3 flex w-full items-center justify-between gap-3 text-sm font-bold">
                    <span>合作方式（至少 1 个）</span>
                    <span className="font-mono text-xs font-normal text-primary">已选 {body.durations.length} / 3</span>
                  </legend>
                  <p className="mb-4 text-xs text-muted-foreground">选择你目前真实可投入的合作周期。</p>
                  <Chips values={COLLABORATION_DURATIONS} selected={body.durations} onChange={(v) => update("durations", v)} max={3} />
                </fieldset>
              </div>
            </div>
          </EditorSection>

          <div className="scan-frame flex flex-col justify-between gap-5 border border-primary/50 bg-primary/5 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-bold">让做过的产品替你说话</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                你提交并成功上线的项目，会自动展示在公开人才档案中，让其他人更直接地了解你的产品和实践经历。
              </p>
            </div>
            <Link href="/submit" className="btn-hard btn-ghost shrink-0">
              去提交项目 <span aria-hidden>→</span>
            </Link>
          </div>

          <footer className="border border-border bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="font-bold">
                {initial ? "保存后，公开档案将立即更新" : "准备好后，公开你的档案"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {initial ? "你可以随时回来修改或暂时隐藏。" : "未完成时会自动保存在当前浏览器。"}
              </p>
              {error ? (
                <p
                  role="status"
                  className={`mt-3 text-sm ${error === "已保存" ? "text-primary" : "text-destructive"}`}
                >
                  {error}
                </p>
              ) : null}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:mt-0 sm:flex-row">
              <button
                disabled={saving}
                onClick={() =>
                  submit(
                    initial
                      ? status === TalentProfileStatus.Paused
                        ? "resume"
                        : "update"
                      : "publish",
                  )
                }
                className="btn-hard btn-primary"
              >
                {saving
                  ? "保存中..."
                  : status === TalentProfileStatus.Paused
                    ? "保存并重新公开"
                    : initial
                      ? "保存更新"
                      : "公开档案"}
              </button>
              {status === TalentProfileStatus.Published && (
                <button
                  disabled={saving}
                  onClick={async () => {
                    const result = await pauseTalent();
                    if (!result.error) setStatus(TalentProfileStatus.Paused);
                  }}
                  className="btn-hard btn-ghost"
                >
                  暂时隐藏
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function ContactForm({
  connection,
  onDone,
}: {
  connection: TalentConnection;
  onDone: () => void;
}) {
  const [wechat, setWechat] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="mt-4 border border-primary/50 p-4">
      <p className="text-sm">接受后双方才能查看授权联系方式。</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          placeholder="微信"
          value={wechat}
          onChange={(e) => setWechat(e.target.value)}
          className="border border-input bg-background px-3 py-2"
        />
        <input
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-input bg-background px-3 py-2"
        />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <button
        className="btn-hard btn-primary mt-3"
        onClick={async () => {
          if (!wechat && !email) {
            setError("至少提供微信或邮箱");
            return;
          }
          setSaving(true);
          const result = await acceptTalentConnection(connection.id, {
            wechat: wechat || undefined,
            email: email || undefined,
          });
          setSaving(false);
          if (result.error) setError(result.error.body.error.message);
          else onDone();
        }}
      >
        {saving ? "处理中..." : "接受连接"}
      </button>
    </div>
  );
}
function ContactDisplay({
  contacts,
}: {
  contacts: NonNullable<TalentConnection["contacts"]>["other"];
}) {
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      {contacts.wechat && (
        <button
          className="block font-mono text-xs text-primary"
          onClick={() => navigator.clipboard.writeText(contacts.wechat!)}
        >
          微信：{contacts.wechat} · 复制
        </button>
      )}
      {contacts.email && (
        <button
          className="block font-mono text-xs text-primary"
          onClick={() => navigator.clipboard.writeText(contacts.email!)}
        >
          邮箱：{contacts.email} · 复制
        </button>
      )}
    </div>
  );
}
export function ConnectionsPanel({
  initial,
  userId,
}: {
  initial: { data: TalentConnection[]; pendingReceived: number };
  userId: string;
}) {
  const [data, setData] = useState(initial.data);
  const [view, setView] = useState<"received" | "sent">("received");
  const [accepting, setAccepting] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  async function refresh() {
    const result = await getConnections();
    if (result.data) {
      setData(result.data.data);
      setActionError("");
      window.dispatchEvent(new Event("talent-connections-refresh"));
    }
  }
  const filtered = data
    .toSorted((a, b) => {
      const pendingA =
        a.status === ConnectionRequestStatus.Pending &&
        a.receiverUserId === userId;
      const pendingB =
        b.status === ConnectionRequestStatus.Pending &&
        b.receiverUserId === userId;
      return Number(pendingB) - Number(pendingA);
    })
    .filter((item) =>
      view === "received"
        ? item.receiverUserId === userId
        : item.senderUserId === userId,
    );
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">CONNECTIONS / NETWORK</p>
           <h1 className="mt-3 text-4xl font-black">连接记录</h1>
        </div>
        <button className="btn-hard btn-ghost" onClick={refresh}>
          刷新
        </button>
      </div>
      <div className="mt-8 flex gap-2 border-b border-border pb-3">
        <button
          className={`chip-hard ${view === "received" ? "chip-active" : ""}`}
          onClick={() => setView("received")}
        >
           收到的连接
        </button>
        <button
          className={`chip-hard ${view === "sent" ? "chip-active" : ""}`}
          onClick={() => setView("sent")}
        >
           发出的连接
        </button>
      </div>
      <div className="mt-6 space-y-4">
        {filtered.length ? (
          filtered.map((connection) => {
            const party =
              view === "received" ? connection.sender : connection.receiver;
            return (
              <article
                className="border border-border bg-card p-5"
                key={connection.id}
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-bold">{identityName(party)}</p>
                    <p className="mt-1 font-mono text-xs text-primary">
                      {party.hasPublishedTalentProfile
                         ? party.talentProfile?.headline || "公开介绍"
                         : "该用户暂未公开介绍"}
                    </p>
                  </div>
                  <span className="chip-hard">
                    {connectionStatusLabel(connection.status, view === "sent")}
                  </span>
                </div>
                {party.talentProfile && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {party.talentProfile.roles.map((role) => (
                      <span className="chip-hard" key={role}>
                        {role}
                      </span>
                    ))}
                    {party.talentProfile.durations.map((duration) => (
                      <span className="chip-hard" key={duration}>
                        {duration}
                      </span>
                    ))}
                  </div>
                )}
                {connection.project && (
                  <p className="mt-4 border-l-2 border-primary pl-3 text-sm">
                    关联项目：
                    {"unavailable" in connection.project ? (
                      "项目当前不可用"
                    ) : (
                      <Link
                        href={`/projects/${connection.project.id}`}
                        className="text-primary underline"
                      >
                        {connection.project.name}
                      </Link>
                    )}
                  </p>
                )}
                <p className="mt-4 text-sm text-muted-foreground">
                  {connection.purpose}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {connection.message}
                </p>
                {connection.status === ConnectionRequestStatus.Accepted &&
                  connection.contacts && (
                    <ContactDisplay contacts={connection.contacts.other} />
                  )}
                {view === "received" &&
                  connection.status === ConnectionRequestStatus.Pending &&
                  (accepting === connection.id ? (
                    <ContactForm
                      connection={connection}
                      onDone={() => {
                        setAccepting(null);
                        refresh();
                      }}
                    />
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <button
                        className="btn-hard btn-primary"
                        onClick={() => setAccepting(connection.id)}
                      >
                        接受
                      </button>
                      <button
                        className="btn-hard btn-ghost"
                        onClick={async () => {
                          const result = await ignoreTalentConnection(
                            connection.id,
                          );
                          if (result.error)
                            setActionError(result.error.body.error.message);
                          else refresh();
                        }}
                      >
                        忽略
                      </button>
                    </div>
                  ))}
              </article>
            );
          })
        ) : (
          <div className="border border-dashed border-border py-20 text-center text-muted-foreground">
            这里还没有连接记录
          </div>
        )}
      </div>
      {actionError && (
        <p className="mt-4 text-sm text-destructive">{actionError}</p>
      )}
    </section>
  );
}

export function OperatorTalentActions({
  profile,
}: {
  profile: TalentManagement;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  if (profile.status === TalentProfileStatus.Suspended)
    return <p className="text-destructive">该档案已停用，P0 不支持恢复。</p>;
  return (
    <div className="mt-8 border border-destructive/50 p-5">
      <p className="eyebrow text-destructive">MODERATION</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="停用原因"
        className="mt-3 min-h-24 w-full border border-input bg-background p-3"
      />
      <button
        className="btn-hard mt-3 border-destructive text-destructive"
        onClick={async () => {
          const result = await suspendTalent(profile.userId, reason);
          setMessage(result.error ? result.error.body.error.message : "已停用");
        }}
      >
        停用档案
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  );
}
