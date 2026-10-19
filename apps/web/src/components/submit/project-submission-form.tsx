'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES, MAX_SEEKING_SKILLS, ProjectStage, TALENT_SKILL_GROUPS } from '@shenicest/shared'
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
import { ImageUploader } from './image-uploader'
import {
  CheckboxInput,
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

// Skill wall grouped by top-level direction (shared vocabulary), capped at MAX_SEEKING_SKILLS.
function SeekingSkillsWall({
  selected,
  onChange,
  error,
}: {
  selected: string[]
  onChange: (skills: string[]) => void
  error?: string
}) {
  const full = selected.length >= MAX_SEEKING_SKILLS
  function toggle(skill: string) {
    onChange(toggleValue(selected, skill))
  }
  return (
    <div id="seekingSkills" tabIndex={-1} className="divide-y divide-border border-y border-border">
      {TALENT_SKILL_GROUPS.map((group) => (
        <div key={group.direction} className="grid gap-3 py-4 sm:grid-cols-[96px_1fr] sm:items-start">
          <span className="pt-1 font-mono text-xs font-bold text-primary">{group.direction}</span>
          <div className="flex flex-wrap gap-2">
            {group.skills.map((skill) => {
              const isSelected = selected.includes(skill)
              return (
                <button
                  key={skill}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={!isSelected && full}
                  onClick={() => toggle(skill)}
                  className={`chip-hard cursor-pointer disabled:cursor-not-allowed ${
                    isSelected ? 'chip-active' : ''
                  }`}
                >
                  {skill}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {error ? <p className="mt-1 font-mono text-[11px] text-destructive">{error}</p> : null}
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
}: {
  projectId?: number
  initialData?: Record<string, unknown>
}) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const initialForm = initialData ? fromProjectData(initialData) : EMPTY_FORM
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedProjectId, setSavedProjectId] = useState<number | null>(projectId ?? null)
  const [submittedProjectId, setSubmittedProjectId] = useState<number | null>(null)

  // contactName is prefilled from the account nickname only when creating a new
  // project — an existing draft's value is never overwritten. The profile
  // arrives async after mount, so the prefill adjusts state during render,
  // guarded to run at most once and to keep whatever the Founder already typed.
  const [prefilledNickname, setPrefilledNickname] = useState<string | null | undefined>(
    initialData ? null : undefined,
  )
  const nickname = user?.nickname ?? null
  if (prefilledNickname === undefined && nickname !== null) {
    setPrefilledNickname(nickname)
    if (nickname !== '') {
      setForm((prev) => ({ ...prev, contactName: prev.contactName.trim() === '' ? nickname : prev.contactName }))
    }
  }

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
      setServerError(null)
    },
    [],
  )

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

  if (!isAuthenticated) {
    return (
      <div className="border border-border bg-card p-8 text-center">
        <p className="eyebrow">AUTH REQUIRED</p>
        <p className="mt-4 text-base text-muted-foreground">
          请先登录后再提交项目。
        </p>
        <div className="mx-auto mt-6 max-w-md">
          <Link href="/login" className="btn-hard btn-primary inline-flex">
            去登录
          </Link>
        </div>
      </div>
    )
  }

  if (submittedProjectId) {
    return (
      <div className="border border-border bg-card p-8 text-center sm:p-12">
        <p className="eyebrow">SUBMISSION / PENDING REVIEW</p>
        <h2 className="mt-3 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1]">
          正在审核中
        </h2>
        <p className="mx-auto mt-4 max-w-[48ch] text-base leading-[1.7] text-muted-foreground">
          你的项目已提交审核。审核通过后将在平台公开展示，我们会尽快处理。
        </p>
        <Link href="/founder/dashboard" className="btn-hard btn-primary mt-8 inline-flex">
          查看我的项目 <span aria-hidden>→</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {serverError ? (
        <div className="border-2 border-destructive bg-card p-4">
          <p className="font-mono text-xs tracking-[0.08em] text-destructive">
            ERROR / {serverError}
          </p>
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
        <FormField label="分类" htmlFor="categories" required error={errors.categories}>
          <div id="categories" tabIndex={-1} className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => update('categories', toggleValue(form.categories, cat))}
                aria-pressed={form.categories.includes(cat)}
                className={`chip-hard cursor-pointer transition-colors ${
                  form.categories.includes(cat) ? 'chip-active' : 'hover:border-primary/60'
                }`}
              >
                {form.categories.includes(cat) ? <i aria-hidden /> : null}
                {cat}
              </button>
            ))}
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
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabelSub htmlFor="userCount">用户量</FieldLabelSub>
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
            <div>
              <FieldLabelSub htmlFor="monthlyRevenue">月收入</FieldLabelSub>
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
            <div>
              <FieldLabelSub htmlFor="retentionRate">30 日留存</FieldLabelSub>
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
        <FormField
          label="正在寻找的角色"
          htmlFor="seekingSkills"
          hint={`选填。最多 ${MAX_SEEKING_SKILLS} 个技能标签，便于与广场上相关能力的人对接。`}
        >
          <SeekingSkillsWall
            selected={form.seekingSkills}
            onChange={(skills) => update('seekingSkills', skills)}
            error={errors.seekingSkills}
          />
        </FormField>
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
          error={errors.contactPhone}
          hint="联系方式仅平台与运营可见，不会公开展示。"
        >
          <div className="space-y-3">
            <TextInput
              id="contactPhone"
              name="contactPhone"
              value={form.contactPhone}
              onChange={(v) => update('contactPhone', v)}
              placeholder="联系电话（含国家/地区码亦可）"
              error={errors.contactPhone}
            />
            <TextInput
              id="contactEmail"
              name="contactEmail"
              value={form.contactEmail}
              onChange={(v) => update('contactEmail', v)}
              placeholder="联系邮箱，例如 you@example.com"
              type="email"
              error={errors.contactEmail}
            />
            <TextInput
              id="contactWechat"
              name="contactWechat"
              value={form.contactWechat}
              onChange={(v) => update('contactWechat', v)}
              placeholder="微信号"
              error={errors.contactWechat}
            />
          </div>
        </FormField>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              className="btn-hard btn-ghost"
            >
              {saving ? '保存中...' : '保存草稿'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || submitting}
              className="btn-hard btn-primary"
            >
              {submitting ? '提交中...' : '提交审核'} <span aria-hidden>→</span>
            </button>
        </>
        {savedProjectId ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            DRAFT ID: P-{String(savedProjectId).padStart(3, '0')}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function FieldLabelSub({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-muted-foreground">
      {children}
    </label>
  )
}
