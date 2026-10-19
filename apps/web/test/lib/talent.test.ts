import { describe, expect, it } from "vitest";
import {
  clearTalentDraft,
  loadTalentDraft,
  parseTalentParams,
  saveTalentDraft,
  talentDraftKey,
  validateConnectionBody,
  validateTalentBody,
} from "@/lib/talent";

describe("talent utilities", () => {
  it("parses supported URL filters and clamps the page", () => {
    expect(
      parseTalentParams({
        q: "  AI ",
        skills: "AI 开发,产品策略",
        sort: "active",
        page: "-2",
      }),
    ).toEqual({
      q: "AI",
      skills: "AI 开发,产品策略",
      duration: undefined,
      sort: "active",
      page: 1,
    });
  });

  it("stores and clears the browser-only draft", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    saveTalentDraft("user-1", { headline: "产品搭档" }, storage);
    expect(loadTalentDraft("user-1", storage)).toEqual({
      headline: "产品搭档",
    });
    expect(loadTalentDraft("user-2", storage)).toBeNull();
    clearTalentDraft("user-1", storage);
    expect(values.has(talentDraftKey("user-1"))).toBe(false);
  });

  it("rejects malformed drafts instead of loading arbitrary values", () => {
    const values = new Map([
      [talentDraftKey("user-1"), JSON.stringify({ headline: 42 })],
    ]);
    expect(
      loadTalentDraft("user-1", { getItem: (key) => values.get(key) ?? null }),
    ).toBeNull();
  });

  it("drops stale v1 draft keys such as roles", () => {
    const values = new Map([
      [
        talentDraftKey("user-1"),
        JSON.stringify({ headline: "旧草稿", roles: ["产品"], skills: ["frontend"] }),
      ],
    ]);
    expect(
      loadTalentDraft("user-1", { getItem: (key) => values.get(key) ?? null }),
    ).toEqual({ headline: "旧草稿", skills: ["frontend"] });
  });

  it("enforces the backend profile ranges", () => {
    const errors = validateTalentBody({
      headline: "x",
      bio: "short",
      links: [],
      skills: [],
      seekingSkills: [],
      domains: [],
      durations: [],
      availability: -1,
    });
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        "headline",
        "bio",
        "skills",
        "domains",
        "durations",
        "availability",
      ]),
    );
    expect(errors.bioOrLinks).toBeUndefined();
  });

  it("accepts bio alone, links alone, but rejects neither; enforces dual-state and url rules", () => {
    const bio = "这是一段足够长的人才档案介绍，用于描述合作方式和经验，满足最少三十个字符。";
    expect(
      validateTalentBody({
        headline: "四字以上的介绍",
        bio,
        links: [],
        skills: ["frontend", "backend", "fullstack"],
        seekingSkills: [],
        domains: ["效率工具"],
        durations: ["长期合作"],
        availability: 0,
      }),
    ).toEqual({});
    expect(
      validateTalentBody({
        headline: "四字以上的介绍",
        bio: undefined,
        links: ["https://github.com/me", "ftp://bad.example.com"],
        skills: ["frontend", "backend", "fullstack"],
        seekingSkills: ["backend"],
        domains: ["效率工具"],
        durations: ["长期合作"],
        availability: 2,
      }),
    ).toEqual({
      links: "链接必须是正确的 http(s) 地址",
      seekingSkills: "同一技能不能同时处于两个状态",
    });
    expect(
      validateTalentBody({
        headline: "四字以上的介绍",
        bio: "短",
        links: ["https://a.com/1", "https://a.com/2", "https://a.com/3", "https://a.com/4"],
        skills: ["frontend", "backend", "fullstack"],
        seekingSkills: [],
        domains: ["效率工具"],
        durations: ["长期合作"],
        availability: 1,
      }),
    ).toEqual({
      bio: "关于我请输入 30-500 个字符",
      links: "最多添加 3 个链接",
    });
  });

  it("validates connection purpose, message length, and contacts", () => {
    expect(
      validateConnectionBody({ purpose: "自由文本", message: "too short" }),
    ).toEqual({
      purpose: "请选择交流方向",
      message: "留言请输入 30-500 个字符",
      contact: "至少提供微信或邮箱",
    });
  });
});
