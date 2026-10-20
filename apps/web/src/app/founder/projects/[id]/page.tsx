import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { ProjectStatus, ProposalStatus } from '@shenicest/shared'
import { getProjectWithAuth } from '@/server/projects'
import {
  getFounderProjectAuditReason,
  getFounderProjectProposals,
} from '@/server/founder'
import { ProjectDetail } from '@/components/project-detail'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import { projectIdLabel } from '@/lib/utils'
import { FOUNDER_STATUS_LABELS } from '@/lib/founder-filters'

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

  const project = await getProjectWithAuth(projectId)
  if (!project) return { title: '项目不可用' }

  return {
    title: `${project.name} · 管理`,
  }
}

export default async function FounderProjectPage(
  props: { params: Promise<{ id: string }> }
) {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  if (!token) redirect('/login')

  const { id } = await props.params
  const projectId = parseProjectId(id)
  if (projectId === null) notFound()

  const project = await getProjectWithAuth(projectId)
  if (!project) notFound()

  const needsAuditReason =
    project.status === ProjectStatus.RevisionRequired ||
    project.status === ProjectStatus.Rejected ||
    project.status === ProjectStatus.Delisted

  const [proposals, auditReason] = await Promise.all([
    getFounderProjectProposals(projectId),
    needsAuditReason ? getFounderProjectAuditReason(projectId) : Promise.resolve(null),
  ])
  const activeProposal = proposals?.data.find((proposal) =>
    proposal.status === ProposalStatus.Pending ||
    proposal.status === ProposalStatus.RevisionRequired
  )

  return (
    <div className="shell shell--narrow py-12 sm:py-16">
      <header className="mb-10">
        <Eyebrow>
          {projectIdLabel(projectId)} / {FOUNDER_STATUS_LABELS[project.status] ?? '未知'}
        </Eyebrow>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] leading-[1.1] font-bold">
          {project.name}
        </h1>
        {project.status === ProjectStatus.Live ? (
          <div className="mt-5">
            {activeProposal?.status === ProposalStatus.Pending ? (
              <span className="mono">修改提案正在审核中，暂时不能再次提交</span>
            ) : (
              <ButtonLink href={`/founder/projects/${projectId}/proposal`}>
                {activeProposal?.status === ProposalStatus.RevisionRequired ? '修改提案并重新提交' : '修改已上线项目'}
              </ButtonLink>
            )}
          </div>
        ) : null}
      </header>

      <ProjectDetail project={project} backHref="/founder/dashboard" showLike={false} />

      <Card static className="mx-auto mt-10 max-w-3xl p-5">
        <h2 className="eyebrow eyebrow--accent mb-4">CONTACT / INFO</h2>
        <dl className="grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-2">
          {project.contactName ? (
            <div>
              <dt className="text-muted-foreground">联系人</dt>
              <dd className="mt-1 font-medium">{project.contactName}</dd>
            </div>
          ) : null}
          {project.contactEmail ? (
            <div>
              <dt className="text-muted-foreground">邮箱</dt>
              <dd className="mt-1 font-medium">{project.contactEmail}</dd>
            </div>
          ) : null}
          {project.contactPhone ? (
            <div>
              <dt className="text-muted-foreground">电话</dt>
              <dd className="mt-1 font-medium">{project.contactPhone}</dd>
            </div>
          ) : null}
          {project.contactWechat ? (
            <div>
              <dt className="text-muted-foreground">微信</dt>
              <dd className="mt-1 font-medium">{project.contactWechat}</dd>
            </div>
          ) : null}
          {project.teamName ? (
            <div>
              <dt className="text-muted-foreground">团队</dt>
              <dd className="mt-1 font-medium">{project.teamName}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {auditReason ? (
        <section className="ui-note ui-note--warning mx-auto mt-10 max-w-3xl flex-col">
          <h2 className="font-bold">审核说明</h2>
          <p className="whitespace-pre-line">{auditReason.reason}</p>
          <p className="font-mono text-meta tracking-[0.12em] opacity-80">
            {auditReason.action} · {auditReason.createdAt.toLocaleString('zh-CN')}
          </p>
        </section>
      ) : null}

      {proposals && proposals.total > 0 ? (
        <section className="mx-auto mt-10 max-w-3xl">
          <h2 className="mb-4 text-h3 font-bold">编辑提案记录</h2>
          <div className="flex flex-col gap-3">
            {proposals.data.map((proposal) => (
              <Card key={proposal.id} static className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="card-id">#{proposal.id}</span>
                  <span className="mono">
                    {proposal.status === 0 ? '审核中' : proposal.status === 1 ? '已通过' : proposal.status === 2 ? '已驳回' : '需修改'}
                  </span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-sm bg-muted p-3 font-mono text-meta text-muted-foreground">
                  {JSON.stringify(proposal.changes, null, 2)}
                </pre>
                {proposal.reason ? (
                  <p className="mt-3 text-body-sm text-muted-foreground">原因：{proposal.reason}</p>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
