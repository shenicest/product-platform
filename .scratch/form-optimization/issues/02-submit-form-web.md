# 02 — 提交表单 v2：Web 提交/编辑体验

**What to build:** 创始人打开 `/submit`（或编辑草稿/被退回项目）看到按「速览 → 故事 → 前景 → 展示 → 招募 → 联系」重排的 6 板块表单，可填写并提交全部新字段；校验反馈按新规则工作。提交成功进入审核中的体验不变。

**Blocked by:** 01 — 项目表单 v2：数据契约与后端

**Status:** DONE. 6 板块表单重排完成（速览/故事/前景/展示/招募/联系）；validation v2（tagline 4-50、problemStatement 30-300 等）；VideoUploader 删除改 http(s) 链接输入；TALENT_SKILL_GROUPS 迁入 shared 供技能分组墙（≤5）；contactName 预填账号昵称（新增 API `GET /founder/profile` + `/api/me` 聚合 nickname/avatarUrl，仅新建时预填）；422 映射回字段；草稿/提交/退回回显流程不变。api 363/363、web 242/242、两端 typecheck、lint、build 全绿。

- [ ] 表单重排为 6 板块：① 项目速览（name*、tagline*、categories*、stage* 五档下拉）② 项目故事（problemStatement* 30-300、differentiation ≤100）③ 进展与前景（nextSteps* ≤300、traction 三数字框、businessModel ≤200、progress ≤300）④ 展示资料（coverUrl*、demoImages ≤5、demoLink、视频链接输入）⑤ 招募与合作（Beta 勾选+betaDescription、seekingSkills 分组墙 ≤5）⑥ 联系方式（contactName* 预填账号昵称、三列联系方式至少一个）
- [ ] tagline 规则改为 4-50 字符；problemStatement 30-300；其余长度按板块说明
- [ ] 视频上传组件替换为 http(s) 链接输入（不再上传文件）
- [ ] seekingSkills 使用按大类分组的标签墙（复用 TALENT_SKILL_GROUPS 结构），上限 5
- [ ] contactName 初次渲染预填登录用户昵称（可编辑；账号无昵称则留空）
- [ ] 提交时前端校验：必填集与 01 票后端一致；contactPhone/Email/Wechat 至少一个非空且 email 格式合法；422 响应映射回对应字段
- [ ] 草稿保存、提交审核、RevisionRequired 编辑回显（含运营意见）流程不退化
- [ ] `project-form-validation` 与表单组件的 web 测试更新全绿

**Implementation notes:**
- 板块字段与必填性见 `产品平台表单优化方案.md` §2.4 与 ADR-0012；术语以 CONTEXT.md 为准
- 表单状态键与 toApiBody 映射随新字段改名/增删；空 traction 字段传 null
- 头像/昵称来源：AuthProvider 持有的用户资料；预填仅在新建（无 initialData）时发生，不回填已有草稿
