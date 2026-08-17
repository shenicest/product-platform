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
      role: undefined,
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

  it("enforces the backend profile ranges", () => {
    const errors = validateTalentBody({
      headline: "x",
      bio: "short",
      roles: [],
      skills: [],
      seekingSkills: [],
      domains: [],
      durations: [],
    });
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        "headline",
        "bio",
        "roles",
        "skills",
        "domains",
        "durations",
      ]),
    );
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
