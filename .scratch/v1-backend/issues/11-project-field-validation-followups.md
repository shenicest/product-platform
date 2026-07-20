# 11 — Project field validation follow-ups (PRD gaps surfaced by issue 05)

**What to build:** Close the gaps between the Feishu PRD (§3.2 项目提交) and the issue-04 `projects` schema that issue 05's submission validation could not cover. Issue 05 validates required-field *presence* only (first missing field). These items add the missing column, the PRD's format/length rules, and category-enum enforcement.

**Blocked by:** 04 — Project + ProjectEditProposal schema + core service, 05 — Project submission

**Status:** ready-for-agent

- [ ] 项目形态 (project form): PRD §3.2 requires it (硬件 / 软件 / 软硬件结合, single-select, 必填) but the `projects` schema has **no column**. Add a `form` (tinyint) column + migration, then add it to `EDITABLE_PROJECT_FIELDS` and `SUBMISSION_REQUIRED_FIELDS` so create/draft bodies accept it and submit validates it.
- [ ] Per-field length/format validation from PRD §3.2 — name 2-30 中文字符 (或 2-60 英文字符), 一句话介绍/tagline 10-40 中文字符, 项目介绍/description 100-2000 字, 目标用户·用户问题·当前进展 20-500 字, 下一步计划 ≤500 字. ⚠️ **Needs product clarification first:** the Chinese-vs-English char-counting rules are ambiguous (how to count mixed-language input?). Apply on the create/draft body schema and/or in submit validation.
- [ ] Category enum validation: restrict `categories` to a fixed set. ⚠️ **Reconcile the set first** — CONTEXT.md (女性健康, 效率工具, 教育学习, 开发者工具, 生活方式, 其他) and PRD §3.2 (女性健康, 效率工具, 教育, 创作者工具, 其他; AI硬件/AI软件 已划掉) differ. Confirm the authoritative enum with product, then enforce it on the create/draft body.

**Notes:**
- Current required-field set lives in `SUBMISSION_REQUIRED_FIELDS` (`src/modules/project/model.ts`), derived from PRD §3.2, presence-only.
- 项目形态 was excluded from issue 05 only because no column exists — submission currently cannot validate it.
- These were deliberately deferred from issue 05 (scope = build on the issue-04 schema + presence validation), not overlooked.
