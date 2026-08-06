import { notFound } from 'next/navigation'
import { ProjectStatus } from '@shenicest/shared'
import { getProjectWithAuth } from '@/server/projects'
import { getFounderProjectAuditReason } from '@/server/founder'
import { ProjectSubmissionForm } from '@/components/submit/project-submission-form'

export const dynamic = 'force-dynamic'

const EDITABLE_STATUSES: number[] = [
  ProjectStatus.Draft,
  ProjectStatus.PendingReview,
  ProjectStatus.RevisionRequired,
]

const PAGE_DESCRIPTIONS: Record<number, string> = {
  [ProjectStatus.Draft]:
    '继续完善你的项目信息。保存草稿后可以随时回来编辑，确认无误后提交审核。',
  [ProjectStatus.PendingReview]:
    '项目正在审核中，你仍然可以修改内容。保存后运营将继续审核更新后的内容。',
  [ProjectStatus.RevisionRequired]:
    '运营要求修改你的项目。请根据下方的修改意见调整内容，确认后重新提交审核。',
}

function parseProjectId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export default async function EditDraftPage(props: PageProps<'/projects/[id]/edit'>) {
  const { id } = await props.params
  const projectId = parseProjectId(id)
  if (projectId === null) notFound()

  const project = await getProjectWithAuth(projectId)
  if (!project || !EDITABLE_STATUSES.includes(project.status)) notFound()

  const auditReason =
    project.status === ProjectStatus.RevisionRequired
      ? await getFounderProjectAuditReason(projectId)
      : null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="eyebrow">EDIT / P-{String(projectId).padStart(3, '0')}</p>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1]">
          编辑项目
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-[1.7] text-muted-foreground">
          {PAGE_DESCRIPTIONS[project.status]}
        </p>
      </header>

      {auditReason?.reason ? (
        <div className="mb-8 border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="font-mono text-xs tracking-[0.12em] text-amber-700">
            REVISION REQUIRED
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-800 whitespace-pre-line">
            {auditReason.reason}
          </p>
        </div>
      ) : null}

      <ProjectSubmissionForm
        projectId={projectId}
        initialData={project as unknown as Record<string, unknown>}
      />
    </div>
  )
}
