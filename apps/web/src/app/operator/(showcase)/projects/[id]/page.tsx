import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getOperatorProject, getOperatorProjectProposals } from '@/server/operator'
import { OperatorProjectDetail } from '@/components/operator/operator-project-detail'
import { Eyebrow } from '@/components/ui/typography'
import { projectIdLabel } from '@/lib/utils'
import { OPERATOR_STATUS_LABELS } from '@/lib/operator-filters'

export const dynamic = 'force-dynamic'

function parseProjectId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function generateMetadata(
  props: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await props.params
  const projectId = parseProjectId(id)
  if (projectId === null) return { title: '项目不可用' }
  const project = await getOperatorProject(projectId)
  if (!project) return { title: '项目不可用' }
  return { title: `${project.name} · 审核` }
}

export default async function OperatorProjectDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const projectId = parseProjectId(id)
  if (projectId === null) notFound()

  const project = await getOperatorProject(projectId)
  if (!project) notFound()

  const proposals = await getOperatorProjectProposals(projectId)

  return (
    <div>
      <header className="mb-8">
        <Eyebrow>
          {projectIdLabel(projectId)} / {OPERATOR_STATUS_LABELS[project.status] ?? '未知'}
        </Eyebrow>
        <h2 className="mt-3 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
          {project.name}
        </h2>
      </header>
      <OperatorProjectDetail project={project} proposals={proposals.data} />
    </div>
  )
}
