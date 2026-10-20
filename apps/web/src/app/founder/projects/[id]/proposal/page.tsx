import { notFound, redirect } from 'next/navigation'
import { ProjectStatus, ProposalStatus } from '@shenicest/shared'
import { ProjectProposalForm } from '@/components/founder/project-proposal-form'
import { getFounderProjectProposals } from '@/server/founder'
import { getProjectWithAuth } from '@/server/projects'
import { Eyebrow } from '@/components/ui/typography'

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
    <div className="shell shell--text py-12 sm:py-16">
      <header className="mb-10">
        <Eyebrow>CHANGE PROPOSAL / P-{String(projectId).padStart(3, '0')}</Eyebrow>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] leading-[1.1] font-bold">
          {active ? '修改并重新提交' : '修改已上线项目'}
        </h1>
        <p className="mt-3 max-w-[60ch] text-body leading-[1.7] text-muted-foreground">
          修改内容提交后需要运营审核。审核期间，当前线上版本会继续正常展示。
        </p>
      </header>

      {active?.reason ? (
        <div className="ui-note ui-note--warning mb-8 flex-col">
          <p className="font-mono text-meta tracking-[0.12em]">REVISION REQUIRED</p>
          <p className="mt-2 whitespace-pre-line">{active.reason}</p>
        </div>
      ) : null}

      <ProjectProposalForm
        projectId={projectId}
        liveData={{
          problemStatement: project.problemStatement ?? '',
          nextSteps: project.nextSteps ?? '',
          demoLink: project.demoLink ?? '',
          betaDescription: project.betaDescription ?? '',
        }}
        initialChanges={active?.changes as Partial<{ problemStatement: string; nextSteps: string; demoLink: string; betaDescription: string }>}
        proposalId={active?.id}
      />
    </div>
  )
}
