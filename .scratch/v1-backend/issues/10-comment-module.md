# 10 — Comment submission + viewing API

**What to build:** APIs for users to submit comments on projects and for Founders/operators to view them. Comments are NOT publicly displayed in 1.0 — only visible to the project's Founder and operators. Machine-based content review runs asynchronously and sets `is_flagged` on violations. A user can submit multiple comments on the same project.

**Blocked by:** 02 — Auth plugin, 04 — Project + ProjectRevision schema + core service

**Status:** ready-for-agent

- [ ] `comments` table: `id`, `project_id`, `user_id`, `comment_type` (varchar: issue_report, feature_suggestion, usage_feedback, other), `content` (text, max 500 chars), `can_contact` (boolean), `contact_info` (varchar, nullable), `is_flagged` (boolean, default false), `created_at`
- [ ] POST /projects/:id/comments: submit a comment (auth required)
- [ ] Validates: content required, max 500 chars, comment_type is valid enum, contact_info required when can_contact=true
- [ ] Comments can only be submitted on Live projects
- [ ] GET /founder/projects/:id/comments: Founder views comments on own project (auth + founder role)
- [ ] GET /operator/projects/:id/comments: Operator views comments on any project (auth + operator role)
- [ ] Comment list includes: type, content, can_contact, contact_info, is_flagged, created_at, commenter nickname
- [ ] Tests cover: submit comment, validation rules, submit on non-Live project rejected, founder sees own project comments, operator sees any, regular user cannot view comments
