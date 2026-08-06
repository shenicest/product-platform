'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CATEGORIES, ProjectStage, ProjectStatus } from '@shenicest/shared'
import { useAuth } from '@/components/auth-provider'
import { createProject, saveDraft, submitForReview } from '@/lib/client-api'
import {
  CheckboxInput,
  FormField,
  FormSection,
  SelectInput,
  TextArea,
  TextInput,
} from './form-fields'

interface FormState {
  name: string
  tagline: string
  teamName: string
  categories: string[]
  stage: string
  description: string
  coverUrl: string
  demoImages: string
  demoVideoUrl: string
  demoLink: string
  targetUsers: string
  userProblem: string
  progress: string
  nextSteps: string
  messageToUsers: string
  isOpenForBeta: boolean
  betaDescription: string
  contactName: string
  contactPhone: string
  contactEmail: string
  contactWechat: string
}

const EMPTY_FORM: FormState = {
  name: '',
  tagline: '',
  teamName: '',
  categories: [],
  stage: '',
  description: '',
  coverUrl: '',
  demoImages: '',
  demoVideoUrl: '',
  demoLink: '',
  targetUsers: '',
  userProblem: '',
  progress: '',
  nextSteps: '',
  messageToUsers: '',
  isOpenForBeta: false,
  betaDescription: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  contactWechat: '',
}

type FormErrors = Partial<Record<keyof FormState, string>>

function toApiBody(form: FormState): Record<string, unknown> {
  const body: Record<string, unknown> = { name: form.name }
  if (form.tagline) body.tagline = form.tagline
  if (form.teamName) body.teamName = form.teamName
  if (form.categories.length > 0) body.categories = form.categories
  if (form.stage !== '') body.stage = Number(form.stage)
  if (form.description) body.description = form.description
  if (form.coverUrl) body.coverUrl = form.coverUrl
  if (form.demoImages) {
    body.demoImages = form.demoImages
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (form.demoVideoUrl) body.demoVideoUrl = form.demoVideoUrl
  if (form.demoLink) body.demoLink = form.demoLink
  if (form.targetUsers) body.targetUsers = form.targetUsers
  if (form.userProblem) body.userProblem = form.userProblem
  if (form.progress) body.progress = form.progress
  if (form.nextSteps) body.nextSteps = form.nextSteps
  if (form.messageToUsers) body.messageToUsers = form.messageToUsers
  body.isOpenForBeta = form.isOpenForBeta
  if (form.betaDescription) body.betaDescription = form.betaDescription
  if (form.contactName) body.contactName = form.contactName
  if (form.contactPhone) body.contactPhone = form.contactPhone
  if (form.contactEmail) body.contactEmail = form.contactEmail
  if (form.contactWechat) body.contactWechat = form.contactWechat
  return body
}

function fromProjectData(project: Record<string, unknown>): FormState {
  return {
    name: (project.name as string) ?? '',
    tagline: (project.tagline as string) ?? '',
    teamName: (project.teamName as string) ?? '',
    categories: (project.categories as string[]) ?? [],
    stage: project.stage !== null && project.stage !== undefined ? String(project.stage) : '',
    description: (project.description as string) ?? '',
    coverUrl: (project.coverUrl as string) ?? '',
    demoImages: Array.isArray(project.demoImages) ? (project.demoImages as string[]).join('\n') : '',
    demoVideoUrl: (project.demoVideoUrl as string) ?? '',
    demoLink: (project.demoLink as string) ?? '',
    targetUsers: (project.targetUsers as string) ?? '',
    userProblem: (project.userProblem as string) ?? '',
    progress: (project.progress as string) ?? '',
    nextSteps: (project.nextSteps as string) ?? '',
    messageToUsers: (project.messageToUsers as string) ?? '',
    isOpenForBeta: (project.isOpenForBeta as boolean) ?? false,
    betaDescription: (project.betaDescription as string) ?? '',
    contactName: (project.contactName as string) ?? '',
    contactPhone: (project.contactPhone as string) ?? '',
    contactEmail: (project.contactEmail as string) ?? '',
    contactWechat: (project.contactWechat as string) ?? '',
  }
}

function toggleCategory(current: string[], category: string): string[] {
  return current.includes(category)
    ? current.filter((c) => c !== category)
    : [...current, category]
}

const STAGE_OPTIONS = [
  { value: String(ProjectStage.MVP), label: 'MVP 阶段' },
  { value: String(ProjectStage.Growth), label: '成长阶段' },
]

export function ProjectSubmissionForm({
  projectId,
  initialData,
}: {
  projectId?: number
  initialData?: Record<string, unknown>
}) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  // A project already in Pending Review can still be edited in place, but it
  // is already in the review queue — so there is nothing to (re)submit.
  const isPendingReview = initialData?.status === ProjectStatus.PendingReview
  const [form, setForm] = useState<FormState>(
    initialData ? fromProjectData(initialData) : EMPTY_FORM,
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedProjectId, setSavedProjectId] = useState<number | null>(projectId ?? null)

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
      setErrors({ name: '项目名称不能为空' })
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
    setSubmitting(true)
    setServerError(null)
    try {
      const body = toApiBody(form)
      let id = savedProjectId
      if (!id) {
        const { data, error } = await createProject(body)
        if (error) {
          if (error.body.error.field) {
            setErrors({ [error.body.error.field as keyof FormState]: error.body.error.message })
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
          setErrors({ [error.body.error.field as keyof FormState]: error.body.error.message })
        } else {
          setServerError(error.body.error.message)
        }
        return
      }
      if (data) router.push(`/projects/${data.id}`)
    } finally {
      setSubmitting(false)
    }
  }, [form, savedProjectId, router])

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

  return (
    <div className="space-y-6">
      {serverError ? (
        <div className="border-2 border-destructive bg-card p-4">
          <p className="font-mono text-xs tracking-[0.08em] text-destructive">
            ERROR / {serverError}
          </p>
        </div>
      ) : null}

      <FormSection index={1} title="基本信息">
        <FormField label="项目名称" htmlFor="name" required error={errors.name}>
          <TextInput
            id="name"
            name="name"
            value={form.name}
            onChange={(v) => update('name', v)}
            placeholder="给你的项目起个名字"
            required
            error={errors.name}
          />
        </FormField>
        <FormField label="一句话介绍" htmlFor="tagline" required error={errors.tagline}>
          <TextInput
            id="tagline"
            name="tagline"
            value={form.tagline}
            onChange={(v) => update('tagline', v)}
            placeholder="用一句话描述你的项目"
            required
            error={errors.tagline}
          />
        </FormField>
        <FormField label="团队名称" htmlFor="teamName">
          <TextInput
            id="teamName"
            name="teamName"
            value={form.teamName}
            onChange={(v) => update('teamName', v)}
            placeholder="你的团队或公司名称"
          />
        </FormField>
      </FormSection>

      <FormSection index={2} title="产品分类">
        <FormField label="分类" htmlFor="categories" required error={errors.categories}>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => update('categories', toggleCategory(form.categories, cat))}
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

      <FormSection index={3} title="产品介绍">
        <FormField label="详细描述" htmlFor="description" required error={errors.description}>
          <TextArea
            id="description"
            name="description"
            value={form.description}
            onChange={(v) => update('description', v)}
            placeholder="详细介绍你的项目是什么、做什么"
            rows={6}
            required
            error={errors.description}
          />
        </FormField>
        <FormField label="封面图 URL" htmlFor="coverUrl" required error={errors.coverUrl}>
          <TextInput
            id="coverUrl"
            name="coverUrl"
            value={form.coverUrl}
            onChange={(v) => update('coverUrl', v)}
            placeholder="https://example.com/cover.png"
            type="url"
            required
            error={errors.coverUrl}
          />
        </FormField>
      </FormSection>

      <FormSection index={4} title="演示资料">
        <FormField label="演示截图" htmlFor="demoImages" hint="每行一个图片 URL">
          <TextArea
            id="demoImages"
            name="demoImages"
            value={form.demoImages}
            onChange={(v) => update('demoImages', v)}
            placeholder="https://example.com/screenshot-1.png&#10;https://example.com/screenshot-2.png"
            rows={3}
          />
        </FormField>
        <FormField label="演示视频 URL" htmlFor="demoVideoUrl">
          <TextInput
            id="demoVideoUrl"
            name="demoVideoUrl"
            value={form.demoVideoUrl}
            onChange={(v) => update('demoVideoUrl', v)}
            placeholder="https://youtube.com/watch?v=... 或直接视频链接"
            type="url"
          />
        </FormField>
        <FormField label="产品链接" htmlFor="demoLink">
          <TextInput
            id="demoLink"
            name="demoLink"
            value={form.demoLink}
            onChange={(v) => update('demoLink', v)}
            placeholder="https://your-product.com"
            type="url"
          />
        </FormField>
      </FormSection>

      <FormSection index={5} title="用户与市场">
        <FormField label="目标用户" htmlFor="targetUsers" required error={errors.targetUsers}>
          <TextArea
            id="targetUsers"
            name="targetUsers"
            value={form.targetUsers}
            onChange={(v) => update('targetUsers', v)}
            placeholder="描述你的目标用户是谁"
            rows={3}
            required
            error={errors.targetUsers}
          />
        </FormField>
        <FormField label="解决的问题" htmlFor="userProblem" required error={errors.userProblem}>
          <TextArea
            id="userProblem"
            name="userProblem"
            value={form.userProblem}
            onChange={(v) => update('userProblem', v)}
            placeholder="用户遇到了什么问题？你的项目如何解决？"
            rows={3}
            required
            error={errors.userProblem}
          />
        </FormField>
        <FormField label="当前进展" htmlFor="progress" required error={errors.progress}>
          <TextArea
            id="progress"
            name="progress"
            value={form.progress}
            onChange={(v) => update('progress', v)}
            placeholder="目前项目进展到了什么阶段？"
            rows={3}
            required
            error={errors.progress}
          />
        </FormField>
        <FormField label="下一步计划" htmlFor="nextSteps">
          <TextArea
            id="nextSteps"
            name="nextSteps"
            value={form.nextSteps}
            onChange={(v) => update('nextSteps', v)}
            placeholder="接下来打算做什么？"
            rows={3}
          />
        </FormField>
        <FormField label="想对用户说的话" htmlFor="messageToUsers" required error={errors.messageToUsers}>
          <TextArea
            id="messageToUsers"
            name="messageToUsers"
            value={form.messageToUsers}
            onChange={(v) => update('messageToUsers', v)}
            placeholder="对潜在用户说几句话"
            rows={3}
            required
            error={errors.messageToUsers}
          />
        </FormField>
      </FormSection>

      <FormSection index={6} title="Beta 测试">
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
      </FormSection>

      <FormSection index={7} title="联系方式">
        <FormField label="联系人姓名" htmlFor="contactName" required error={errors.contactName}>
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
        <FormField label="联系电话" htmlFor="contactPhone" required error={errors.contactPhone}>
          <TextInput
            id="contactPhone"
            name="contactPhone"
            value={form.contactPhone}
            onChange={(v) => update('contactPhone', v)}
            placeholder="13800138000"
            required
            error={errors.contactPhone}
          />
        </FormField>
        <FormField label="联系邮箱" htmlFor="contactEmail">
          <TextInput
            id="contactEmail"
            name="contactEmail"
            value={form.contactEmail}
            onChange={(v) => update('contactEmail', v)}
            placeholder="you@example.com"
            type="email"
          />
        </FormField>
        <FormField label="微信号" htmlFor="contactWechat">
          <TextInput
            id="contactWechat"
            name="contactWechat"
            value={form.contactWechat}
            onChange={(v) => update('contactWechat', v)}
            placeholder="你的微信号"
          />
        </FormField>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        {isPendingReview ? (
          <>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              className="btn-hard btn-primary"
            >
              {saving ? '保存中...' : '保存修改'}
            </button>
            <span className="font-mono text-[11px] text-muted-foreground">
              项目正在审核中，保存后将继续审核更新后的内容
            </span>
          </>
        ) : (
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
        )}
        {savedProjectId ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            DRAFT ID: P-{String(savedProjectId).padStart(3, '0')}
          </span>
        ) : null}
      </div>
    </div>
  )
}

