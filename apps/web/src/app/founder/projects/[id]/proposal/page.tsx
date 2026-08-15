import { notFound, redirect } from 'next/navigation'
import { ProjectStatus, ProposalStatus } from '@shenicest/shared'
import { ProjectProposalForm } from '@/components/founder/project-proposal-form'
import { getFounderProjectProposals } from '@/server/founder'
import { getProjectWithAuth } from '@/server/projects'

export const dynamic = 'force-dynamic'

function parseProjectId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export default async function ProjectProposalPage(
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params
  const projectId = parseProjectId(id)
  if (projectId === null) notFound()

  const [project, proposals] = await Promise.all([
    getProjectWithAuth(projectId),
    getFounderProjectProposals(projectId),
  ])
  if (!project || project.status !== ProjectStatus.Live) notFound()

  const active = proposals?.data.find((proposal) =>
    proposal.status === ProposalStatus.Pending ||
    proposal.status === ProposalStatus.RevisionRequired
  )
  if (active?.status === ProposalStatus.Pending) redirect(`/founder/projects/${projectId}`)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="eyebrow">CHANGE PROPOSAL / P-{String(projectId).padStart(3, '0')}</p>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1]">
          {active ? '修改并重新提交' : '修改已上线项目'}
        </h1>
        <p className="mt-3 max-w-[60ch] text-base leading-[1.7] text-muted-foreground">
          修改内容提交后需要运营审核。审核期间，当前线上版本会继续正常展示。
        </p>
      </header>

      {active?.reason ? (
        <div className="mb-8 border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="font-mono text-xs tracking-[0.12em] text-amber-700">REVISION REQUIRED</p>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-amber-800">
            {active.reason}
          </p>
        </div>
      ) : null}

      <ProjectProposalForm
        projectId={projectId}
        liveData={{
          description: project.description ?? '',
          demoLink: project.demoLink ?? '',
          betaDescription: project.betaDescription ?? '',
        }}
        initialChanges={active?.changes as Partial<{ description: string; demoLink: string; betaDescription: string }>}
        proposalId={active?.id}
      />
    </div>
  )
}
