'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CATEGORIES,
  MAX_SEEKING_SKILLS,
  ProjectStage,
  TALENT_SKILL_GROUPS,
  skillLabel,
} from '@shenicest/shared'
import { useAuth } from '@/components/auth-provider'
import {
  createProject,
  saveDraft,
  submitForReview,
} from '@/lib/client-api'
import {
  firstProjectFormError,
  validateProjectForm,
  type ProjectFormErrors,
  type ProjectFormValues,
} from '@/lib/project-form-validation'
import { Button, ButtonLink } from '@/components/ui/button'
import { ChipButton } from '@/components/ui/chip'
import { Panel } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import { projectIdLabel } from '@/lib/utils'
import { ImageUploader } from './image-uploader'
import {
  CheckboxInput,
  FieldLabel,
  FormField,
  FormSection,
  SelectInput,
  TextArea,
  TextInput,
} from './form-fields'

type FormState = ProjectFormValues

const EMPTY_FORM: FormState = {
  name: '',
  tagline: '',
  teamName: '',
  categories: [],
  stage: '',
  problemStatement: '',
  differentiation: '',
  nextSteps: '',
  userCount: '',
  monthlyRevenue: '',
  retentionRate: '',
  businessModel: '',
  progress: '',
  coverUrl: '',
  demoImages: [],
  demoVideoUrl: '',
  demoLink: '',
  seekingSkills: [],
  isOpenForBeta: false,
  betaDescription: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  contactWechat: '',
}

type FormErrors = ProjectFormErrors

function emptyToNullNumber(value: string): number | null {
  return value === '' ? null : Number(value)
}

function toApiBody(form: FormState): Record<string, unknown> {
  return {
    ...form,
    stage: emptyToNullNumber(form.stage),
    userCount: emptyToNullNumber(form.userCount),
    monthlyRevenue: emptyToNullNumber(form.monthlyRevenue),
    retentionRate: emptyToNullNumber(form.retentionRate),
  }
}

function fromProjectData(project: Record<string, unknown>): FormState {
  const traction = (value: unknown) => (value === null || value === undefined ? '' : String(value))
  return {
    name: (project.name as string) ?? '',
    tagline: (project.tagline as string) ?? '',
    teamName: (project.teamName as string) ?? '',
    categories: (project.categories as string[]) ?? [],
    stage: project.stage !== null && project.stage !== undefined ? String(project.stage) : '',
    problemStatement: (project.problemStatement as string) ?? '',
    differentiation: (project.differentiation as string) ?? '',
    nextSteps: (project.nextSteps as string) ?? '',
    userCount: traction(project.userCount),
    monthlyRevenue: traction(project.monthlyRevenue),
    retentionRate: traction(project.retentionRate),
    businessModel: (project.businessModel as string) ?? '',
    progress: (project.progress as string) ?? '',
    coverUrl: (project.coverUrl as string) ?? '',
    demoImages: Array.isArray(project.demoImages) ? (project.demoImages as string[]) : [],
    demoVideoUrl: (project.demoVideoUrl as string) ?? '',
    demoLink: (project.demoLink as string) ?? '',
    seekingSkills: Array.isArray(project.seekingSkills) ? (project.seekingSkills as string[]) : [],
    isOpenForBeta: (project.isOpenForBeta as boolean) ?? false,
    betaDescription: (project.betaDescription as string) ?? '',
    contactName: (project.contactName as string) ?? '',
    contactPhone: (project.contactPhone as string) ?? '',
    contactEmail: (project.contactEmail as string) ?? '',
    contactWechat: (project.contactWechat as string) ?? '',
  }
}

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((c) => c !== value)
    : [...current, value]
}

const STAGE_OPTIONS = [
  { value: String(ProjectStage.Idea), label: '想法验证' },
  { value: String(ProjectStage.Prototype), label: '原型' },
  { value: String(ProjectStage.Mvp), label: 'MVP' },
  { value: String(ProjectStage.Launched), label: '已上线有用户' },
  { value: String(ProjectStage.Revenue), label: '有收入' },
]

// Seeking-skills wall, revealed by the「正在寻找的角色」checkbox like the Beta
// recruitment flow: tick the box first, then the grouped skill wall expands.
// Selected values are enum keys from the shared vocabulary; chips display
// their labels. Capped at MAX_SEEKING_SKILLS across all directions.
function SeekingSkillsWall({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (skills: string[]) => void
}) {
  const full = selected.length >= MAX_SEEKING_SKILLS
  function toggle(skill: string) {
    onChange(toggleValue(selected, skill))
  }
  return (
    <div id="seekingSkills" tabIndex={-1} className="divide-y divide-border-soft border-y border-border">
      {TALENT_SKILL_GROUPS.map((group) => (
        <div key={group.direction} className="grid gap-3 py-4 sm:grid-cols-[96px_1fr] sm:items-start">
          <span className="pt-1 font-mono text-meta font-bold text-brand-text">{group.direction}</span>
          <div className="flex flex-wrap gap-2">
            {group.skills.map((skill) => {
              const isSelected = selected.includes(skill)
              return (
                <ChipButton
                  key={skill}
                  aria-pressed={isSelected}
                  disabled={!isSelected && full}
                  onClick={() => toggle(skill)}
                  tone={isSelected ? 'accent' : 'neutral'}
                  dot={isSelected}
                  className="disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {skillLabel(skill)}
                </ChipButton>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function focusFirstError(errors: FormErrors) {
  const field = firstProjectFormError(errors)
  if (!field) return
  requestAnimationFrame(() => document.getElementById(field)?.focus())
}

export function ProjectSubmissionForm({
  projectId,
  initialData,
  initialNickname,
  serverAuthenticated = false,
}: {
  projectId?: number
  initialData?: Record<string, unknown>
  /**
   * The account nickname, resolved on the server by the page that renders this
   * form. Passing it in is what lets the contact-name prefill be part of the
   * server-rendered markup instead of arriving after hydration — a static
   * snapshot of the page would otherwise capture an empty contact field.
   */
  initialNickname?: string | null
  /**
   * Set by pages that already verified the session server-side. Without it the
   * form has to wait for `useAuth` to resolve before deciding whether to show
   * the login prompt, which is again invisible to a static snapshot.
   */
  serverAuthenticated?: boolean
}) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  // The page may already have proven the session server-side; trust that over
  // the client fetch, which resolves one render later.
  const authenticated = serverAuthenticated || isAuthenticated

  // Prefill happens here, not in a post-mount effect, when the nickname came
  // from the server: that puts the value straight into the rendered markup.
  // Only the client-only path — no server nickname — falls back to adjusting
  // state during render once `useAuth` resolves (see below).
  const initialForm: FormState = (() => {
    const base = initialData ? fromProjectData(initialData) : EMPTY_FORM
    if (!initialData && initialNickname && base.contactName.trim() === '') {
      return { ...base, contactName: initialNickname }
    }
    return base
  })()
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedProjectId, setSavedProjectId] = useState<number | null>(projectId ?? null)
  const [submittedProjectId, setSubmittedProjectId] = useState<number | null>(null)

  // contactName is prefilled from the account nickname only when creating a new
  // project — an existing draft's value is never overwritten. `undefined` means
  // "no prefill attempt yet"; `null` means "attempted, nothing to apply".
  const [prefilledNickname, setPrefilledNickname] = useState<string | null | undefined>(
    initialData ? null : initialNickname !== undefined ? initialNickname : undefined,
  )
  const nickname = user?.nickname ?? null
  if (prefilledNickname === undefined && nickname !== null) {
    setPrefilledNickname(nickname)
    if (nickname !== '') {
      setForm((prev) => ({ ...prev, contactName: prev.contactName.trim() === '' ? nickname : prev.contactName }))
    }
  }

  // 「正在寻找的角色」works like the Beta checkbox: the wall is hidden until the
  // Founder ticks the box; unticking clears the selection. Existing drafts with
  // skills start expanded so the saved choices stay visible and editable.
  const [showSeekingSkills, setShowSeekingSkills] = useState(initialForm.seekingSkills.length > 0)

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
      setServerError(null)
    },
    [],
  )

  function updateSeekingSkills(skills: string[]) {
    update('seekingSkills', skills)
  }
  function toggleShowSeekingSkills(checked: boolean) {
    setShowSeekingSkills(checked)
    if (!checked) updateSeekingSkills([])
  }

  const handleSaveDraft = useCallback(async () => {
    if (!form.name.trim()) {
      const error = '请先填写项目名称'
      setErrors({ name: error })
      focusFirstError({ name: error })
      return
    }
    setSaving(true)
    setServerError(null)
    try {
      const body = toApiBody(form)
      if (savedProjectId) {
        const { data, error } = await saveDraft(savedProjectId, body)
        if (error) {
          setServerError(error.body.error.message)
          return
        }
        if (data) setSavedProjectId(data.id)
      } else {
        const { data, error } = await createProject(body)
        if (error) {
          setServerError(error.body.error.message)
          return
        }
        if (data) {
          setSavedProjectId(data.id)
          router.replace(`/projects/${data.id}/edit`)
        }
      }
    } finally {
      setSaving(false)
    }
  }, [form, savedProjectId, router])

  const handleSubmit = useCallback(async () => {
    const clientErrors = validateProjectForm(form)
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      focusFirstError(clientErrors)
      return
    }
    setSubmitting(true)
    setServerError(null)
    try {
      const body = toApiBody(form)
      let id = savedProjectId
      if (!id) {
        const { data, error } = await createProject(body)
        if (error) {
          if (error.body.error.field) {
            const fieldErrors = { [error.body.error.field as keyof FormState]: error.body.error.message }
            setErrors(fieldErrors)
            focusFirstError(fieldErrors)
          } else {
            setServerError(error.body.error.message)
          }
          return
        }
        id = data!.id
        setSavedProjectId(id)
      } else {
        const { error: draftError } = await saveDraft(id, body)
        if (draftError) {
          setServerError(draftError.body.error.message)
          return
        }
      }

      const { data, error } = await submitForReview(id)
      if (error) {
        if (error.status === 422 && error.body.error.field) {
          const fieldErrors = { [error.body.error.field as keyof FormState]: error.body.error.message }
          setErrors(fieldErrors)
          focusFirstError(fieldErrors)
        } else {
          setServerError(error.body.error.message)
        }
        return
      }
      if (data) setSubmittedProjectId(data.id)
    } finally {
      setSubmitting(false)
    }
  }, [form, savedProjectId])

  if (!authenticated) {
    return (
      <Panel className="flex flex-col items-center gap-4 text-center">
        <Eyebrow tone="accent">AUTH REQUIRED</Eyebrow>
        <p className="text-body text-muted-foreground">请先登录后再提交项目。</p>
        <ButtonLink href="/login" variant="primary" className="mt-2">
          去登录 <span className="ui-btn__arrow" aria-hidden>→</span>
        </ButtonLink>
      </Panel>
    )
  }

  if (submittedProjectId) {
    return (
      <Panel className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <Eyebrow tone="accent">SUBMISSION / PENDING REVIEW</Eyebrow>
        <h2 className="m-0 text-[clamp(28px,4vw,40px)] font-black leading-[1.1]">正在审核中</h2>
        <p className="m-0 max-w-[48ch] text-body leading-[1.7] text-muted-foreground">
          你的项目已提交审核。审核通过后将在平台公开展示，我们会尽快处理。
        </p>
        <ButtonLink href="/founder/dashboard" variant="primary" className="mt-4">
          查看我的项目 <span className="ui-btn__arrow" aria-hidden>→</span>
        </ButtonLink>
      </Panel>
    )
  }

  return (
    <div className="space-y-6">
      {/* 提交状态的活区播报：视觉上按钮文字已足够，这里给读屏用户一份完整描述。 */}
      <p className="sr-only" role="status" aria-live="polite">
        {saving ? '正在保存草稿' : submitting ? '正在提交审核' : ''}
      </p>

      {serverError ? (
        <div className="ui-note ui-note--danger" role="alert">
          {/* 不要用 .mono：它自带 color，会盖掉 .ui-note--danger 的 danger-text。 */}
          <span className="shrink-0 font-mono text-meta font-bold">ERROR /</span>
          <span className="min-w-0 break-words">{serverError}</span>
        </div>
      ) : null}

      <FormSection index={1} title="项目速览">
        <FormField label="项目名称" htmlFor="name" required error={errors.name}>
          <TextInput
            id="name"
            name="name"
            value={form.name}
            onChange={(v) => update('name', v)}
            placeholder="项目名称（2-30 个汉字，或 2-60 个字符）"
            required
            maxLength={60}
            error={errors.name}
          />
        </FormField>
        <FormField
          label="团队名称"
          htmlFor="teamName"
          hint="选填。个人项目可以留空，展示时优先使用创始人昵称。"
        >
          <TextInput
            id="teamName"
            name="teamName"
            value={form.teamName}
            onChange={(v) => update('teamName', v)}
            placeholder="你的团队或公司名称"
          />
        </FormField>
        <FormField label="一句话介绍" htmlFor="tagline" required error={errors.tagline}>
          <TextInput
            id="tagline"
            name="tagline"
            value={form.tagline}
            onChange={(v) => update('tagline', v)}
            placeholder="用一句话描述项目（4-50 个字符）"
            required
            maxLength={50}
            error={errors.tagline}
          />
        </FormField>
        <FormField label="分类" htmlFor="categories" required error={errors.categories} group>
          <div id="categories" tabIndex={-1} className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isSelected = form.categories.includes(cat)
              return (
                <ChipButton
                  key={cat}
                  onClick={() => update('categories', toggleValue(form.categories, cat))}
                  aria-pressed={isSelected}
                  tone={isSelected ? 'accent' : 'neutral'}
                  dot={isSelected}
                >
                  {cat}
                </ChipButton>
              )
            })}
          </div>
        </FormField>
        <FormField label="产品阶段" htmlFor="stage" required error={errors.stage}>
          <SelectInput
            id="stage"
            name="stage"
            value={form.stage}
            onChange={(v) => update('stage', v)}
            options={STAGE_OPTIONS}
            placeholder="选择产品阶段"
            error={errors.stage}
          />
        </FormField>
      </FormSection>

      <FormSection index={2} title="项目故事">
        <FormField
          label="为谁解决什么问题"
          htmlFor="problemStatement"
          required
          error={errors.problemStatement}
          hint="谁在用你的产品？他们的什么问题被解决了？（30-300 字）"
        >
          <TextArea
            id="problemStatement"
            name="problemStatement"
            value={form.problemStatement}
            onChange={(v) => update('problemStatement', v)}
            placeholder="描述你的目标用户与解决的问题，例如「自由职业者需要自己处理合同、收款与报税……」"
            rows={4}
            maxLength={300}
            required
            error={errors.problemStatement}
          />
        </FormField>
        <FormField
          label="差异化"
          htmlFor="differentiation"
          hint="选填。和现有方案有什么不同？（≤100 字）"
          error={errors.differentiation}
        >
          <TextInput
            id="differentiation"
            name="differentiation"
            value={form.differentiation}
            onChange={(v) => update('differentiation', v)}
            placeholder="一句话说明与现有方案的差异"
            maxLength={100}
            error={errors.differentiation}
          />
        </FormField>
      </FormSection>

      <FormSection index={3} title="进展与前景">
        <FormField
          label="下一步计划"
          htmlFor="nextSteps"
          required
          error={errors.nextSteps}
          hint="接下来准备做什么？（≤300 字）"
        >
          <TextArea
            id="nextSteps"
            name="nextSteps"
            value={form.nextSteps}
            onChange={(v) => update('nextSteps', v)}
            placeholder="描述项目接下来的计划"
            rows={3}
            maxLength={300}
            required
            error={errors.nextSteps}
          />
        </FormField>
        <FormField
          label="数据亮点"
          htmlFor="userCount"
          hint="选填。已有数据可以填写；早期项目可以全部留空。"
          error={errors.userCount ?? errors.monthlyRevenue ?? errors.retentionRate}
          group
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <FieldLabel htmlFor="userCount">用户量</FieldLabel>
              <TextInput
                id="userCount"
                name="userCount"
                value={form.userCount}
                onChange={(v) => update('userCount', v)}
                placeholder="人数"
                type="number"
                min={0}
                error={errors.userCount}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="monthlyRevenue">月收入</FieldLabel>
              <TextInput
                id="monthlyRevenue"
                name="monthlyRevenue"
                value={form.monthlyRevenue}
                onChange={(v) => update('monthlyRevenue', v)}
                placeholder="元/月"
                type="number"
                min={0}
                error={errors.monthlyRevenue}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="retentionRate">30 日留存</FieldLabel>
              <TextInput
                id="retentionRate"
                name="retentionRate"
                value={form.retentionRate}
                onChange={(v) => update('retentionRate', v)}
                placeholder="%"
                type="number"
                min={0}
                max={100}
                error={errors.retentionRate}
              />
            </div>
          </div>
        </FormField>
        <FormField
          label="商业模式"
          htmlFor="businessModel"
          hint="选填。怎么赚钱？早期项目可以暂时没有答案。（≤200 字）"
          error={errors.businessModel}
        >
          <TextArea
            id="businessModel"
            name="businessModel"
            value={form.businessModel}
            onChange={(v) => update('businessModel', v)}
            placeholder="描述你的收入模式"
            rows={2}
            maxLength={200}
            error={errors.businessModel}
          />
        </FormField>
        <FormField
          label="当前进展"
          htmlFor="progress"
          hint="选填。产品阶段已经体现整体位置，这里补充细节。（≤300 字）"
          error={errors.progress}
        >
          <TextArea
            id="progress"
            name="progress"
            value={form.progress}
            onChange={(v) => update('progress', v)}
            placeholder="目前项目进展到了什么阶段？"
            rows={2}
            maxLength={300}
            error={errors.progress}
          />
        </FormField>
      </FormSection>

      <FormSection index={4} title="展示资料">
        <FormField label="封面图" htmlFor="coverUrl" required error={errors.coverUrl}>
          <ImageUploader
            id="coverUrl"
            value={form.coverUrl ? [form.coverUrl] : []}
            onChange={(urls) => update('coverUrl', urls[0] ?? '')}
          />
        </FormField>
        <FormField
          label="演示截图"
          htmlFor="demoImages"
          error={errors.demoImages}
          hint="选填，最多 5 张。"
        >
          <ImageUploader
            id="demoImages"
            multiple
            max={5}
            value={form.demoImages}
            onChange={(urls) => update('demoImages', urls)}
          />
        </FormField>
        <FormField
          label="产品链接"
          htmlFor="demoLink"
          hint="选填。产品主页或 Demo 地址。"
          error={errors.demoLink}
        >
          <TextInput
            id="demoLink"
            name="demoLink"
            value={form.demoLink}
            onChange={(v) => update('demoLink', v)}
            placeholder="须为 http:// 或 https:// 地址"
            type="url"
            error={errors.demoLink}
          />
        </FormField>
        <FormField
          label="视频链接"
          htmlFor="demoVideoUrl"
          hint="选填。B站/YouTube 等平台的视频链接，直接粘贴 URL 即可。"
          error={errors.demoVideoUrl}
        >
          <TextInput
            id="demoVideoUrl"
            name="demoVideoUrl"
            value={form.demoVideoUrl}
            onChange={(v) => update('demoVideoUrl', v)}
            placeholder="须为 http:// 或 https:// 地址"
            type="url"
            error={errors.demoVideoUrl}
          />
        </FormField>
      </FormSection>

      <FormSection index={5} title="招募与合作">
        <CheckboxInput
          id="isOpenForBeta"
          name="isOpenForBeta"
          checked={form.isOpenForBeta}
          onChange={(v) => update('isOpenForBeta', v)}
        >
          正在招募 Beta 测试用户
        </CheckboxInput>
        {form.isOpenForBeta ? (
          <FormField label="Beta 说明" htmlFor="betaDescription" required error={errors.betaDescription}>
            <TextArea
              id="betaDescription"
              name="betaDescription"
              value={form.betaDescription}
              onChange={(v) => update('betaDescription', v)}
              placeholder="描述你的 Beta 测试计划"
              rows={3}
              required
              error={errors.betaDescription}
            />
          </FormField>
        ) : null}
        <CheckboxInput
          id="seekingSkillsToggle"
          name="seekingSkillsToggle"
          checked={showSeekingSkills}
          onChange={toggleShowSeekingSkills}
        >
          正在寻找的角色
        </CheckboxInput>
        {showSeekingSkills ? (
          <FormField
            label="想找的具体技能"
            htmlFor="seekingSkills"
            hint={`选填。最多 ${MAX_SEEKING_SKILLS} 个技能标签，便于与广场上相关能力的人对接。`}
            error={errors.seekingSkills}
            group
          >
            <SeekingSkillsWall
              selected={form.seekingSkills}
              onChange={updateSeekingSkills}
            />
          </FormField>
        ) : null}
      </FormSection>

      <FormSection index={6} title="联系方式">
        <FormField
          label="联系人姓名"
          htmlFor="contactName"
          required
          error={errors.contactName}
        >
          <TextInput
            id="contactName"
            name="contactName"
            value={form.contactName}
            onChange={(v) => update('contactName', v)}
            placeholder="你的名字"
            required
            error={errors.contactName}
          />
        </FormField>
        <FormField
          label="电话 / 邮箱 / 微信（至少填写一项）"
          htmlFor="contactPhone"
          error={errors.contactPhone ?? errors.contactEmail ?? errors.contactWechat}
          hint="联系方式仅平台与运营可见，不会公开展示。"
          group
        >
          <div className="grid gap-3">
            <div className="space-y-1">
              <FieldLabel htmlFor="contactPhone">电话</FieldLabel>
              <TextInput
                id="contactPhone"
                name="contactPhone"
                value={form.contactPhone}
                onChange={(v) => update('contactPhone', v)}
                placeholder="联系电话（含国家/地区码亦可）"
                error={errors.contactPhone}
              />
            </div>
            {/*
              组级约束的无障碍处理 —— 请勿「顺手优化」成只有 contactPhone 报错。

              校验规则（project-form-validation.ts）是「电话/邮箱/微信至少填一项」，
              失败时只把错误挂在 contactPhone 上（沿用后端「报在第一个渠道」的契约）。
              但 aria-invalid 描述的是「这个字段当前不满足表单约束」，而不是
              「这个字段自己产出了错误消息」：三种渠道全空时，电话、邮箱、微信
              三个字段确实都处于不合法状态，只标第一个会让读屏用户以为填了邮箱
              就够了。因此 email / wechat 也显式传 invalid，三者共享同一条
              aria-describedby（组级错误文案）。

              注意：这只是 aria 标记，不参与校验、不影响提交逻辑，
              也没有改动 project-form-validation.ts 的一行代码。
            */}
            <div className="space-y-1">
              <FieldLabel htmlFor="contactEmail">邮箱</FieldLabel>
              <TextInput
                id="contactEmail"
                name="contactEmail"
                value={form.contactEmail}
                onChange={(v) => update('contactEmail', v)}
                placeholder="联系邮箱，例如 you@example.com"
                type="email"
                error={errors.contactEmail}
                invalid={Boolean(errors.contactPhone)}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="contactWechat">微信</FieldLabel>
              <TextInput
                id="contactWechat"
                name="contactWechat"
                value={form.contactWechat}
                onChange={(v) => update('contactWechat', v)}
                placeholder="微信号"
                error={errors.contactWechat}
                invalid={Boolean(errors.contactPhone)}
              />
            </div>
          </div>
        </FormField>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button
          variant="ghost"
          onClick={handleSaveDraft}
          disabled={saving || submitting}
        >
          {saving ? '保存中...' : '保存草稿'}
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={saving || submitting}
        >
          {submitting ? '提交中...' : '提交审核'} <span className="ui-btn__arrow" aria-hidden>→</span>
        </Button>
        {savedProjectId ? (
          <span className="mono">DRAFT ID: {projectIdLabel(savedProjectId)}</span>
        ) : null}
      </div>
    </div>
  )
}
