import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { ProjectStatus, ProposalStatus } from '@shenicest/shared'
import { getProjectWithAuth } from '@/server/projects'
import {
  getFounderProjectAuditReason,
  getFounderProjectProposals,
} from '@/server/founder'
import { ProjectDetail } from '@/components/project-detail'
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
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="eyebrow">
          {projectIdLabel(projectId)} / {FOUNDER_STATUS_LABELS[project.status] ?? '未知'}
        </p>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1]">
          {project.name}
        </h1>
        {project.status === ProjectStatus.Live ? (
          <div className="mt-5">
            {activeProposal?.status === ProposalStatus.Pending ? (
              <span className="font-mono text-xs text-muted-foreground">
                修改提案正在审核中，暂时不能再次提交
              </span>
            ) : (
              <Link
                href={`/founder/projects/${projectId}/proposal`}
                className="btn-hard btn-primary inline-flex"
              >
                {activeProposal?.status === ProposalStatus.RevisionRequired ? '修改提案并重新提交' : '修改已上线项目'}
              </Link>
            )}
          </div>
        ) : null}
      </header>

      <ProjectDetail project={project} backHref="/founder/dashboard" showLike={false} />

      <section className="mx-auto mt-10 max-w-3xl border border-border bg-card p-5">
        <h2 className="mb-4 font-mono text-xs tracking-[0.12em] text-primary">
          CONTACT / INFO
        </h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
      </section>

      {auditReason ? (
        <section className="mt-10 border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="mb-2 font-bold text-amber-700">审核说明</h2>
          <p className="text-sm leading-relaxed text-amber-800">
            {auditReason.reason}
          </p>
          <p className="mt-2 font-mono text-[10px] text-amber-700/70">
            {auditReason.action} · {auditReason.createdAt.toLocaleString('zh-CN')}
          </p>
        </section>
      ) : null}

      {proposals && proposals.total > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">编辑提案记录</h2>
          <div className="space-y-3">
            {proposals.data.map((proposal) => (
              <div
                key={proposal.id}
                className="border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-primary">
                    #{proposal.id}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {proposal.status === 0 ? '审核中' : proposal.status === 1 ? '已通过' : proposal.status === 2 ? '已驳回' : '需修改'}
                  </span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 font-mono text-xs text-muted-foreground">
                  {JSON.stringify(proposal.changes, null, 2)}
                </pre>
                {proposal.reason ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    原因：{proposal.reason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
