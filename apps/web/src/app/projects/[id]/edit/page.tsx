import { notFound, redirect } from 'next/navigation'
import { ProjectStatus } from '@shenicest/shared'
import { getProjectWithAuth } from '@/server/projects'
import { getFounderProjectAuditReason } from '@/server/founder'
import { ProjectSubmissionForm } from '@/components/submit/project-submission-form'
import { Eyebrow } from '@/components/ui/typography'

export const dynamic = 'force-dynamic'

const EDITABLE_STATUSES: number[] = [
  ProjectStatus.Draft,
  ProjectStatus.RevisionRequired,
]

const PAGE_DESCRIPTIONS: Record<number, string> = {
  [ProjectStatus.Draft]:
    '继续完善你的项目信息。保存草稿后可以随时回来编辑，确认无误后提交审核。',
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
  if (!project) notFound()
  if (project.status === ProjectStatus.PendingReview) redirect(`/founder/projects/${projectId}`)
  if (!EDITABLE_STATUSES.includes(project.status)) notFound()

  const auditReason =
    project.status === ProjectStatus.RevisionRequired
      ? await getFounderProjectAuditReason(projectId)
      : null

  return (
    <div className="shell shell--text py-12 sm:py-16">
      <header className="mb-10">
        <Eyebrow>EDIT / P-{String(projectId).padStart(3, '0')}</Eyebrow>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] leading-[1.1] font-bold">
          编辑项目
        </h1>
        <p className="mt-3 max-w-[60ch] text-body leading-[1.7] text-muted-foreground">
          {PAGE_DESCRIPTIONS[project.status]}
        </p>
      </header>

      {auditReason?.reason ? (
        <div className="ui-note ui-note--warning mb-8 flex-col">
          <p className="font-mono text-meta tracking-[0.12em]">REVISION REQUIRED</p>
          <p className="mt-2 whitespace-pre-line">{auditReason.reason}</p>
        </div>
      ) : null}

      <ProjectSubmissionForm
        projectId={projectId}
        initialData={project as unknown as Record<string, unknown>}
      />
    </div>
  )
}
