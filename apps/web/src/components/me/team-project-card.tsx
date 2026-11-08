import Link from 'next/link'
import {
  SeasonProjectMemberRole,
  SeasonProjectMemberStatus,
} from '@shenicest/shared'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/surface'
import { TeamProjectDialog } from '@/components/me/team-project-dialog'
import {
  seasonProjectMemberRoleLabel,
  seasonProjectSourceMeta,
  seasonProjectStatusMeta,
  type ProjectOption,
  type SeasonProjectDto,
  type TeamChallengeDto,
} from '@/lib/team'

/**
 * 「还没有项目 / 项目卡片」—— 组队 tab 的第 1 张卡。
 *
 * 无项目时给一句解释 + 主按钮（发起项目）：单人项目是允许的，这句话必须
 * 写出来，否则「发起人还没登记我」的人会以为只能干等。
 *
 * 有项目时展示项目名、来源、方向、命题、核心成员头像、状态。整张卡是
 * Server Component，唯一的交互是「发起项目」弹窗（Client）。
 */
export function TeamProjectCard({
  seasonId,
  seasonCode,
  seasonThemes,
  project,
  challenges,
  projects,
  maxChallengesPerProject,
}: {
  seasonId: number
  seasonCode: string
  seasonThemes: readonly string[]
  project: SeasonProjectDto | null
  challenges: readonly TeamChallengeDto[]
  projects: readonly ProjectOption[]
  maxChallengesPerProject: number
}) {
  if (!project) {
    return (
      <article className="ui-card ui-card--static">
        <div className="card-body">
          <h2 className="card-title">还没有项目</h2>
          <p className="card-text">
            等发起人登记你，或者自己发起一个（允许单人项目）。
          </p>
        </div>
        <footer className="card-footer">
          <TeamProjectDialog
            seasonId={seasonId}
            seasonCode={seasonCode}
            themes={seasonThemes}
            challenges={challenges}
            projects={projects}
            maxChallengesPerProject={maxChallengesPerProject}
          />
        </footer>
      </article>
    )
  }

  const statusMeta = seasonProjectStatusMeta(project.status)
  const sourceMeta = seasonProjectSourceMeta(project.source)
  const owner = project.members.find(
    (member) => member.role === SeasonProjectMemberRole.Owner,
  )
  const coreMembers = project.members.filter(
    (member) =>
      member.role !== SeasonProjectMemberRole.Owner &&
      member.status !== SeasonProjectMemberStatus.Removed,
  )

  return (
    <article className="ui-card ui-card--static">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">{project.name}</h2>
          <Chip tone={statusMeta.tone} dot>
            {statusMeta.label}
          </Chip>
        </div>

        {project.tagline ? <p className="card-text">{project.tagline}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Chip tone={sourceMeta.tone}>{sourceMeta.label}</Chip>
          {project.themes.map((theme) => (
            <Chip key={theme}>{theme}</Chip>
          ))}
        </div>

        <div>
          <p className="ui-hint m-0">命题</p>
          {project.challenges.length > 0 ? (
            <ul className="m-0 mt-1 list-none space-y-1 p-0">
              {project.challenges.map((challenge) => (
                <li key={challenge.id} className="text-body-sm text-foreground">
                  {challenge.title}
                  {challenge.type ? (
                    <span className="ml-2 font-mono text-meta text-muted-foreground">
                      {challenge.type}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-hint m-0 mt-1">还没有登记命题</p>
          )}
        </div>

        <div>
          <p className="ui-hint m-0">核心成员</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="ui-avatar-stack">
              {project.members.map((member) => (
                <span
                  key={member.userId}
                  className="ui-avatar"
                  title={`${member.name ?? `用户 #${member.userId}`} · ${seasonProjectMemberRoleLabel(member.role)}`}
                >
                  {member.avatarUrl ? (
                    // 头像来自共享 users 表的外链，不走 next/image 优化器（域名未白名单）。
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt="" />
                  ) : (
                    (member.name ?? member.userId).slice(0, 1)
                  )}
                </span>
              ))}
            </div>
            <span className="text-body-sm text-muted-foreground">
              {owner?.name ? `发起人 ${owner.name}` : '你是发起人'}
              {coreMembers.length > 0 ? ` · ${coreMembers.length} 位核心成员` : ' · 单人项目'}
            </span>
          </div>
        </div>
      </div>

      <footer className="card-footer">
        <span className="font-mono text-meta text-muted-foreground">
          项目 #{project.projectId}
        </span>
        <Link
          href={`/projects/${project.projectId}`}
          className="text-body-sm text-brand-text no-underline hover:underline"
        >
          查看项目 →
        </Link>
      </footer>
    </article>
  )
}

/**
 * 「还没有进行中的赛季」空态。
 *
 * 与卡片分开导出：这一屏在没有任何赛季时是整页替换，不是某一张卡的内容。
 */
export function TeamNoSeasonState() {
  return (
    <EmptyState
      title="还没有进行中的赛季"
      description="组队只在赛季里发生。先去看看有哪些赛季可以报名。"
      action={
        <Link href="/seasons" className="ui-btn ui-btn--secondary">
          去看看火热赛季 <span className="ui-btn__arrow" aria-hidden>→</span>
        </Link>
      }
    />
  )
}
