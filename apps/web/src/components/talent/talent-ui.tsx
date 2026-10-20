"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CATEGORIES,
  COLLABORATION_DURATIONS,
  CONNECTION_PURPOSES,
  TALENT_AVAILABILITY_LABELS,
  TALENT_SKILL_GROUPS,
  MAX_TALENT_SKILLS,
  MAX_SEEKING_SKILLS,
  skillLabel,
  TalentAvailability,
  TalentProfileStatus,
} from "@shenicest/shared";
import { useAuth } from "@/components/auth-provider";
import {
  pauseTalent,
  saveTalent,
  sendTalentConnection,
  suspendTalent,
} from "@/lib/client-api";
import {
  clearTalentDraft,
  loadTalentDraft,
  orderSkillsByGroup,
  saveTalentDraft,
  talentRequirementChecks,
  TALENT_PAGE_SIZE,
  validateConnectionBody,
  validateTalentBody,
  type TalentBody,
  type TalentManagement,
  type TalentProfile,
  type TalentProject,
} from "@/lib/talent";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip, ChipButton, chipClass, type ChipTone } from "@/components/ui/chip";
import { Card, Panel } from "@/components/ui/surface";
import { Eyebrow } from "@/components/ui/typography";

const empty: TalentBody = {
  headline: "",
  bio: "",
  links: [],
  city: "",
  skills: [],
  seekingSkills: [],
  domains: [],
  durations: [],
  // Editor sentinel: no availability picked yet (never a valid enum value).
  availability: -1,
};
const identity = (value: string) => value;
function Chips({
  values,
  selected,
  onChange,
  max,
  label = identity,
}: {
  values: readonly string[];
  selected: string[];
  onChange: (value: string[]) => void;
  max: number;
  label?: (value: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const isSelected = selected.includes(value);
        const isDisabled = !isSelected && selected.length >= max;
        return (
          <ChipButton
            key={value}
            disabled={isDisabled}
            aria-pressed={isSelected}
            tone={isSelected ? "accent" : "neutral"}
            className="disabled:cursor-not-allowed! disabled:opacity-50"
            onClick={() =>
              onChange(
                isSelected
                  ? selected.filter((item) => item !== value)
                  : [...selected, value],
              )
            }
          >
            {label(value)}
          </ChipButton>
        );
      })}
    </div>
  );
}
type SkillWallState = { skills: string[]; seekingSkills: string[] };

// Public cooperation signal: one color/state per availability value, visible
// to logged-out visitors as well (it lowers the cost of a wasted outreach).
const AVAILABILITY_TONE: Record<TalentAvailability, ChipTone> = {
  [TalentAvailability.ActivelySeeking]: "accent",
  [TalentAvailability.OpenToChat]: "neutral",
  [TalentAvailability.ConsultOnly]: "sky",
};

export function AvailabilityBadge({ availability }: { availability: number }) {
  const label = TALENT_AVAILABILITY_LABELS[availability as TalentAvailability];
  if (!label) return null;
  return (
    <Chip
      tone={AVAILABILITY_TONE[availability as TalentAvailability] ?? "neutral"}
      data-state={availability}
    >
      {label}
    </Chip>
  );
}

// Read-only wall chip (cards + detail): provide and seeking states rest in
// distinct colors, mirroring the editor's dual-state wall (ADR-0013).
export function SkillChip({
  skill,
  skillState,
}: {
  skill: string;
  skillState: "provide" | "seeking";
}) {
  return (
    <Chip
      tone={skillState === "provide" ? "accent" : "sky"}
      data-skill-state={skillState}
    >
      {skillLabel(skill)}
    </Chip>
  );
}

// One wall, three states (ADR-0013): a chip cycles
// 未选 → 我能提供 → 我想寻找 → 未选; the two selected states rest in the
// distinct `skills` / `seekingSkills` arrays the submit body already uses.
function SkillWall({
  state,
  onChange,
}: {
  state: SkillWallState;
  onChange: (next: SkillWallState) => void;
}) {
  function stateOf(skill: string): "provide" | "seeking" | "none" {
    if (state.skills.includes(skill)) return "provide";
    if (state.seekingSkills.includes(skill)) return "seeking";
    return "none";
  }
  function toggle(skill: string) {
    const { skills, seekingSkills } = state;
    if (skills.includes(skill)) {
      if (seekingSkills.length >= MAX_SEEKING_SKILLS) {
        // Cap reached: cycle ends at 未选 instead of forcing 我想寻找.
        onChange({ skills: skills.filter((item) => item !== skill), seekingSkills });
        return;
      }
      onChange({ skills: skills.filter((item) => item !== skill), seekingSkills: [...seekingSkills, skill] });
      return;
    }
    if (seekingSkills.includes(skill)) {
      onChange({ skills, seekingSkills: seekingSkills.filter((item) => item !== skill) });
      return;
    }
    if (skills.length >= MAX_TALENT_SKILLS) return;
    onChange({ skills: [...skills, skill], seekingSkills });
  }
  const stateLabel = (chipState: "provide" | "seeking" | "none") =>
    chipState === "provide" ? "，我能提供" : chipState === "seeking" ? "，我想寻找" : "";
  return (
    <div className="divide-y divide-border border-y border-border">
      {TALENT_SKILL_GROUPS.map((group) => (
        <div
          key={group.direction}
          className="grid gap-3 py-4 sm:grid-cols-[96px_1fr] sm:items-start"
        >
          <span className="pt-1 font-mono text-meta font-bold text-brand-text">
            {group.direction}
          </span>
          <div className="flex flex-wrap gap-2">
            {[...group.skills].map((skill) => {
              const chipState = stateOf(skill);
              return (
                <button
                  type="button"
                  key={skill}
                  data-state={chipState}
                  aria-pressed={chipState !== "none"}
                  aria-label={`${skillLabel(skill)}${stateLabel(chipState)}`}
                  onClick={() => toggle(skill)}
                  className={chipClass({
                    tone:
                      chipState === "provide"
                        ? "accent"
                        : chipState === "seeking"
                          ? "sky"
                          : "neutral",
                    interactive: true,
                  })}
                >
                  {skillLabel(skill)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LinksEditor({
  links,
  onChange,
}: {
  links: string[];
  onChange: (links: string[]) => void;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3 text-sm">
        <span className="font-bold text-foreground">作品链接（0-3 个）</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {links.length} / 3
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        GitHub、作品集网站、个人主页……作品比长文更有说服力。
      </p>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div className="mt-2 flex gap-2" key={index}>
            <input
              value={link}
              inputMode="url"
              aria-label={`作品链接 ${index + 1}`}
              placeholder="https://github.com/yourname"
              onChange={(event) =>
                onChange(
                  links.map((value, i) => (i === index ? event.target.value : value)),
                )
              }
              className="h-12 w-full border border-input bg-background px-4 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`移除作品链接 ${index + 1}`}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
              className="shrink-0"
            >
              移除
            </Button>
          </div>
        ))}
      </div>
      {links.length < 3 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => onChange([...links, ""])}
        >
          + 添加作品链接
        </Button>
      ) : null}
    </div>
  );
}

function ProfileCard({ profile }: { profile: TalentProfile }) {
  return (
    <Card className="group h-full">
      <Link
        href={`/talents/${profile.userId}`}
        className="flex min-h-64 flex-1 flex-col justify-between gap-6 p-5"
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <span className="eyebrow">PEOPLE / {profile.userId}</span>
            <span className="font-mono text-meta text-muted-foreground">
              {profile.city || "REMOTE"}
            </span>
          </div>
          <h2 className="mt-5 text-xl font-bold text-foreground transition-colors group-hover:text-brand-text">
            {profile.founder?.nickname || `用户 #${profile.userId}`}
          </h2>
          <p className="mt-1 font-mono text-meta text-brand-text">
            {profile.headline}
          </p>
          <p className="mt-4 line-clamp-3 text-body-sm text-muted-foreground">
            {profile.bio}
          </p>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AvailabilityBadge availability={profile.availability} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {/* 提供 state first, looking-for fills the remaining slots. */}
            {orderSkillsByGroup(profile.skills).slice(0, 4).map((skill) => (
              <SkillChip key={skill} skill={skill} skillState="provide" />
            ))}
            {orderSkillsByGroup(profile.seekingSkills ?? [])
              .filter((skill) => !profile.skills.includes(skill))
              .slice(0, 2)
              .map((skill) => (
                <SkillChip key={skill} skill={skill} skillState="seeking" />
              ))}
          </div>
        </div>
      </Link>
    </Card>
  );
}

const SearchIcon = (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" strokeLinecap="round" />
  </svg>
);

export function TalentList({
  profiles,
  total,
  params,
}: {
  profiles: TalentProfile[];
  total: number;
  params: {
    q?: string;
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
    <section className="section section--flush">
      <div className="shell shell--narrow">
        <header className="mb-10 grid gap-8 border-b border-border pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <Eyebrow>PEOPLE / OPEN NETWORK</Eyebrow>
            <h1 className="page-title">
              找到同路的人
              <br />
              <span className="text-brand-text">一起做事。</span>
            </h1>
            <p className="page-lead">
              看看社区里正在做产品的人，了解他们能做什么、想参与什么，再决定是否开始一次沟通。
            </p>
          </div>
          <Card static>
            <div className="card-body card-body--roomy">
              <p className="font-mono text-meta text-brand-text">
                {String(total).padStart(3, "0")} PEOPLE IN THE NETWORK
              </p>
              <p className="text-body-sm text-muted-foreground">
                让别人知道你能做什么，以及想参与什么。
              </p>
              <ButtonLink href="/talents/me/edit" block className="mt-2">
                展示我的能力 <span className="ui-btn__arrow" aria-hidden>→</span>
              </ButtonLink>
            </div>
          </Card>
        </header>

        <div className="mb-8 space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              go({ q, page: "1" });
            }}
          >
            <div className="ui-search flex-1">
              {SearchIcon}
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="搜索姓名、技能或项目"
                aria-label="搜索人才"
              />
            </div>
            <Button type="submit">搜索</Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <select
                aria-label="合作方式"
                value={params.duration || ""}
                onChange={(event) =>
                  go({ duration: event.target.value, page: "1" })
                }
                className="ui-select"
              >
                <option value="">所有合作方式</option>
                {COLLABORATION_DURATIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="w-56">
              <input
                aria-label="技能"
                defaultValue={params.skills || ""}
                onBlur={(event) => go({ skills: event.target.value, page: "1" })}
                placeholder="技能（逗号分隔）"
                className="ui-input"
              />
            </div>
            <ChipButton
              aria-pressed={params.sort === "active"}
              tone={params.sort === "active" ? "accent" : "neutral"}
              onClick={() =>
                go({
                  sort: params.sort === "active" ? "new" : "active",
                  page: "1",
                })
              }
            >
              {params.sort === "active" ? "最近活跃" : "最近加入"} · 排序
            </ChipButton>
          </div>
        </div>
        {profiles.length ? (
          <div className="card-grid">
            {profiles.map((profile) => (
              <ProfileCard key={profile.userId} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="ui-empty">还没有找到合适的人，换个条件试试</div>
        )}

        <div className="mt-12 flex items-center justify-center gap-4 font-mono text-meta">
          {params.page > 1 && (
            <ButtonLink
              variant="ghost"
              href={pageHref(params.page - 1)}
            >
              ← 上一页
            </ButtonLink>
          )}
          <span className="text-brand-text">
            PAGE {String(params.page).padStart(2, "0")}
          </span>
          {params.page * TALENT_PAGE_SIZE < total && (
            <ButtonLink
              variant="ghost"
              href={pageHref(params.page + 1)}
            >
              下一页 →
            </ButtonLink>
          )}
        </div>
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
    <section className="section section--flush">
      <div className="shell shell--narrow">
        <Link href="/talents" className="detail-crumb">
          ← PEOPLE / 人才广场
        </Link>
        <div className="detail-layout mt-10">
          <main>
            <Eyebrow>PEOPLE / PROFILE {profile.userId}</Eyebrow>
            <h1 className="detail-title">
              {profile.founder?.nickname || `用户 #${profile.userId}`}
            </h1>
            <p className="mt-4 text-xl text-brand-text">{profile.headline}</p>
            <div className="mt-4">
              <AvailabilityBadge availability={profile.availability} />
            </div>
            <p className="detail-copy">{profile.bio}</p>
            {profile.links?.length ? (
              <ul className="mt-6 space-y-2">
                {profile.links.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all text-body-sm text-brand-text underline underline-offset-2"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-10 space-y-8">
              <div role="group" aria-label="我能提供" className="border-t border-border pt-6">
                <h2 className="font-mono text-meta font-bold tracking-[0.12em] text-brand-text">
                  我能提供
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {orderSkillsByGroup(profile.skills).map((skill) => (
                    <SkillChip key={skill} skill={skill} skillState="provide" />
                  ))}
                </div>
              </div>
              {(profile.seekingSkills ?? []).length > 0 && (
                <div role="group" aria-label="我想寻找" className="border-t border-border pt-6">
                  <h2 className="font-mono text-meta font-bold tracking-[0.12em] text-sky-text">
                    我想寻找
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {orderSkillsByGroup(profile.seekingSkills ?? []).map((skill) => (
                      <SkillChip key={skill} skill={skill} skillState="seeking" />
                    ))}
                  </div>
                </div>
              )}
            </div>
            {profile.match ? (
              <div className="detail-callout">
                <Eyebrow>POSSIBLE OVERLAP</Eyebrow>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {profile.match.score === 0
                    ? "暂时没有明显交集"
                    : `${profile.match.score}% 可能契合`}
                </p>
                {profile.match.reasons.length > 0 && (
                  <p className="mt-2 text-body-sm text-muted-foreground">
                    {profile.match.reasons.join(" · ")}
                  </p>
                )}
              </div>
            ) : null}
            <h2 className="detail-section__title mt-14 border-t border-border pt-6">
              已上线项目
            </h2>
            <div className="mt-4 space-y-3">
              {profile.projects.map((project) => (
                <Card key={project.id} static className="group">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <b className="text-foreground transition-colors group-hover:text-brand-text">
                        {project.name}
                      </b>
                      {project.tagline ? (
                        <p className="mt-1 text-body-sm text-muted-foreground">
                          {project.tagline}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-meta text-brand-text">
                      查看项目 →
                    </span>
                  </Link>
                </Card>
              ))}
            </div>
          </main>
          <aside className="detail-aside">
            <Card static>
              <div className="card-body card-body--roomy">
                <p className="font-mono text-meta text-muted-foreground">
                  {profile.city || "REMOTE"} / {profile.durations.join(" · ")}
                </p>
                {!own && !sendSuccess && (
                  <Button block className="mt-4" onClick={connect}>
                    发起一次连接
                  </Button>
                )}
                {sendSuccess && (
                  <p className="ui-note ui-note--success mt-4">
                    连接请求已发送，等待对方回应。
                  </p>
                )}
                {own && (
                  <ButtonLink
                    href="/talents/me/edit"
                    variant="secondary"
                    block
                    className="mt-4"
                  >
                    编辑我的档案
                  </ButtonLink>
                )}
              </div>
            </Card>
          </aside>
        </div>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-dialog-title"
          >
            <Panel className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto">
              <h2 id="connection-dialog-title" className="text-xl font-bold text-foreground">
                发起一次连接
              </h2>
              <p className="mt-2 text-body-sm text-muted-foreground">
                说说你为什么想认识对方。对方接受后，才能看到你授权的联系方式。
              </p>
              <div className="mt-5 space-y-3">
                {projectOptions.length > 0 ? (
                  <label className="ui-field">
                    <span className="ui-label">关联我的已上线项目（可选）</span>
                    <select
                      value={form.projectId}
                      onChange={(event) =>
                        setForm({ ...form, projectId: event.target.value })
                      }
                      className="ui-select"
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
                <label className="ui-field">
                  <span className="ui-label">想一起做什么</span>
                  <select
                    value={form.purpose}
                    onChange={(event) =>
                      setForm({ ...form, purpose: event.target.value })
                    }
                    className="ui-select"
                  >
                    <option value="">请选择交流方向</option>
                    {CONNECTION_PURPOSES.map((purpose) => (
                      <option key={purpose} value={purpose}>
                        {purpose}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ui-field">
                  <span className="ui-label">留言（30-500 字）</span>
                  <textarea
                    required
                    minLength={30}
                    maxLength={500}
                    value={form.message}
                    onChange={(event) =>
                      setForm({ ...form, message: event.target.value })
                    }
                    className="ui-textarea min-h-28"
                  />
                </label>
                <label className="ui-field">
                  <span className="ui-label">微信（微信或邮箱至少一项）</span>
                  <input
                    value={form.wechat}
                    onChange={(event) =>
                      setForm({ ...form, wechat: event.target.value })
                    }
                    className="ui-input"
                  />
                </label>
                <label className="ui-field">
                  <span className="ui-label">邮箱</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    className="ui-input"
                  />
                </label>
                {error && <p className="ui-note ui-note--danger">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    onClick={send}
                    disabled={sending}
                    className="flex-1"
                  >
                    {sending ? "发送中..." : "发送连接"}
                  </Button>
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
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
    <label className="ui-field">
      <span className="flex items-end justify-between gap-3">
        <span className="ui-label">{label}</span>
        {maxLength ? (
          <span className="font-mono text-meta text-muted-foreground">
            {value.length} / {maxLength}
          </span>
        ) : null}
      </span>
      {hint ? <span className="ui-hint">{hint}</span> : null}
      <Tag
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className={area ? "ui-textarea" : "ui-input"}
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
    <section id={id} className="ui-card ui-card--static scroll-mt-24">
      <header className="grid gap-3 border-b border-border bg-muted p-5 sm:grid-cols-[64px_1fr] sm:p-6">
        <span className="font-digits text-3xl text-brand-text">{number}</span>
        <div>
          <h2 className="text-h3 font-black text-foreground">{title}</h2>
          <p className="mt-1 max-w-2xl text-body-sm leading-relaxed text-muted-foreground">
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
          bio: initial.bio ?? "",
          links: initial.links ?? [],
          city: initial.city || "",
          skills: initial.skills,
          seekingSkills: initial.seekingSkills,
          domains: initial.domains,
          durations: initial.durations,
          availability: initial.availability,
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
  const workLinks = body.links.map((link) => link.trim()).filter(Boolean);
  const bio = (body.bio ?? "").trim();
  async function submit(mode: "publish" | "update" | "resume") {
    const payload: TalentBody = {
      ...body,
      bio: bio || undefined,
      links: workLinks,
    };
    const errors = validateTalentBody(payload);
    if (Object.keys(errors).length) {
      setError(Object.values(errors)[0]);
      return;
    }
    setSaving(true);
    const result = await saveTalent(payload, mode);
    setSaving(false);
    if (result.error) setError(result.error.body.error.message);
    else {
      setStatus(result.data?.status);
      clearTalentDraft(userId);
      setError("已保存");
    }
  }
  // A single merged state write keeps body/draft consistent when the patch
  // touches both wall arrays at once.
  function updateWall(next: SkillWallState) {
    const nextBody = { ...body, skills: next.skills, seekingSkills: next.seekingSkills };
    setBody(nextBody);
    if (!initial) saveTalentDraft(userId, nextBody);
  }
  const suspensionReason = initial?.suspensionAudit?.find(
    (record) => typeof record.reason === "string",
  )?.reason;
  const requirements = talentRequirementChecks({
    ...body,
    bio: bio || undefined,
    links: workLinks,
  });
  const completedRequirements = requirements.filter(Boolean).length;
  const completion = Math.round(
    (completedRequirements / requirements.length) * 100,
  );
  if (status === TalentProfileStatus.Suspended)
    return (
      <section className="section section--flush">
        <div className="shell shell--text">
          <Eyebrow>PROFILE SUSPENDED</Eyebrow>
          <h1 className="mt-4 text-4xl font-black text-foreground">档案已停用</h1>
          <p className="mt-5 text-muted-foreground">
            这是终态，无法继续编辑或恢复。请联系运营处理。
          </p>
          {typeof suspensionReason === "string" && (
            <p className="ui-note ui-note--danger mt-4">
              停用原因：{suspensionReason}
            </p>
          )}
          {process.env.NEXT_PUBLIC_TALENT_OPERATIONS_EMAIL && (
            <a
              className="mt-6 inline-block text-brand-text underline"
              href={`mailto:${process.env.NEXT_PUBLIC_TALENT_OPERATIONS_EMAIL}`}
            >
              联系运营
            </a>
          )}
        </div>
      </section>
    );
  return (
    <main className="section section--flush">
      <div className="shell shell--narrow">
        <header className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <Link href="/talents" className="detail-crumb">
              ← PEOPLE / 人才广场
            </Link>
            <Eyebrow className="mt-8">PROFILE / SIGNAL BUILDER</Eyebrow>
            <h1 className="mt-3 max-w-3xl text-h1 font-black leading-[.95] tracking-[-0.04em] text-balance text-foreground">
              {initial ? "让合适的人，更快看懂你。" : "告诉大家，你擅长做什么。"}
            </h1>
            <p className="mt-5 max-w-2xl text-body leading-relaxed text-muted-foreground sm:text-body-lg">
              一份清晰的人才档案，会出现在人才广场中。别人可以根据你的能力、关注方向和合作方式，判断是否值得发起连接。
            </p>
          </div>
          <div className="rounded-lg border border-brand-line bg-brand-wash p-5">
            <Eyebrow>PUBLIC PROFILE</Eyebrow>
            <p className="mt-3 font-bold text-foreground">这里填写的内容会公开展示</p>
            <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">
              联系方式不会公开，只有你接受连接请求后，对方才能看到你授权的信息。
            </p>
          </div>
        </header>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="ui-card ui-card--static lg:sticky lg:top-24">
            <div className="border-b border-border p-5">
              <div className="flex items-end justify-between gap-3">
                <span className="font-bold text-foreground">档案完成度</span>
                <span className="font-digits text-2xl text-brand-text">
                  {completion}%
                </span>
              </div>
              <div className="ui-progress mt-3" aria-hidden="true">
                <i style={{ width: `${completion}%` }} />
              </div>
              <p className="mt-2 font-mono text-meta text-muted-foreground">
                {completedRequirements} / {requirements.length} REQUIRED ITEMS
              </p>
            </div>
            <nav aria-label="档案填写进度" className="p-3">
              {[
                { href: "#profile-basic", label: "01 基础介绍", done: requirements[0] },
                { href: "#profile-story", label: "02 关于我和作品", done: requirements[1] },
                { href: "#profile-skills", label: "03 技能墙", done: requirements[2] },
                {
                  href: "#profile-collaboration",
                  label: "04 合作意向",
                  done: requirements[3] && requirements[4] && requirements[5],
                },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between border-b border-border-soft px-2 py-3 text-body-sm transition-colors last:border-0 hover:text-brand-text"
                >
                  <span>{item.label}</span>
                  <span
                    className={item.done ? "text-brand-text" : "text-muted-foreground"}
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
              description="用一句清楚的定位抓住注意力，更准确地说，让人知道你能提供什么、正在专注于什么。"
            >
              <div className="grid gap-7 sm:grid-cols-2">
                <Field
                  label="一句话介绍"
                  hint="4-50 字，建议使用「角色 + 擅长方向」"
                  placeholder="例如：擅长从 0 到 1 的 AI 产品经理"
                  maxLength={50}
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
              </div>
            </EditorSection>

            <EditorSection
              id="profile-story"
              number="02"
              title="讲讲你的经历和作品"
              description="或者认真写下「关于我」，或者贴上作品链接，至少填写其一。两者俱全，你的档案更有分量。"
            >
              <div className="grid gap-9 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <Field
                    label="关于我"
                    hint="30-500 字。可以套用句式：我做了 X 年 Y，擅长 Z，最近在探索 W。"
                    maxLength={500}
                    area
                    placeholder="例如：我做了 4 年开发者工具产品，擅长从用户研究到商业化落地，最近在探索 AI 辅助产品工作流。"
                    value={body.bio ?? ""}
                    onChange={(v) => update("bio", v)}
                  />
                  <p className="mt-2 text-meta leading-relaxed text-muted-foreground">
                    更多句式参考：「我在 X 行业做了 Y 年，最得意的项目是 Z」/「我擅长
                    X，帮过 Y 个团队解决过 Z」。
                  </p>
                </div>
                <LinksEditor links={body.links} onChange={(v) => update("links", v)} />
              </div>
            </EditorSection>

            <EditorSection
              id="profile-skills"
              number="03"
              title="一面技能墙，两个状态"
              description="点一下标记「我能提供」，再点一下变为「我想寻找」。同一技能只能占据一个状态，方向由这些技能自然决定。"
            >
              <div className="space-y-5">
                <p className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-meta text-brand-text">
                  <span>
                    我能提供 {body.skills.length} / {MAX_TALENT_SKILLS}（至少 3 项）
                  </span>
                  <span>
                    我想寻找 {(body.seekingSkills || []).length} / {MAX_SEEKING_SKILLS}（可选）
                  </span>
                </p>
                <SkillWall
                  state={{ skills: body.skills, seekingSkills: body.seekingSkills || [] }}
                  onChange={updateWall}
                />
              </div>
            </EditorSection>

            <EditorSection
              id="profile-collaboration"
              number="04"
              title="说明你想遇见怎样的合作"
              description="让别人知道你关注什么、愿意投入多长时间、以及当前是否方便碰撞，减少无效沟通。"
            >
              <div className="space-y-9">
                <div className="grid gap-8 sm:grid-cols-2">
                  <fieldset className="min-w-0">
                    <legend className="mb-3 flex w-full items-center justify-between gap-3 text-body-sm font-bold text-foreground">
                      <span>关注领域（至少 1 个）</span>
                      <span className="font-mono text-meta font-normal text-brand-text">
                        已选 {body.domains.length} / 3
                      </span>
                    </legend>
                    <p className="mb-4 text-meta text-muted-foreground">
                      你最想参与或持续探索的产品领域。
                    </p>
                    <Chips
                      values={CATEGORIES}
                      selected={body.domains}
                      onChange={(v) => update("domains", v)}
                      max={3}
                    />
                  </fieldset>
                  <fieldset className="min-w-0">
                    <legend className="mb-3 flex w-full items-center justify-between gap-3 text-body-sm font-bold text-foreground">
                      <span>合作方式（至少 1 个）</span>
                      <span className="font-mono text-meta font-normal text-brand-text">
                        已选 {body.durations.length} / 3
                      </span>
                    </legend>
                    <p className="mb-4 text-meta text-muted-foreground">
                      选择你目前真实可投入的合作周期。
                    </p>
                    <Chips
                      values={COLLABORATION_DURATIONS}
                      selected={body.durations}
                      onChange={(v) => update("durations", v)}
                      max={3}
                    />
                  </fieldset>
                </div>
                <fieldset className="min-w-0">
                  <legend className="mb-3 flex w-full items-center justify-between gap-3 text-body-sm font-bold text-foreground">
                    <span>当前状态（单选）</span>
                  </legend>
                  <p className="mb-4 text-meta text-muted-foreground">
                    公开展示在档案上，帮助对方判断这次沟通是否值得发起。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(TalentAvailability).map((value) => {
                      const isActive = body.availability === value;
                      return (
                        <ChipButton
                          key={value}
                          aria-pressed={isActive}
                          tone={isActive ? "accent" : "neutral"}
                          onClick={() => update("availability", value)}
                        >
                          {TALENT_AVAILABILITY_LABELS[value]}
                        </ChipButton>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </EditorSection>

            <div className="flex flex-col justify-between gap-5 rounded-lg border border-brand-line bg-brand-wash p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold text-foreground">让做过的产品替你说话</p>
                <p className="mt-2 max-w-2xl text-body-sm leading-relaxed text-muted-foreground">
                  你提交并成功上线的项目，会自动展示在公开人才档案中，让其他人更直接地了解你的产品和实践经历。
                </p>
              </div>
              <ButtonLink href="/submit" variant="ghost" className="shrink-0">
                去提交项目 <span aria-hidden>→</span>
              </ButtonLink>
            </div>

            <footer className="ui-panel sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <p className="font-bold text-foreground">
                  {initial ? "保存后，公开档案将立即更新" : "准备好后，公开你的档案"}
                </p>
                <p className="mt-1 text-meta text-muted-foreground">
                  {initial ? "你可以随时回来修改或暂时隐藏。" : "未完成时会自动保存在当前浏览器。"}
                </p>
                {error ? (
                  <p
                    role="status"
                    className={`mt-3 text-body-sm ${error === "已保存" ? "text-brand-text" : "text-danger-text"}`}
                  >
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:mt-0 sm:flex-row">
                <Button
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
                >
                  {saving
                    ? "保存中..."
                    : status === TalentProfileStatus.Paused
                      ? "保存并重新公开"
                      : initial
                        ? "保存更新"
                        : "公开档案"}
                </Button>
                {status === TalentProfileStatus.Published && (
                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={async () => {
                      const result = await pauseTalent();
                      if (!result.error) setStatus(TalentProfileStatus.Paused);
                    }}
                  >
                    暂时隐藏
                  </Button>
                )}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </main>
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
    return <p className="mt-8 text-danger-text">该档案已停用，P0 不支持恢复。</p>;
  return (
    <Panel className="mt-8 border-danger-line!">
      <Eyebrow className="text-danger-text!">MODERATION</Eyebrow>
      <div className="mt-3 flex flex-col gap-3">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="停用原因"
          className="ui-textarea min-h-24"
        />
        <Button
          variant="secondary"
          className="self-start border-danger-line! text-danger-text!"
          onClick={async () => {
            const result = await suspendTalent(profile.userId, reason);
            setMessage(result.error ? result.error.body.error.message : "已停用");
          }}
        >
          停用档案
        </Button>
        {message && <p className="text-body-sm text-muted-foreground">{message}</p>}
      </div>
    </Panel>
  );
}
