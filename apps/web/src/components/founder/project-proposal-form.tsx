'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProjectProposal, updateProjectProposal } from '@/lib/client-api'
import { FormField, FormSection, TextArea, TextInput } from '@/components/submit/form-fields'

// Post-live proposals may only touch these fields (ADR-0012).
interface ProposalFields {
  problemStatement: string
  nextSteps: string
  demoLink: string
  betaDescription: string
}

function isHttpUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function changesFrom(base: ProposalFields, current: ProposalFields) {
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => value !== base[key as keyof ProposalFields]),
  )
}

export function ProjectProposalForm({
  projectId,
  liveData,
  initialChanges,
  proposalId,
}: {
  projectId: number
  liveData: ProposalFields
  initialChanges?: Partial<ProposalFields>
  proposalId?: number
}) {
  const router = useRouter()
  const initial = { ...liveData, ...initialChanges }
  const [form, setForm] = useState<ProposalFields>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof ProposalFields, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof ProposalFields, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setServerError(null)
  }

  async function submit() {
    const nextErrors: typeof errors = {}
    if (!isHttpUrl(form.demoLink)) nextErrors.demoLink = '请输入正确的链接'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      requestAnimationFrame(() => document.getElementById('demoLink')?.focus())
      return
    }

    const changes = changesFrom(liveData, form)
    if (Object.keys(changes).length === 0) {
      setServerError('请至少修改一项内容')
      return
    }

    setSubmitting(true)
    const result = proposalId
      ? await updateProjectProposal(projectId, proposalId, changes)
      : await createProjectProposal(projectId, changes)
    setSubmitting(false)
    if (result.error) {
      setServerError(result.error.body.error.message)
      return
    }
    router.push(`/founder/projects/${projectId}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {serverError ? (
        <div className="border-2 border-destructive bg-card p-4 text-sm text-destructive">
          {serverError}
        </div>
      ) : null}
      <FormSection index={1} title="可修改内容">
        <FormField label="项目背景与问题" htmlFor="problemStatement" required error={errors.problemStatement}>
          <TextArea
            id="problemStatement"
            name="problemStatement"
            value={form.problemStatement}
            onChange={(value) => update('problemStatement', value)}
            rows={6}
            required
            error={errors.problemStatement}
          />
        </FormField>
        <FormField label="下一步计划" htmlFor="nextSteps" required error={errors.nextSteps}>
          <TextArea
            id="nextSteps"
            name="nextSteps"
            value={form.nextSteps}
            onChange={(value) => update('nextSteps', value)}
            rows={4}
            required
            error={errors.nextSteps}
          />
        </FormField>
        <FormField label="Demo 访问链接" htmlFor="demoLink" error={errors.demoLink}>
          <TextInput
            id="demoLink"
            name="demoLink"
            value={form.demoLink}
            onChange={(value) => update('demoLink', value)}
            type="url"
            placeholder="https://your-product.com"
            error={errors.demoLink}
          />
        </FormField>
        <FormField label="内测说明" htmlFor="betaDescription">
          <TextArea
            id="betaDescription"
            name="betaDescription"
            value={form.betaDescription}
            onChange={(value) => update('betaDescription', value)}
            rows={4}
          />
        </FormField>
      </FormSection>
      <button type="button" onClick={submit} disabled={submitting} className="btn-hard btn-primary">
        {submitting ? '提交中...' : proposalId ? '重新提交修改' : '提交修改提案'}
      </button>
    </div>
  )
}
